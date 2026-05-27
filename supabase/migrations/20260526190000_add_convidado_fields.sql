-- Campos para registrar quem convidou o visitante
-- convidado_por: FK para membro cadastrado (seleção na lista)
-- convidado_nome: texto livre quando não está na lista

ALTER TABLE public.membros
  ADD COLUMN IF NOT EXISTS convidado_por  UUID REFERENCES public.membros(id),
  ADD COLUMN IF NOT EXISTS convidado_nome TEXT;

COMMENT ON COLUMN public.membros.convidado_por  IS 'ID do membro que convidou o visitante (quando cadastrado no sistema)';
COMMENT ON COLUMN public.membros.convidado_nome IS 'Nome livre de quem convidou, quando não está na lista';
