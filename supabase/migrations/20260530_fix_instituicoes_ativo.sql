-- Fix: add ativo column to instituicoes if missing
-- The Supabase client types reference ativo but the column may not exist in DB

ALTER TABLE public.instituicoes
  ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;

-- Add index for ativo filter
CREATE INDEX IF NOT EXISTS idx_instituicoes_ativo ON public.instituicoes (ativo);

COMMENT ON COLUMN public.instituicoes.ativo IS 'Indica se o vínculo institucional está ativo';
