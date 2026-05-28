// ============================================================
// historicoFluxo.ts
// Helper para gravar log imutável de interações pastorais
// na tabela visita_historico
// ============================================================

import { supabase } from "@/integrations/supabase/client";

export type TipoHistorico =
  | "whatsapp"
  | "ligacao"
  | "visita_presencial"
  | "email"
  | "retorno_culto"
  | "evento"
  | "observacao"
  | "cadastro"
  | "promocao_congregado"
  | "promocao_membro";

/**
 * Insere um registro no histórico pastoral.
 * Silencia erros (não quebra o fluxo principal).
 */
export async function logHistorico(
  visitanteId: string,
  tipo: TipoHistorico,
  observacao?: string | null
): Promise<void> {
  try {
    await supabase
      .from("visita_historico")
      .insert({
        visitante_id: visitanteId,
        tipo,
        observacao: observacao?.trim() || null,
      });
  } catch {
    // silencia — histórico é secondary, nunca bloqueia ação principal
  }
}

/**
 * Labels e cores por tipo de evento histórico
 */
export const HISTORICO_CONFIG: Record<
  TipoHistorico,
  { label: string; cor: string; emoji: string }
> = {
  cadastro:            { label: "Primeiro culto",      emoji: "🏠", cor: "text-blue-600 bg-blue-50 border-blue-200" },
  whatsapp:            { label: "WhatsApp",             emoji: "💬", cor: "text-green-600 bg-green-50 border-green-200" },
  ligacao:             { label: "Ligação",              emoji: "📞", cor: "text-indigo-600 bg-indigo-50 border-indigo-200" },
  visita_presencial:   { label: "Visita presencial",    emoji: "🚪", cor: "text-amber-600 bg-amber-50 border-amber-200" },
  retorno_culto:       { label: "Retornou ao culto",    emoji: "✅", cor: "text-yellow-600 bg-yellow-50 border-yellow-200" },
  evento:              { label: "Evento especial",      emoji: "📅", cor: "text-purple-600 bg-purple-50 border-purple-200" },
  observacao:          { label: "Contato registrado",   emoji: "📝", cor: "text-muted-foreground bg-muted border-border" },
  promocao_congregado: { label: "Tornou-se Congregado", emoji: "✨", cor: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  promocao_membro:     { label: "Tornou-se Membro",     emoji: "🌟", cor: "text-gold bg-amber-50 border-amber-300" },
  email:               { label: "E-mail",               emoji: "✉️", cor: "text-sky-600 bg-sky-50 border-sky-200" },
};
