import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { UserPlus, Check, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: () => void;
}

interface MembroItem {
  id:            string;
  nome_completo: string;
}

// Sentinelas de seleção (nunca chegam ao banco)
const NENHUM = "__none__";
const OUTRO  = "__outro__";

// ── Componente ─────────────────────────────────────────────────────────────────

export default function VisitanteRapidoDialog({ open, onOpenChange, onSaved }: Props) {
  const [nome,          setNome]          = useState("");
  const [telefone,      setTelefone]      = useState("");
  const [saving,        setSaving]        = useState(false);
  const [errors,        setErrors]        = useState<{ nome?: string; telefone?: string }>({});

  // ── "Quem convidou" ────────────────────────────────────────────────────────
  const [membrosLista,  setMembrosLista]  = useState<MembroItem[]>([]);
  const [loadingMembros, setLoadingMembros] = useState(false);
  // convidadoSel: uuid selecionado | OUTRO | NENHUM | ""
  const [convidadoSel,  setConvidadoSel]  = useState<string>(NENHUM);
  // convidadoTexto: digitado manualmente quando OUTRO
  const [convidadoTexto, setConvidadoTexto] = useState("");

  // Carrega a lista de membros/congregados assim que o dialog abre
  useEffect(() => {
    if (!open) return;
    setLoadingMembros(true);
    supabase
      .from("membros")
      .select("id, nome_completo")
      .in("tipo_pessoa", ["membro", "congregado"])
      .order("nome_completo")
      .then(({ data }) => {
        setMembrosLista((data ?? []) as MembroItem[]);
        setLoadingMembros(false);
      });
  }, [open]);

  // ── Derivados ──────────────────────────────────────────────────────────────

  const isOutro      = convidadoSel === OUTRO;
  const membroNome   = membrosLista.find(m => m.id === convidadoSel)?.nome_completo ?? null;

  // ── Validação ──────────────────────────────────────────────────────────────

  const validate = () => {
    const e: typeof errors = {};
    if (!nome.trim())     e.nome     = "Nome é obrigatório";
    if (!telefone.trim()) e.telefone = "WhatsApp/telefone é obrigatório";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Tarefas de acolhimento ─────────────────────────────────────────────────

  const criarTarefas = async (visitanteId: string, nomeCompleto: string) => {
    const primeiro = nomeCompleto.split(" ")[0];
    const hoje = new Date();
    const addDias = (n: number) => {
      const d = new Date(hoje);
      d.setDate(d.getDate() + n);
      return d.toISOString().split("T")[0];
    };
    const tarefas = [
      { visitante_id: visitanteId, titulo: `Enviar mensagem de boas-vindas — ${primeiro}`,    data: addDias(0)  },
      { visitante_id: visitanteId, titulo: `Entrar em contato com visitante — ${primeiro}`,   data: addDias(2)  },
      { visitante_id: visitanteId, titulo: `Convidar ${primeiro} para retornar ao culto`,      data: addDias(7)  },
      { visitante_id: visitanteId, titulo: `Recontato — verificar situação de ${primeiro}`,   data: addDias(15) },
    ];
    const { error } = await supabase.from("acolhimento_tarefas").insert(tarefas);
    if (error) console.error("Erro ao criar tarefas de acolhimento:", error.message);
  };

  // ── Salvar ────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);

    // Campos de "quem convidou" dependendo da seleção
    const temMembroSelecionado = convidadoSel && convidadoSel !== NENHUM && convidadoSel !== OUTRO;
    const temTextoManual       = isOutro && convidadoTexto.trim();

    const camposConvidado = temMembroSelecionado
      ? {
          convidado_por:          convidadoSel,
          convidado_nome:         null,
          como_conheceu:          "indicacao_membro",
          como_conheceu_descricao: membroNome ?? "",
        }
      : temTextoManual
      ? {
          convidado_por:          null,
          convidado_nome:         convidadoTexto.trim(),
          como_conheceu:          "indicacao_membro",
          como_conheceu_descricao: convidadoTexto.trim(),
        }
      : {};

    const { data, error } = await supabase
      .from("membros")
      .insert({
        nome_completo:     nome.trim(),
        telefone_celular:  telefone.trim(),
        tipo_pessoa:       "visitante",
        numero_visitas:    1,
        status_acolhimento: "novo",
        perfil_acesso:     "membro",
        ...camposConvidado,
      } as any)
      .select()
      .single();

    if (error) {
      toast.error("Erro ao salvar: " + error.message);
      setSaving(false);
      return;
    }

    if (data?.id) await criarTarefas(data.id, nome.trim());

    toast.success(
      `${nome.trim().split(" ")[0]} cadastrado(a)! Já está na lista de acompanhamento. ✅`
    );
    handleReset();
    onSaved?.();
  };

  // ── Reset ─────────────────────────────────────────────────────────────────

  const handleReset = () => {
    setNome("");
    setTelefone("");
    setConvidadoSel(NENHUM);
    setConvidadoTexto("");
    setErrors({});
    setSaving(false);
    onOpenChange(false);
  };

  const handleClose = () => { if (!saving) handleReset(); };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-serif flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gold/20 ring-1 ring-gold/40 flex items-center justify-center shrink-0">
              <UserPlus className="w-4 h-4 text-gold" />
            </div>
            Visitante Rápido
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            Preencha só o essencial agora. O perfil completo pode ser editado depois.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">

          {/* Nome */}
          <div className="space-y-1.5">
            <Label htmlFor="vr-nome">
              Nome completo{" "}
              <span className="text-destructive" aria-hidden>*</span>
            </Label>
            <Input
              id="vr-nome"
              placeholder="Ex: Maria da Silva"
              value={nome}
              autoFocus
              autoComplete="off"
              onChange={(e) => {
                setNome(e.target.value);
                if (errors.nome) setErrors((p) => ({ ...p, nome: undefined }));
              }}
              onKeyDown={(e) => e.key === "Enter" && document.getElementById("vr-tel")?.focus()}
              className={errors.nome ? "border-destructive focus-visible:ring-destructive" : ""}
            />
            {errors.nome && <p className="text-xs text-destructive">{errors.nome}</p>}
          </div>

          {/* Telefone */}
          <div className="space-y-1.5">
            <Label htmlFor="vr-tel">
              WhatsApp / Telefone{" "}
              <span className="text-destructive" aria-hidden>*</span>
            </Label>
            <Input
              id="vr-tel"
              type="tel"
              inputMode="tel"
              placeholder="(11) 99999-9999"
              value={telefone}
              autoComplete="off"
              onChange={(e) => {
                setTelefone(e.target.value);
                if (errors.telefone) setErrors((p) => ({ ...p, telefone: undefined }));
              }}
              onKeyDown={(e) =>
                e.key === "Enter" && document.getElementById("vr-conv-trigger")?.focus()
              }
              className={errors.telefone ? "border-destructive focus-visible:ring-destructive" : ""}
            />
            {errors.telefone && <p className="text-xs text-destructive">{errors.telefone}</p>}
          </div>

          {/* Quem convidou — Select + input dinâmico */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-gold" aria-hidden />
              Quem convidou?
              <span className="text-xs text-muted-foreground font-normal">(opcional)</span>
            </Label>

            <Select value={convidadoSel} onValueChange={setConvidadoSel} disabled={loadingMembros}>
              <SelectTrigger id="vr-conv-trigger">
                <SelectValue placeholder={loadingMembros ? "Carregando…" : "Selecione ou deixe em branco"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NENHUM}>
                  — Não informado —
                </SelectItem>
                {membrosLista.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.nome_completo}
                  </SelectItem>
                ))}
                <SelectItem value={OUTRO}>
                  ✏️ Outro (não está na lista)
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Campo de texto manual — só aparece quando "Outro" selecionado */}
            {isOutro && (
              <Input
                id="vr-conv-manual"
                placeholder="Digite o nome de quem convidou"
                value={convidadoTexto}
                autoComplete="off"
                autoFocus
                onChange={(e) => setConvidadoTexto(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSave()}
              />
            )}
          </div>
        </div>

        {/* Ações */}
        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleClose}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            className="flex-1 gap-2"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            {saving ? "Salvando..." : "Cadastrar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
