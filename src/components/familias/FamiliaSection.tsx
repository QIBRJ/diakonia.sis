import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Home, Plus, X, Crown, Search, Users, Loader2, ChevronDown, ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { parentescoOptions, parentescoLabel } from "./VinculosDialog";
import { cn } from "@/lib/utils";

// ── Tipos ─────────────────────────────────────────────────────────────────
interface Familia {
  id: string;
  nome_familia: string;
}

interface MembroVinculo {
  id: string;
  membro_id: string;
  parentesco: string;
  responsavel_familia: boolean;
  membro?: { id: string; nome_completo: string } | null;
}

interface Props {
  /** ID da pessoa que está sendo editada/criada (null = ainda não salva) */
  pessoaId: string | null;
  /** Nome da pessoa — usado para sugerir família ao criar nova */
  pessoaNome?: string;
  /** Apenas leitura (sem permissão de edição) */
  readOnly?: boolean;
  /** Callback chamado quando qualquer dado de vínculo muda */
  onChange?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente
// ─────────────────────────────────────────────────────────────────────────────
export function FamiliaSection({ pessoaId, pessoaNome, readOnly, onChange }: Props) {
  // ── Vínculo atual desta pessoa ──────────────────────────────────────────
  const [vinculo, setVinculo] = useState<MembroVinculo | null>(null);
  const [familia, setFamilia] = useState<Familia | null>(null);
  const [membrosNucleo, setMembrosNucleo] = useState<MembroVinculo[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);

  // ── Busca de família ────────────────────────────────────────────────────
  const [busca, setBusca] = useState("");
  const [sugestoes, setSugestoes] = useState<Familia[]>([]);
  const [buscando, setBuscando] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showDrop, setShowDrop] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  // ── Papel / parentesco ──────────────────────────────────────────────────
  const [papel, setPapel] = useState("filho");

  // ── Criar nova família inline ───────────────────────────────────────────
  const [criandoNova, setCriandoNova] = useState(false);
  const [nomeFamiliaNova, setNomeFamiliaNova] = useState("");
  const [salvandoNova, setSalvandoNova] = useState(false);

  // ── Adicionar membros ao núcleo ─────────────────────────────────────────
  const [adicionandoMembro, setAdicionandoMembro] = useState(false);
  const [buscaMembro, setBuscaMembro] = useState("");
  const [resultadosMembro, setResultadosMembro] = useState<{ id: string; nome_completo: string }[]>([]);
  const [buscandoMembro, setBuscandoMembro] = useState(false);
  const [papelNovo, setPapelNovo] = useState("filho");
  const debounceMembroRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Fechar dropdown ao clicar fora ────────────────────────────────────
  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setShowDrop(false);
      }
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  // ─── Carregar vínculo existente ─────────────────────────────────────────
  const load = async () => {
    if (!pessoaId) return;
    setLoading(true);
    const { data: vs } = await supabase
      .from("vinculos_familiares" as any)
      .select("id, membro_id, familia_id, parentesco, responsavel_familia, familia:familias(id, nome_familia)")
      .eq("membro_id", pessoaId)
      .maybeSingle();

    if (vs) {
      const v = vs as any;
      setVinculo({ id: v.id, membro_id: v.membro_id, parentesco: v.parentesco, responsavel_familia: v.responsavel_familia });
      setFamilia(v.familia ?? null);
      setPapel(v.parentesco);
      // Carregar membros do núcleo
      const { data: membros } = await supabase
        .from("vinculos_familiares" as any)
        .select("id, membro_id, parentesco, responsavel_familia, membro:membros(id, nome_completo)")
        .eq("familia_id", v.familia_id);
      setMembrosNucleo(((membros ?? []) as any[]) as MembroVinculo[]);
    } else {
      setVinculo(null);
      setFamilia(null);
      setMembrosNucleo([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (pessoaId) load();
    else { setVinculo(null); setFamilia(null); setMembrosNucleo([]); }
  }, [pessoaId]);

  // ─── Busca de famílias (debounced) ──────────────────────────────────────
  const buscarFamilias = (q: string) => {
    setBusca(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) { setSugestoes([]); setShowDrop(false); return; }
    debounceRef.current = setTimeout(async () => {
      setBuscando(true);
      const { data } = await supabase
        .from("familias")
        .select("id, nome_familia")
        .ilike("nome_familia", `%${q}%`)
        .order("nome_familia")
        .limit(8);
      setSugestoes((data ?? []) as Familia[]);
      setShowDrop(true);
      setBuscando(false);
    }, 300);
  };

  // ─── Vincular a família existente ───────────────────────────────────────
  const vincularFamilia = async (f: Familia) => {
    if (!pessoaId) return toast.error("Salve a pessoa antes de vincular a uma família");
    setBusca(f.nome_familia);
    setSugestoes([]);
    setShowDrop(false);

    // Se já tem vínculo, remove primeiro
    if (vinculo) {
      await supabase.from("vinculos_familiares" as any).delete().eq("id", vinculo.id);
    }

    const isFirst = (await supabase
      .from("vinculos_familiares" as any)
      .select("id", { count: "exact", head: true })
      .eq("familia_id", f.id)).count === 0;

    const { error } = await supabase.from("vinculos_familiares" as any).insert({
      familia_id: f.id,
      membro_id: pessoaId,
      parentesco: papel,
      responsavel_familia: isFirst,
    });
    if (error) return toast.error(error.message);
    toast.success(`Vinculado à Família ${f.nome_familia}`);
    setBusca("");
    await load();
    onChange?.();
  };

  // ─── Criar família nova inline ──────────────────────────────────────────
  const criarFamiliaInline = async () => {
    const nome = nomeFamiliaNova.trim().replace(/^\s*fam[íi]lia\s+/i, "");
    if (!nome) return toast.error("Informe o sobrenome da família");
    if (!pessoaId) return toast.error("Salve a pessoa antes de criar a família");
    setSalvandoNova(true);

    // Criar família
    const { data: nova, error: e1 } = await supabase
      .from("familias")
      .insert({ nome_familia: nome })
      .select("id, nome_familia")
      .single();
    if (e1 || !nova) { setSalvandoNova(false); return toast.error(e1?.message ?? "Erro ao criar família"); }

    // Se já tinha vínculo, remove
    if (vinculo) await supabase.from("vinculos_familiares" as any).delete().eq("id", vinculo.id);

    // Vincular automaticamente como responsável
    const { error: e2 } = await supabase.from("vinculos_familiares" as any).insert({
      familia_id: (nova as any).id,
      membro_id: pessoaId,
      parentesco: papel,
      responsavel_familia: true,
    });
    if (e2) { setSalvandoNova(false); return toast.error(e2.message); }

    toast.success(`Família ${nome} criada e vinculada!`);
    setNomeFamiliaNova("");
    setCriandoNova(false);
    setSalvandoNova(false);
    setBusca("");
    await load();
    onChange?.();
  };

  // ─── Atualizar papel ────────────────────────────────────────────────────
  const atualizarPapel = async (novoPapel: string) => {
    setPapel(novoPapel);
    if (!vinculo) return;
    const { error } = await supabase
      .from("vinculos_familiares" as any)
      .update({ parentesco: novoPapel })
      .eq("id", vinculo.id);
    if (error) toast.error(error.message);
    else onChange?.();
  };

  // ─── Remover vínculo ────────────────────────────────────────────────────
  const removerVinculo = async () => {
    if (!vinculo) return;
    const { error } = await supabase.from("vinculos_familiares" as any).delete().eq("id", vinculo.id);
    if (error) return toast.error(error.message);
    toast.success("Vínculo removido");
    setVinculo(null); setFamilia(null); setMembrosNucleo([]);
    setBusca(""); setPapel("filho");
    onChange?.();
  };

  // ─── Buscar membro para adicionar ao núcleo ─────────────────────────────
  const buscarMembro = (q: string) => {
    setBuscaMembro(q);
    if (debounceMembroRef.current) clearTimeout(debounceMembroRef.current);
    if (!q.trim()) { setResultadosMembro([]); return; }
    debounceMembroRef.current = setTimeout(async () => {
      setBuscandoMembro(true);
      const jaIds = membrosNucleo.map(m => m.membro_id).concat(pessoaId ? [pessoaId] : []);
      const { data } = await supabase
        .from("membros")
        .select("id, nome_completo")
        .ilike("nome_completo", `%${q}%`)
        .not("id", "in", `(${jaIds.join(",") || "null"})`)
        .order("nome_completo")
        .limit(8);
      setResultadosMembro((data ?? []) as any[]);
      setBuscandoMembro(false);
    }, 300);
  };

  // ─── Adicionar membro ao núcleo ─────────────────────────────────────────
  const adicionarAoNucleo = async (pessoa: { id: string; nome_completo: string }) => {
    if (!familia) return;
    const { error } = await supabase.from("vinculos_familiares" as any).insert({
      familia_id: familia.id,
      membro_id: pessoa.id,
      parentesco: papelNovo,
      responsavel_familia: false,
    });
    if (error) return toast.error(error.message);
    toast.success(`${pessoa.nome_completo.split(" ")[0]} adicionado(a) ao núcleo`);
    setBuscaMembro(""); setResultadosMembro([]);
    await load();
    onChange?.();
  };

  // ─── Remover membro do núcleo ────────────────────────────────────────────
  const removerDoNucleo = async (vinculoId: string, nome: string) => {
    const { error } = await supabase.from("vinculos_familiares" as any).delete().eq("id", vinculoId);
    if (error) return toast.error(error.message);
    toast.success(`${nome} removido(a) do núcleo`);
    await load();
    onChange?.();
  };

  // ─── Definir responsável ─────────────────────────────────────────────────
  const definirResponsavel = async (vinculoId: string) => {
    if (!familia) return;
    await supabase.from("vinculos_familiares" as any).update({ responsavel_familia: false }).eq("familia_id", familia.id);
    await supabase.from("vinculos_familiares" as any).update({ responsavel_familia: true }).eq("id", vinculoId);
    toast.success("Responsável atualizado");
    await load();
    onChange?.();
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* ── Header da seção ── */}
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors text-left"
      >
        <div className="w-8 h-8 rounded-lg bg-gold/15 flex items-center justify-center shrink-0">
          <Home className="w-4 h-4 text-gold" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">Família</p>
          <p className="text-xs text-muted-foreground truncate">
            {loading ? "Carregando…" : familia ? `Família ${familia.nome_familia} · ${membrosNucleo.length} membros` : "Sem família vinculada"}
          </p>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-border/60 pt-4">

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
            </div>
          ) : familia ? (
            /* ── Família vinculada — mostrar info + membros ── */
            <div className="space-y-3">
              {/* Card da família */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border/60">
                <div className="w-10 h-10 rounded-lg bg-gold/15 flex items-center justify-center shrink-0">
                  <Home className="w-5 h-5 text-gold" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">Família {familia.nome_familia}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Users className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{membrosNucleo.length} membros no núcleo</span>
                  </div>
                </div>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={removerVinculo}
                    className="w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                    title="Remover vínculo"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Papel nesta família */}
              {!readOnly && (
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground w-28 shrink-0">Papel na família</Label>
                  <Select value={papel} onValueChange={atualizarPapel}>
                    <SelectTrigger className="flex-1 h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {parentescoOptions.map(p => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Membros do núcleo */}
              {membrosNucleo.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Membros do núcleo</p>
                  {membrosNucleo.map(m => (
                    <div key={m.id} className="flex items-center gap-2 p-2 rounded-lg border border-border/60 bg-background">
                      <div className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-serif flex items-center justify-center shrink-0">
                        {(m.membro?.nome_completo ?? "?").split(" ").slice(0,2).map(n => n[0]).join("")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{m.membro?.nome_completo ?? "—"}</p>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                            {parentescoLabel[m.parentesco] ?? m.parentesco}
                          </Badge>
                          {m.responsavel_familia && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-gold/10 text-gold border-gold/30">
                              <Crown className="w-2.5 h-2.5 mr-0.5" /> Responsável
                            </Badge>
                          )}
                        </div>
                      </div>
                      {!readOnly && (
                        <div className="flex gap-0.5 shrink-0">
                          {!m.responsavel_familia && (
                            <button
                              type="button"
                              onClick={() => definirResponsavel(m.id)}
                              className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:text-gold hover:bg-gold/10 transition-colors"
                              title="Tornar responsável"
                            >
                              <Crown className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {m.membro_id !== pessoaId && (
                            <button
                              type="button"
                              onClick={() => removerDoNucleo(m.id, m.membro?.nome_completo ?? "Pessoa")}
                              className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                              title="Remover do núcleo"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Adicionar membro ao núcleo */}
              {!readOnly && (
                !adicionandoMembro ? (
                  <button
                    type="button"
                    onClick={() => setAdicionandoMembro(true)}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-muted/30 transition-colors"
                  >
                    <Plus className="w-4 h-4" /> Adicionar pessoa ao núcleo
                  </button>
                ) : (
                  <div className="rounded-lg border border-border p-3 space-y-2 bg-muted/20">
                    <p className="text-xs font-medium text-muted-foreground">Adicionar ao núcleo familiar</p>
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                        <Input
                          autoFocus
                          className="pl-8 h-9 text-sm"
                          placeholder="Buscar por nome…"
                          value={buscaMembro}
                          onChange={e => buscarMembro(e.target.value)}
                        />
                      </div>
                      <Select value={papelNovo} onValueChange={setPapelNovo}>
                        <SelectTrigger className="w-36 h-9 text-sm shrink-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {parentescoOptions.map(p => (
                            <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <button
                        type="button"
                        onClick={() => { setAdicionandoMembro(false); setBuscaMembro(""); setResultadosMembro([]); }}
                        className="w-9 h-9 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    {buscandoMembro && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground py-1">
                        <Loader2 className="w-3 h-3 animate-spin" /> Buscando…
                      </div>
                    )}
                    {resultadosMembro.length > 0 && (
                      <div className="border rounded-lg divide-y divide-border/60 bg-background overflow-hidden">
                        {resultadosMembro.map(p => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => adicionarAoNucleo(p)}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-muted/60 flex items-center gap-2 transition-colors"
                          >
                            <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-[10px] font-serif flex items-center justify-center shrink-0">
                              {p.nome_completo.split(" ").slice(0,2).map(n => n[0]).join("")}
                            </div>
                            {p.nome_completo}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
          ) : (
            /* ── Sem família — opções para vincular ou criar ── */
            <div className="space-y-3">
              {!readOnly && !criandoNova && (
                <>
                  {/* Papel antes de vincular */}
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground w-28 shrink-0">Papel na família</Label>
                    <Select value={papel} onValueChange={setPapel}>
                      <SelectTrigger className="flex-1 h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {parentescoOptions.map(p => (
                          <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Busca de família existente */}
                  <div className="relative" ref={dropRef}>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        className="pl-9 h-10"
                        placeholder="Buscar família existente…"
                        value={busca}
                        onChange={e => buscarFamilias(e.target.value)}
                        onFocus={() => busca && setShowDrop(true)}
                      />
                      {buscando && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
                    </div>
                    {showDrop && (
                      <div className="absolute z-50 w-full mt-1 rounded-lg border border-border bg-background shadow-[var(--shadow-elevated)] overflow-hidden">
                        {sugestoes.length === 0 ? (
                          <div className="px-3 py-3 text-sm text-muted-foreground">Nenhuma família encontrada</div>
                        ) : (
                          sugestoes.map(f => (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => vincularFamilia(f)}
                              className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted/60 flex items-center gap-2 border-b last:border-0 transition-colors"
                            >
                              <Home className="w-3.5 h-3.5 text-gold shrink-0" />
                              Família {f.nome_familia}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {/* Criar nova família */}
                  <button
                    type="button"
                    onClick={() => {
                      setCriandoNova(true);
                      const sobrenome = pessoaNome?.split(" ").pop() ?? "";
                      setNomeFamiliaNova(sobrenome);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-muted/30 transition-colors"
                  >
                    <Plus className="w-4 h-4" /> Criar nova família
                  </button>
                </>
              )}

              {/* Formulário de criar nova família */}
              {!readOnly && criandoNova && (
                <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Nova família</p>
                    <button type="button" onClick={() => setCriandoNova(false)} className="text-muted-foreground hover:text-foreground">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs">Sobrenome da família *</Label>
                      <Input
                        autoFocus
                        className="mt-1 h-10"
                        placeholder="Ex.: Barreto"
                        value={nomeFamiliaNova}
                        onChange={e => setNomeFamiliaNova(e.target.value.replace(/^\s*fam[íi]lia\s+/i, ""))}
                      />
                      <p className="text-[11px] text-muted-foreground mt-0.5">Não inclua "Família" — exibido automaticamente.</p>
                    </div>

                    <div>
                      <Label className="text-xs">Papel desta pessoa</Label>
                      <Select value={papel} onValueChange={setPapel}>
                        <SelectTrigger className="mt-1 h-9 text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {parentescoOptions.map(p => (
                            <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      type="button" variant="outline" size="sm" className="flex-1"
                      onClick={() => { setCriandoNova(false); setNomeFamiliaNova(""); }}
                      disabled={salvandoNova}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="button" size="sm" className="flex-1 gap-1.5"
                      onClick={criarFamiliaInline}
                      disabled={salvandoNova || !nomeFamiliaNova.trim()}
                    >
                      {salvandoNova ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                      {salvandoNova ? "Criando…" : "Criar e vincular"}
                    </Button>
                  </div>
                </div>
              )}

              {readOnly && (
                <p className="text-sm text-muted-foreground text-center py-3 border rounded-lg">
                  Sem família vinculada.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
