-- ============================================================
-- Diakonia App — Formulário dinâmico de pessoa
-- Adiciona data_consagracao_pastoral à tabela membros
-- ============================================================

-- Campo para registrar data de consagração pastoral (pastores)
ALTER TABLE public.membros
  ADD COLUMN IF NOT EXISTS data_consagracao_pastoral DATE;

-- Índice para facilitar buscas por pastores consagrados
CREATE INDEX IF NOT EXISTS idx_membros_consagracao_pastoral
  ON public.membros(data_consagracao_pastoral)
  WHERE data_consagracao_pastoral IS NOT NULL;

COMMENT ON COLUMN public.membros.data_consagracao_pastoral
  IS 'Data em que o membro foi consagrado ao ministerio pastoral. Preenchido apenas quando perfil_acesso = pastor.';
