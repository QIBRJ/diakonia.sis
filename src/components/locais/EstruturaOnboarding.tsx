import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Church, Building2, MapPin, LayoutGrid, CheckCircle, ChevronRight, Plus, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Tipos ────────────────────────────────────────────────────────────────────
type UnidadeTipo = "sede" | "congregacao" | "missao" | "ponto_de_pregacao" | "outro";
type PredioTipo = "templo" | "anexo" | "residencia_pastoral" | "administrativo" | "apoio" | "outro";

const UNIDADE_TIPOS = [
  { value: "sede" as UnidadeTipo, label: "Sede" },
  { value: "congregacao" as UnidadeTipo, label: "Congregacao" },
  { value: "missao" as UnidadeTipo, label: "Missao" },
  { value: "ponto_de_pregacao" as UnidadeTipo, label: "Ponto de Pregacao" },
  { value: "outro" as UnidadeTipo, label: "Outro" },
];
const PREDIO_TIPOS = [
  { value: "templo" as PredioTipo, label: "Templo principal" },
  { value: "anexo" as PredioTipo, label: "Predio anexo" },
  { value: "residencia_pastoral" as PredioTipo, label: "Residencia pastoral" },
  { value: "administrativo" as PredioTipo, label: "Administrativo" },
  { value: "apoio" as PredioTipo, label: "Apoio" },
  { value: "outro" as PredioTipo, label: "Outro" },
];

// Sugestoes automaticas por tipo de unidade
const PREDIOS_SUGERIDOS: Record<UnidadeTipo, { nome: string; tipo: PredioTipo }[]> = {
  sede: [
    { nome: "Templo principal", tipo: "templo" },
    { nome: "Predio anexo", tipo: "anexo" },
    { nome: "Residencia pastoral", tipo: "residencia_pastoral" },
  ],
  congregacao: [
    { nome: "Templo", tipo: "templo" },
    { nome: "Sala de apoio", tipo: "apoio" },
  ],
  missao: [{ nome: "Ponto de reuniao", tipo: "apoio" }],
  ponto_de_pregacao: [{ nome: "Local de pregacao", tipo: "apoio" }],
  outro: [{ nome: "Espaco principal", tipo: "outro" }],
};

const LOCAIS_SUGERIDOS = [
  "Auditorio / Templo",
  "Sala infantil",
  "Cozinha",
  "Escritorio",
  "Deposito",
  "Banheiro",
  "Sala de reuniao",
  "Estudio / Comunicacao",
];

// ── Etapas ────────────────────────────────────────────────────────────────────
const ETAPAS = [
  { id: 1, label: "Unidade", icon: Church },
  { id: 2, label: "Predio", icon: Building2 },
  { id: 3, label: "Locais", icon: LayoutGrid },
  { id: 4, label: "Conclusao", icon: CheckCircle },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConcluido: () => void;
}

// ── Componente principal ──────────────────────────────────────────────────────
export function EstruturaOnboarding({ open, onOpenChange, onConcluido }: Props) {
  const [etapa, setEtapa] = useState(1);
  const [busy, setBusy] = useState(false);

  // Dados da unidade
  const [unidadeNome, setUnidadeNome] = useState("Sede");
  const [unidadeTipo, setUnidadeTipo] = useState<UnidadeTipo>("sede");
  const [unidadeId, setUnidadeId] = useState<string | null>(null);

  // Predios a criar
  const [predios, setPredios] = useState<{ nome: string; tipo: PredioTipo; logradouro: string; numero: string; bairro: string; cidade: string; cep: string; _id?: string }[]>([
    { nome: "Templo principal", tipo: "templo", logradouro: "", numero: "", bairro: "", cidade: "", cep: "" },
  ]);
  const [predioIds, setPredioIds] = useState<string[]>([]);

  // Locais a criar
  const [locaisSel, setLocaisSel] = useState<{ nome: string; predio_idx: number }[]>([
    { nome: "Auditorio / Templo", predio_idx: 0 },
    { nome: "Sala infantil", predio_idx: 0 },
    { nome: "Cozinha", predio_idx: 0 },
  ]);
  const [localNomeCustom, setLocalNomeCustom] = useState("");
  const [localPredioIdx, setLocalPredioIdx] = useState(0);

  // Quando tipo muda, sugerir predios
  const aplicarSugestoesPredios = (tipo: UnidadeTipo) => {
    const sugs = PREDIOS_SUGERIDOS[tipo] ?? [];
    setPredios(sugs.map(s => ({ ...s, logradouro: "", numero: "", bairro: "", cidade: "", cep: "" })));
  };

  // Etapa 1 → Salvar unidade
  const salvarUnidade = async () => {
    if (!unidadeNome.trim()) return toast.error("Informe o nome da unidade");
    setBusy(true);
    const { data, error } = await supabase
      .from("unidades" as any)
      .insert({ nome: unidadeNome.trim(), tipo: unidadeTipo })
      .select("id").single();
    setBusy(false);
    if (error) return toast.error(error.message);
    setUnidadeId(data.id);
    toast.success("Unidade criada!");
    setEtapa(2);
  };

  // Etapa 2 → Salvar predios
  const salvarPredios = async () => {
    if (predios.length === 0) { setEtapa(3); return; }
    if (!unidadeId) return;
    setBusy(true);
    const payload = predios.map(p => ({
      unidade_id: unidadeId,
      nome: p.nome.trim() || "Predio",
      tipo: p.tipo,
      logradouro: p.logradouro.trim() || null,
      numero: p.numero.trim() || null,
      bairro: p.bairro.trim() || null,
      cidade: p.cidade.trim() || null,
      cep: p.cep.trim() || null,
    }));
    const { data, error } = await supabase
      .from("predios" as any)
      .insert(payload)
      .select("id");
    setBusy(false);
    if (error) return toast.error(error.message);
    setPredioIds((data ?? []).map((d: any) => d.id));
    toast.success(`${payload.length} predio(s) criado(s)!`);
    setEtapa(3);
  };

  // Etapa 3 → Salvar locais
  const salvarLocais = async () => {
    if (locaisSel.length === 0 || predioIds.length === 0) { setEtapa(4); return; }
    setBusy(true);
    const payload = locaisSel
      .filter(l => l.nome.trim())
      .map(l => ({
        nome: l.nome.trim(),
        predio_id: predioIds[l.predio_idx] ?? predioIds[0],
        status: "ativo",
        status_operacional: "disponivel",
        permite_agendamento: true,
      }));
    const { error } = await supabase.from("locais" as any).insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`${payload.length} local(is) criado(s)!`);
    setEtapa(4);
  };

  const addPredio = () => setPredios(p => [...p, { nome: "", tipo: "outro", logradouro: "", numero: "", bairro: "", cidade: "", cep: "" }]);
  const removePredio = (i: number) => setPredios(p => p.filter((_, idx) => idx !== i));
  const setPredioField = (i: number, k: string, v: string) =>
    setPredios(p => p.map((x, idx) => idx === i ? { ...x, [k]: v } : x));

  const addLocal = () => {
    if (!localNomeCustom.trim()) return;
    setLocaisSel(l => [...l, { nome: localNomeCustom.trim(), predio_idx: localPredioIdx }]);
    setLocalNomeCustom("");
  };
  const removeLocal = (i: number) => setLocaisSel(l => l.filter((_, idx) => idx !== i));

  const resetar = () => {
    setEtapa(1);
    setUnidadeNome("Sede");
    setUnidadeTipo("sede");
    setUnidadeId(null);
    setPredios([{ nome: "Templo principal", tipo: "templo", logradouro: "", numero: "", bairro: "", cidade: "", cep: "" }]);
    setPredioIds([]);
    setLocaisSel([
      { nome: "Auditorio / Templo", predio_idx: 0 },
      { nome: "Sala infantil", predio_idx: 0 },
      { nome: "Cozinha", predio_idx: 0 },
    ]);
    setLocalNomeCustom("");
  };

  const concluir = () => {
    resetar();
    onOpenChange(false);
    onConcluido();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetar(); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b sticky top-0 bg-background z-10">
          <DialogTitle className="font-serif text-xl">Configurar estrutura fisica</DialogTitle>
          {/* Barra de progresso */}
          <div className="flex items-center gap-1 mt-3">
            {ETAPAS.map((e, i) => {
              const Icon = e.icon;
              const ativo = etapa === e.id;
              const concluido = etapa > e.id;
              return (
                <div key={e.id} className="flex items-center gap-1 flex-1">
                  <div className={cn(
                    "flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium flex-1 justify-center",
                    ativo && "bg-primary text-primary-foreground",
                    concluido && "bg-primary/10 text-primary",
                    !ativo && !concluido && "text-muted-foreground"
                  )}>
                    <Icon className="w-3.5 h-3.5" />
                    {e.label}
                  </div>
                  {i < ETAPAS.length - 1 && (
                    <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </DialogHeader>

        <div className="px-6 py-5 space-y-5">

          {/* ── ETAPA 1: Unidade ── */}
          {etapa === 1 && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
                <Lightbulb className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">O que e uma Unidade?</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Unidade e a divisao organizacional da sua igreja: a Sede, uma Congregacao, uma Missao.
                    Cada unidade pode ter varios predios em enderecos diferentes.
                  </p>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Tipo de unidade *</Label>
                <Select value={unidadeTipo} onValueChange={(v) => {
                  setUnidadeTipo(v as UnidadeTipo);
                  aplicarSugestoesPredios(v as UnidadeTipo);
                }}>
                  <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNIDADE_TIPOS.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Nome da unidade *</Label>
                <Input
                  value={unidadeNome}
                  onChange={e => setUnidadeNome(e.target.value)}
                  className="h-11"
                  placeholder="Ex: Sede Central, Congregacao Norte"
                />
              </div>
              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => { resetar(); onOpenChange(false); }}>
                  Cancelar
                </Button>
                <Button onClick={salvarUnidade} disabled={busy}>
                  {busy ? "Salvando..." : "Proximo: Predios →"}
                </Button>
              </div>
            </div>
          )}

          {/* ── ETAPA 2: Predios ── */}
          {etapa === 2 && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                <Building2 className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Predios e estruturas</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Cada predio e um endereco fisico separado. Voce pode adicionar quantos predios quiser.
                    O endereco e opcional agora e pode ser preenchido depois.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                {predios.map((p, i) => (
                  <div key={i} className="rounded-xl border border-border p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">Predio {i + 1}</span>
                      {predios.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removePredio(i)}
                          className="text-xs text-destructive hover:underline"
                        >
                          Remover
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Nome *</Label>
                        <Input value={p.nome} onChange={e => setPredioField(i, "nome", e.target.value)} className="h-9" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Tipo</Label>
                        <Select value={p.tipo} onValueChange={v => setPredioField(i, "tipo", v)}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {PREDIO_TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5 col-span-2">
                        <Label className="text-xs">Endereco (opcional)</Label>
                        <Input
                          value={p.logradouro}
                          onChange={e => setPredioField(i, "logradouro", e.target.value)}
                          className="h-9"
                          placeholder="Rua, Avenida..."
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Bairro</Label>
                        <Input value={p.bairro} onChange={e => setPredioField(i, "bairro", e.target.value)} className="h-9" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Cidade</Label>
                        <Input value={p.cidade} onChange={e => setPredioField(i, "cidade", e.target.value)} className="h-9" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Button type="button" variant="outline" size="sm" onClick={addPredio} className="w-full gap-2">
                <Plus className="w-4 h-4" /> Adicionar outro predio
              </Button>

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setEtapa(1)}>← Voltar</Button>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setEtapa(3)} disabled={busy}>Pular</Button>
                  <Button onClick={salvarPredios} disabled={busy}>
                    {busy ? "Salvando..." : "Proximo: Espacos →"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ── ETAPA 3: Locais ── */}
          {etapa === 3 && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                <LayoutGrid className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Espacos e salas</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Adicione os espacos internos de cada predio. Voce pode adicionar mais depois.
                  </p>
                </div>
              </div>

              {/* Sugestoes rapidas */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">Sugestoes rapidas:</p>
                <div className="flex flex-wrap gap-2">
                  {LOCAIS_SUGERIDOS.filter(s => !locaisSel.some(l => l.nome === s)).map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setLocaisSel(l => [...l, { nome: s, predio_idx: 0 }])}
                      className="px-3 py-1 rounded-full text-xs border border-dashed border-border hover:border-primary hover:text-primary transition-colors"
                    >
                      + {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Lista de locais selecionados */}
              <div className="space-y-2">
                {locaisSel.map((l, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 rounded-lg border border-border bg-muted/20">
                    <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="text-sm flex-1">{l.nome}</span>
                    {predios.length > 1 && (
                      <Select
                        value={String(l.predio_idx)}
                        onValueChange={v => setLocaisSel(ls => ls.map((x, idx) => idx === i ? { ...x, predio_idx: Number(v) } : x))}
                      >
                        <SelectTrigger className="h-7 w-36 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {predios.map((p, pi) => <SelectItem key={pi} value={String(pi)}>{p.nome || `Predio ${pi + 1}`}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                    <button type="button" onClick={() => removeLocal(i)} className="text-xs text-destructive px-1">✕</button>
                  </div>
                ))}
              </div>

              {/* Adicionar custom */}
              <div className="flex gap-2">
                <Input
                  value={localNomeCustom}
                  onChange={e => setLocalNomeCustom(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addLocal()}
                  placeholder="Nome do espaco personalizado..."
                  className="h-9 flex-1"
                />
                <Button type="button" size="sm" onClick={addLocal}>Adicionar</Button>
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="outline" onClick={() => setEtapa(2)}>← Voltar</Button>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setEtapa(4)} disabled={busy}>Pular</Button>
                  <Button onClick={salvarLocais} disabled={busy}>
                    {busy ? "Salvando..." : "Concluir →"}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ── ETAPA 4: Conclusao ── */}
          {etapa === 4 && (
            <div className="space-y-5 text-center py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-emerald-600" />
              </div>
              <div>
                <h3 className="font-serif text-xl font-semibold">Estrutura configurada!</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Sua estrutura fisica foi criada com sucesso.
                  Voce pode adicionar mais predios, espacos e detalhes a qualquer momento.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="rounded-xl border p-3 bg-muted/20">
                  <p className="text-2xl font-bold text-primary">1</p>
                  <p className="text-xs text-muted-foreground">Unidade criada</p>
                </div>
                <div className="rounded-xl border p-3 bg-muted/20">
                  <p className="text-2xl font-bold text-blue-600">{predioIds.length}</p>
                  <p className="text-xs text-muted-foreground">Predios</p>
                </div>
                <div className="rounded-xl border p-3 bg-muted/20">
                  <p className="text-2xl font-bold text-emerald-600">{locaisSel.length}</p>
                  <p className="text-xs text-muted-foreground">Espacos</p>
                </div>
              </div>
              <Button onClick={concluir} className="w-full h-11">
                Ver estrutura criada
              </Button>
            </div>
          )}

        </div>
      </DialogContent>
    </Dialog>
  );
}
