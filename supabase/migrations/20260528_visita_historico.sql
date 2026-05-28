-- ============================================================
-- Sprint A — Log imutável de contatos e interações pastorais
-- ============================================================

-- Tabela principal de histórico
CREATE TABLE IF NOT EXISTS visita_historico (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitante_id  UUID NOT NULL REFERENCES membros(id) ON DELETE CASCADE,
  tipo          TEXT NOT NULL CHECK (tipo IN (
                  'whatsapp',
                  'ligacao',
                  'visita_presencial',
                  'email',
                  'retorno_culto',
                  'evento',
                  'observacao',
                  'cadastro',
                  'promocao_congregado',
                  'promocao_membro'
                )),
  observacao    TEXT,
  registrado_por UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE visita_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_select_historico"
  ON visita_historico FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "auth_insert_historico"
  ON visita_historico FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Índice para busca por visitante ordenada cronologicamente
CREATE INDEX IF NOT EXISTS idx_visita_historico_visitante
  ON visita_historico(visitante_id, created_at DESC);

-- ============================================================
-- Seed automático: criar entrada de "cadastro" para visitantes
-- já existentes (executa uma vez)
-- ============================================================
INSERT INTO visita_historico (visitante_id, tipo, observacao, created_at)
SELECT
  id,
  'cadastro',
  'Primeiro culto — cadastro inicial',
  created_at
FROM membros
WHERE tipo_pessoa IN ('visitante', 'congregado', 'membro')
ON CONFLICT DO NOTHING;
