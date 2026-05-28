-- ============================================================
-- Tabela: recuperacao_senha
-- Registra pedidos de recuperação para acompanhamento do admin
-- ============================================================

CREATE TABLE IF NOT EXISTS public.recuperacao_senha (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email          TEXT        NOT NULL,
  nome           TEXT,                       -- nome da pessoa, se identificada
  pessoa_id      UUID REFERENCES public.membros(id) ON DELETE SET NULL,
  solicitado_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
  status         TEXT        NOT NULL DEFAULT 'pendente'
                   CHECK (status IN ('pendente', 'em_andamento', 'resolvido')),
  resolvido_em   TIMESTAMPTZ,
  resolvido_por  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  observacao     TEXT,                       -- anotação do admin ao resolver
  origem         TEXT DEFAULT 'app'           -- 'app' | 'admin'
);

-- Índice para busca por status
CREATE INDEX IF NOT EXISTS idx_recuperacao_status
  ON public.recuperacao_senha(status, solicitado_em DESC);

-- RLS
ALTER TABLE public.recuperacao_senha ENABLE ROW LEVEL SECURITY;

-- Qualquer pessoa pode inserir (necessário para o fluxo de recuperação sem login)
CREATE POLICY "insert_sem_auth"
  ON public.recuperacao_senha FOR INSERT
  WITH CHECK (true);

-- Somente autenticados podem ler e atualizar
CREATE POLICY "read_autenticado"
  ON public.recuperacao_senha FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "update_autenticado"
  ON public.recuperacao_senha FOR UPDATE
  USING (auth.role() = 'authenticated');
