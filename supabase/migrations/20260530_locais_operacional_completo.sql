-- ============================================================
-- Diakonia App — Locais: governança e operação completa
-- Migration: 20260530_locais_operacional_completo.sql
-- ============================================================

-- 1. Enum de status operacional (5 estados)
DO $$ BEGIN
  CREATE TYPE public.local_status_op AS ENUM
    ('disponivel','em_uso','em_manutencao','interditado','inativo');
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Novas colunas na tabela locais
ALTER TABLE public.locais
  -- Identificação
  ADD COLUMN IF NOT EXISTS codigo                    text,
  -- Status operacional rico
  ADD COLUMN IF NOT EXISTS status_operacional        public.local_status_op
                                                     NOT NULL DEFAULT 'disponivel',
  ADD COLUMN IF NOT EXISTS motivo_status             text,
  -- Manutenção preventiva
  ADD COLUMN IF NOT EXISTS periodicidade_manutencao  integer
                           CHECK (periodicidade_manutencao IS NULL OR periodicidade_manutencao > 0),
  ADD COLUMN IF NOT EXISTS ultima_manutencao         date,
  ADD COLUMN IF NOT EXISTS proxima_manutencao        date,
  ADD COLUMN IF NOT EXISTS responsavel_manutencao_id uuid
                           REFERENCES public.membros(id) ON DELETE SET NULL,
  -- Limpeza
  ADD COLUMN IF NOT EXISTS frequencia_limpeza        text
                           CHECK (frequencia_limpeza IS NULL OR frequencia_limpeza IN
                             ('diaria','semanal','quinzenal','mensal','sob_demanda')),
  ADD COLUMN IF NOT EXISTS ultima_limpeza            date,
  ADD COLUMN IF NOT EXISTS responsavel_limpeza_id    uuid
                           REFERENCES public.membros(id) ON DELETE SET NULL,
  -- Responsavel geral
  ADD COLUMN IF NOT EXISTS responsavel_id            uuid
                           REFERENCES public.membros(id) ON DELETE SET NULL,
  -- Controle fisico
  ADD COLUMN IF NOT EXISTS codigo_chave              text;

-- 3. Trigger: calcula proxima_manutencao automaticamente
CREATE OR REPLACE FUNCTION public.locais_calc_proxima_manutencao()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.ultima_manutencao IS NOT NULL AND NEW.periodicidade_manutencao IS NOT NULL THEN
    NEW.proxima_manutencao :=
      NEW.ultima_manutencao + (NEW.periodicidade_manutencao || ' days')::interval;
  ELSE
    NEW.proxima_manutencao := NULL;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_locais_proxima_manutencao ON public.locais;
CREATE TRIGGER trg_locais_proxima_manutencao
  BEFORE INSERT OR UPDATE OF ultima_manutencao, periodicidade_manutencao
  ON public.locais
  FOR EACH ROW EXECUTE FUNCTION public.locais_calc_proxima_manutencao();

-- 4. Trigger: bloqueia agendamento quando status operacional impede uso
CREATE OR REPLACE FUNCTION public.locais_sync_agendamento()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status_operacional IN ('em_manutencao', 'interditado', 'inativo') THEN
    NEW.permite_agendamento := false;
  END IF;
  -- Sincroniza status legacy
  IF NEW.status_operacional = 'inativo' THEN
    NEW.status := 'inativo';
  ELSE
    NEW.status := 'ativo';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_locais_sync_agendamento ON public.locais;
CREATE TRIGGER trg_locais_sync_agendamento
  BEFORE INSERT OR UPDATE OF status_operacional
  ON public.locais
  FOR EACH ROW EXECUTE FUNCTION public.locais_sync_agendamento();

-- 5. Tabela de historico operacional
CREATE TABLE IF NOT EXISTS public.locais_historico_operacional (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  local_id      uuid NOT NULL REFERENCES public.locais(id) ON DELETE CASCADE,
  tipo          text NOT NULL
                CHECK (tipo IN
                  ('manutencao','limpeza','interdito','reativacao','vistoria','outro')),
  descricao     text,
  data          date NOT NULL DEFAULT CURRENT_DATE,
  realizado_por uuid REFERENCES public.membros(id) ON DELETE SET NULL,
  custo         numeric(10,2),
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.locais_historico_operacional ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locais_historico_operacional FORCE ROW LEVEL SECURITY;

CREATE POLICY "Bloqueia anon hist locais"
  ON public.locais_historico_operacional AS RESTRICTIVE FOR ALL TO anon
  USING (false) WITH CHECK (false);

CREATE POLICY "Staff leem historico locais"
  ON public.locais_historico_operacional FOR SELECT TO authenticated
  USING (public.has_any_role(auth.uid(),
    ARRAY['admin'::app_role,'secretaria'::app_role,'diakonia'::app_role]));

CREATE POLICY "Admin/Sec gerenciam historico locais"
  ON public.locais_historico_operacional FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(),
    ARRAY['admin'::app_role,'secretaria'::app_role]))
  WITH CHECK (public.has_any_role(auth.uid(),
    ARRAY['admin'::app_role,'secretaria'::app_role]));

CREATE INDEX IF NOT EXISTS idx_loc_hist_local
  ON public.locais_historico_operacional(local_id);
CREATE INDEX IF NOT EXISTS idx_loc_hist_data
  ON public.locais_historico_operacional(data DESC);
CREATE INDEX IF NOT EXISTS idx_loc_hist_tipo
  ON public.locais_historico_operacional(tipo);

-- 6. Trigger: registra reativacao automaticamente no historico
CREATE OR REPLACE FUNCTION public.locais_auto_historico()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Quando sai de manutencao -> disponivel, registra reativacao
  IF OLD.status_operacional = 'em_manutencao'
     AND NEW.status_operacional = 'disponivel' THEN
    INSERT INTO public.locais_historico_operacional
      (local_id, tipo, descricao, data)
    VALUES
      (NEW.id, 'reativacao',
       'Local reativado automaticamente apos manutencao',
       CURRENT_DATE);
  END IF;
  -- Quando entra em manutencao, registra
  IF OLD.status_operacional != 'em_manutencao'
     AND NEW.status_operacional = 'em_manutencao' THEN
    INSERT INTO public.locais_historico_operacional
      (local_id, tipo, descricao, data)
    VALUES
      (NEW.id, 'manutencao',
       COALESCE(NEW.motivo_status, 'Entrada em manutencao'),
       CURRENT_DATE);
  END IF;
  -- Quando entra em interditado
  IF OLD.status_operacional != 'interditado'
     AND NEW.status_operacional = 'interditado' THEN
    INSERT INTO public.locais_historico_operacional
      (local_id, tipo, descricao, data)
    VALUES
      (NEW.id, 'interdito',
       COALESCE(NEW.motivo_status, 'Local interditado'),
       CURRENT_DATE);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_locais_auto_historico ON public.locais;
CREATE TRIGGER trg_locais_auto_historico
  AFTER UPDATE OF status_operacional ON public.locais
  FOR EACH ROW EXECUTE FUNCTION public.locais_auto_historico();

-- 7. View: alertas de manutencao
CREATE OR REPLACE VIEW public.v_locais_alerta_manutencao AS
SELECT
  l.id,
  l.nome,
  l.nome_completo,
  l.predio,
  l.pavimento,
  l.proxima_manutencao,
  l.ultima_manutencao,
  l.periodicidade_manutencao,
  l.responsavel_manutencao_id,
  m.nome_completo AS responsavel_nome,
  (l.proxima_manutencao - CURRENT_DATE)::integer AS dias_para_manutencao,
  CASE
    WHEN l.proxima_manutencao < CURRENT_DATE THEN 'vencida'
    WHEN l.proxima_manutencao <= CURRENT_DATE + 7 THEN 'urgente'
    WHEN l.proxima_manutencao <= CURRENT_DATE + 30 THEN 'proxima'
    ELSE 'ok'
  END AS alerta_manutencao
FROM public.locais l
LEFT JOIN public.membros m ON m.id = l.responsavel_manutencao_id
WHERE l.status = 'ativo'
  AND l.proxima_manutencao IS NOT NULL
ORDER BY l.proxima_manutencao ASC;

-- 8. Indices adicionais
CREATE INDEX IF NOT EXISTS idx_locais_status_op
  ON public.locais(status_operacional);
CREATE INDEX IF NOT EXISTS idx_locais_proxima_manutencao
  ON public.locais(proxima_manutencao)
  WHERE proxima_manutencao IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_locais_responsavel
  ON public.locais(responsavel_id)
  WHERE responsavel_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_locais_codigo
  ON public.locais(codigo)
  WHERE codigo IS NOT NULL;

-- 9. Trigger updated_at para historico
CREATE TRIGGER trg_locais_hist_updated
  BEFORE UPDATE ON public.locais_historico_operacional
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
