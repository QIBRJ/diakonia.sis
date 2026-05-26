-- Migration: adicionar campos de histórico de contato na tabela membros
-- Parte do fluxo M2 (contexto e histórico do contato pastoral)

ALTER TABLE public.membros
  ADD COLUMN IF NOT EXISTS ultimo_contato_tipo       TEXT,
  ADD COLUMN IF NOT EXISTS ultimo_contato_observacao TEXT;

COMMENT ON COLUMN public.membros.ultimo_contato_tipo       IS 'Resultado do último contato com o visitante (ex: Não respondeu, Demonstrou interesse)';
COMMENT ON COLUMN public.membros.ultimo_contato_observacao IS 'Observação livre registrada no último contato pastoral';
