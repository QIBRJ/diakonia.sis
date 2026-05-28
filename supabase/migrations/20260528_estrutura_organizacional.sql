-- ============================================================
-- REESTRUTURAÇÃO ORGANIZACIONAL COMPLETA
-- Diakonia App v3.0 — Estrutura Oficial da Igreja
-- ============================================================
-- Camadas: Assembleia → Diretoria → Conselho → Ministérios
--          → Áreas → Setores → Pessoas → Escalas
-- ============================================================

-- ── 1. Aprimorar ministerios com tipo ────────────────────────
ALTER TABLE public.ministerios
  ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'operacional'
    CHECK (tipo IN ('operacional', 'governanca'));

ALTER TABLE public.ministerios
  ADD COLUMN IF NOT EXISTS cor TEXT;   -- ex: '#7C3AED' para identificação visual

-- Seed: ministérios oficiais (ON CONFLICT é por nome)
INSERT INTO public.ministerios (nome, tipo, ativo, cor) VALUES
  ('Celebrando a Transformação', 'operacional', true, '#7C3AED'),
  ('Pastoral',                   'operacional', true, '#2563EB'),
  ('Administração',              'operacional', true, '#0891B2'),
  ('Comunicação',                'operacional', true, '#7C3AED'),
  ('Diaconia e Ação Social',     'operacional', true, '#DC2626'),
  ('Educação Cristã',            'operacional', true, '#D97706'),
  ('Música',                     'operacional', true, '#7C3AED'),
  ('Missões e Evangelismo',      'operacional', true, '#059669'),
  ('Comunhão e Integração',      'operacional', true, '#DB2777'),
  ('Famílias',                   'operacional', true, '#EA580C'),
  ('Oração',                     'operacional', true, '#6D28D9')
ON CONFLICT (nome) DO NOTHING;

-- ── 2. Cargos Estatutários (Diretoria — NUNCA é ministério) ──
CREATE TABLE IF NOT EXISTS public.cargos_estatutarios (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       TEXT    NOT NULL UNIQUE,
  nivel      INTEGER NOT NULL DEFAULT 1 CHECK (nivel IN (1,2,3,4)),
  -- 1=Presidente, 2=Vice-presidente, 3=Secretário, 4=Tesoureiro
  descricao  TEXT,
  ativo      BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.cargos_estatutarios (nome, nivel, descricao) VALUES
  ('Presidente',      1, 'Representa legalmente a Igreja'),
  ('Vice-presidente', 2, 'Substitui o Presidente em suas ausências'),
  ('Secretário',      3, 'Responsável pela documentação oficial'),
  ('2º Secretário',   3, 'Auxilia o Secretário'),
  ('Tesoureiro',      4, 'Gestão financeira e patrimonial'),
  ('2º Tesoureiro',   4, 'Auxilia o Tesoureiro')
ON CONFLICT (nome) DO NOTHING;

-- ── 3. Pessoa ↔ Cargo Estatutário ────────────────────────────
CREATE TABLE IF NOT EXISTS public.pessoa_cargo_estatutario (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pessoa_id   UUID NOT NULL REFERENCES public.membros(id)              ON DELETE CASCADE,
  cargo_id    UUID NOT NULL REFERENCES public.cargos_estatutarios(id)  ON DELETE CASCADE,
  data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  data_fim    DATE,
  mandato     TEXT,   -- ex: '2024-2026'
  ativo       BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(pessoa_id, cargo_id, data_inicio)
);

-- ── 4. Áreas (subdivisões de um ministério) ───────────────────
CREATE TABLE IF NOT EXISTS public.areas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministerio_id UUID NOT NULL REFERENCES public.ministerios(id) ON DELETE CASCADE,
  nome          TEXT NOT NULL,
  descricao     TEXT,
  lider_id      UUID REFERENCES public.membros(id) ON DELETE SET NULL,
  vice_lider_id UUID REFERENCES public.membros(id) ON DELETE SET NULL,
  cor           TEXT,
  ativo         BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ── 5. Setores (subdivisões de uma área) ─────────────────────
CREATE TABLE IF NOT EXISTS public.setores (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id     UUID NOT NULL REFERENCES public.areas(id) ON DELETE CASCADE,
  nome        TEXT NOT NULL,
  descricao   TEXT,
  lider_id    UUID REFERENCES public.membros(id) ON DELETE SET NULL,
  ativo       BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── 6. Participação flexível (pessoa ↔ ministério/área/setor) ─
--   Permite múltiplos vínculos simultâneos por pessoa
CREATE TABLE IF NOT EXISTS public.pessoa_participacao (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pessoa_id     UUID NOT NULL REFERENCES public.membros(id) ON DELETE CASCADE,
  ministerio_id UUID REFERENCES public.ministerios(id) ON DELETE CASCADE,
  area_id       UUID REFERENCES public.areas(id)        ON DELETE CASCADE,
  setor_id      UUID REFERENCES public.setores(id)      ON DELETE CASCADE,
  funcao        TEXT NOT NULL DEFAULT 'voluntario'
    CHECK (funcao IN (
      'lider', 'co_lider', 'secretario', 'tesoureiro',
      'voluntario', 'diacono', 'obreiro', 'colaborador', 'outro'
    )),
  data_inicio   DATE NOT NULL DEFAULT CURRENT_DATE,
  data_fim      DATE,
  ativo         BOOLEAN DEFAULT true,
  observacao    TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  -- exige pelo menos um vínculo
  CONSTRAINT fk_vinculo_obrigatorio CHECK (
    ministerio_id IS NOT NULL OR area_id IS NOT NULL OR setor_id IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_participacao_pessoa
  ON public.pessoa_participacao(pessoa_id) WHERE ativo = true;

CREATE INDEX IF NOT EXISTS idx_participacao_ministerio
  ON public.pessoa_participacao(ministerio_id) WHERE ativo = true;

-- ── 7. Escalas (cabeçalho) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.escalas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ministerio_id UUID REFERENCES public.ministerios(id) ON DELETE SET NULL,
  area_id       UUID REFERENCES public.areas(id)        ON DELETE SET NULL,
  nome          TEXT NOT NULL,
  data_inicio   DATE NOT NULL,
  data_fim      DATE,
  descricao     TEXT,
  ativo         BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ── 8. Escala ↔ Participantes ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.escala_participantes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escala_id  UUID NOT NULL REFERENCES public.escalas(id) ON DELETE CASCADE,
  pessoa_id  UUID NOT NULL REFERENCES public.membros(id) ON DELETE CASCADE,
  funcao     TEXT,
  data_slot  DATE,
  confirmado BOOLEAN DEFAULT NULL,   -- NULL=aguardando, true=confirmado, false=recusou
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(escala_id, pessoa_id, data_slot)
);

-- ── RLS em todas as tabelas novas ─────────────────────────────
DO $$
DECLARE tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'cargos_estatutarios', 'pessoa_cargo_estatutario',
    'areas', 'setores', 'pessoa_participacao',
    'escalas', 'escala_participantes'
  ] LOOP
    EXECUTE format(
      'DO $inner$ BEGIN
         IF NOT EXISTS (
           SELECT 1 FROM pg_policies
           WHERE tablename = %L AND policyname = %L
         ) THEN
           EXECUTE ''ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY'';
           EXECUTE ''CREATE POLICY "read_%s" ON public.%I FOR SELECT USING (auth.role() = ''''authenticated'''')'';
           EXECUTE ''CREATE POLICY "ins_%s" ON public.%I FOR INSERT WITH CHECK (auth.role() = ''''authenticated'''')'';
           EXECUTE ''CREATE POLICY "upd_%s" ON public.%I FOR UPDATE USING (auth.role() = ''''authenticated'''')'';
         END IF;
       END $inner$'',
      tbl, ''read_''||tbl, tbl, tbl, tbl, tbl, tbl, tbl
    );
  END LOOP;
END $$;

-- ── VIEW: Conselho da Igreja (calculado) ─────────────────────
CREATE OR REPLACE VIEW public.v_conselho_da_igreja AS

-- Diretoria estatutária
SELECT
  m.id                        AS pessoa_id,
  m.nome_completo,
  m.foto_url,
  ce.nome                     AS cargo,
  ce.nivel                    AS nivel_cargo,
  'diretoria'                 AS tipo_participacao,
  NULL::TEXT                  AS ministerio_nome
FROM public.pessoa_cargo_estatutario pce
JOIN public.membros m             ON m.id  = pce.pessoa_id
JOIN public.cargos_estatutarios ce ON ce.id = pce.cargo_id
WHERE pce.ativo = true

UNION ALL

-- Líderes de ministério operacional
SELECT
  m.id,
  m.nome_completo,
  m.foto_url,
  'Líder de Ministério'       AS cargo,
  10                          AS nivel_cargo,
  'ministerio'                AS tipo_participacao,
  mi.nome                     AS ministerio_nome
FROM public.ministerios mi
JOIN public.membros m ON m.id = mi.lider_id
WHERE mi.ativo = true AND mi.lider_id IS NOT NULL

UNION ALL

-- Líderes de área
SELECT
  m.id,
  m.nome_completo,
  m.foto_url,
  'Líder de Área'             AS cargo,
  20                          AS nivel_cargo,
  'area'                      AS tipo_participacao,
  mi.nome                     AS ministerio_nome
FROM public.areas a
JOIN public.ministerios mi ON mi.id = a.ministerio_id
JOIN public.membros m      ON m.id  = a.lider_id
WHERE a.ativo = true AND a.lider_id IS NOT NULL

UNION ALL

-- Diáconos
SELECT
  m.id,
  m.nome_completo,
  m.foto_url,
  'Diácono'                   AS cargo,
  30                          AS nivel_cargo,
  'diacono'                   AS tipo_participacao,
  mi.nome                     AS ministerio_nome
FROM public.pessoa_participacao pp
JOIN public.membros m              ON m.id  = pp.pessoa_id
LEFT JOIN public.ministerios mi    ON mi.id = pp.ministerio_id
WHERE pp.funcao = 'diacono' AND pp.ativo = true;
