import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Plus, Home, Users, Trash2, Crown, Search, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { VinculosDialog } from "@/components/familias/VinculosDialog";
import { parentescoLabel } from "@/components/familias/VinculosDialog";
import { ListSkeleton, EmptyState, ErrorState } from "@/components/ListState";

interface Familia {
  id: string;
  nome_familia: string;
  bairro: string | null;
  cidade: string | null;
  endereco: string | null;
  observacoes: string | null;
}

interface MembroVinculo {
  id: string;
  membro_id: string;
  parentesco: string;
  responsavel_familia: boolean;
  membro?: { id: string; nome_completo: string } | null;
}

// ── Card de família com membros inline ────────────────────────────────────
function FamiliaCard({
  familia,
  canEdit,
  onManageVinculos,
  onExcluir,
}: {
  familia: Familia;
  canEdit: boolean;
  onManageVinculos: (f: Familia) => void;
  onExcluir: (f: Familia) => void;
}) {
  const [membros, setMembros] = useState<MembroVinculo[]>([]);
  const [loadingMembros, setLoadingMembros] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setLoadingMembros(true);
    supabase
      .from("vinculos_familiares" as any)
      .select("id, membro_id, parentesco, responsavel_familia, membro:membros(id, nome_completo)")
      .eq("familia_id", familia.id)
      .then(({ data }) => {
        // Sort: responsável primeiro
        const list = ((data ?? []) as any[]) as MembroVinculo[];
        list.sort((a, b) => (b.responsavel_familia ? 1 : 0) - (a.responsavel_familia ? 1 : 0));
        setMembros(list);
        setLoadingMembros(false);
      });
  }, [familia.id]);

  const responsavel = membros.find(m => m.responsavel_familia);

  return (
    <div className="bg-card border border-border rounded-xl shadow-[var(--shadow-card)] overflow-hidden">
      {/* ── Cabeçalho ── */}
      <div className="flex items-center gap-3 p-4">
        <div className="w-11 h-11 rounded-xl bg-gold/15 flex items-center justify-center shrink-0">
          <Home className="w-5 h-5 text-gold" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-serif text-lg leading-tight">Família {familia.nome_familia}</h3>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {responsavel && (
              <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                <Crown className="w-3 h-3 text-gold" />
                {responsavel.membro?.nome_completo?.split(" ")[0]}
              </span>
            )}
            {familia.cidade && (
              <span className="text-xs text-muted-foreground">· {familia.cidade}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <div className="flex items-center gap-1 text-xs text-muted-foreground px-2">
            <Users className="w-3.5 h-3.5" />
            <span>{loadingMembros ? "…" : membros.length}</span>
          </div>
          <button
            onClick={() => setExpanded(v => !v)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted/60 transition-colors"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* ── Membros expandidos ── */}
      {expanded && (
        <div className="border-t border-border/60 px-4 py-3 space-y-2">
          {loadingMembros ? (
            <p className="text-xs text-muted-foreground">Carregando membros…</p>
          ) : membros.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">Nenhum membro vinculado ainda.</p>
          ) : (
            membros.map(m => (
              <div key={m.id} className="flex items-center gap-2.5 py-1.5">
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary text-xs font-serif flex items-center justify-center shrink-0">
                  {(m.membro?.nome_completo ?? "?").split(" ").slice(0, 2).map(n => n[0]).join("")}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{m.membro?.nome_completo ?? "—"}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                    {parentescoLabel[m.parentesco] ?? m.parentesco}
                  </Badge>
                  {m.responsavel_familia && (
                    <Crown className="w-3 h-3 text-gold" title="Responsável" />
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Ações ── */}
      <div className="flex border-t border-border/60 divide-x divide-border/60">
        <button
          onClick={() => onManageVinculos(familia)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
        >
          <Users className="w-3.5 h-3.5" /> Gerenciar membros
        </button>
        {canEdit && (
          <button
            onClick={() => onExcluir(familia)}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs text-destructive/70 hover:text-destructive hover:bg-destructive/5 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────
export default function Familias() {
  const { canEdit } = useAuth();
  const [familias, setFamilias] = useState<Familia[]>([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ nome_familia: "", endereco: "", bairro: "", cidade: "", observacoes: "" });
  const [vinculosOpen, setVinculosOpen] = useState(false);
  const [familiaSelecionada, setFamiliaSelecionada] = useState<Familia | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [familiaParaExcluir, setFamiliaParaExcluir] = useState<Familia | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  useEffect(() => {
    if (searchParams.get("novo") === "1" && canEdit) {
      setOpen(true);
      searchParams.delete("novo");
      searchParams.delete("t");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, canEdit, setSearchParams]);

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("familias")
      .select("id, nome_familia, bairro, cidade, endereco, observacoes")
      .order("nome_familia");
    if (error) { toast.error(error.message); setError(error.message); }
    setFamilias((data ?? []) as Familia[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = familias.filter(f =>
    !search || f.nome_familia.toLowerCase().includes(search.toLowerCase()) ||
    (f.cidade ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = { ...form };
    payload.nome_familia = (payload.nome_familia ?? "").replace(/^\s*fam[íi]lia\s+/i, "").trim();
    if (!payload.nome_familia) return toast.error("Informe o sobrenome da família.");
    Object.keys(payload).forEach(k => { if (payload[k] === "") payload[k] = null; });
    const { error } = await supabase.from("familias").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Família criada");
    setForm({ nome_familia: "", endereco: "", bairro: "", cidade: "", observacoes: "" });
    setOpen(false);
    load();
  };

  const confirmarExclusao = async () => {
    if (!familiaParaExcluir) return;
    setExcluindo(true);
    try {
      await supabase.from("membros").update({ familia_id: null }).eq("familia_id", familiaParaExcluir.id);
      await supabase.from("vinculos_familiares").delete().eq("familia_id", familiaParaExcluir.id);
      const { error } = await supabase.from("familias").delete().eq("id", familiaParaExcluir.id);
      if (error) { toast.error("Erro ao excluir: " + error.message); return; }
      toast.success(`Família ${familiaParaExcluir.nome_familia} excluída`);
      setFamiliaParaExcluir(null);
      load();
    } finally {
      setExcluindo(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Famílias"
        description={`${familias.length} núcleos familiares`}
        actions={
          canEdit && (
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" /> Nova família
            </Button>
          )
        }
      />

      <div className="p-4 md:p-8 space-y-4">
        {/* Busca */}
        {familias.length > 3 && (
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9 h-10"
              placeholder="Buscar família ou cidade…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        )}

        {loading ? (
          <ListSkeleton count={4} />
        ) : error ? (
          <ErrorState onRetry={load} />
        ) : filtered.length === 0 ? (
          <EmptyState message="Nenhuma família encontrada" />
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(f => (
              <FamiliaCard
                key={f.id}
                familia={f}
                canEdit={canEdit}
                onManageVinculos={fam => { setFamiliaSelecionada(fam); setVinculosOpen(true); }}
                onExcluir={fam => setFamiliaParaExcluir(fam)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Dialog: Nova família */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Nova família</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <Label>Sobrenome da família *</Label>
              <Input
                required autoFocus
                placeholder="Ex.: Barreto"
                className="mt-1"
                value={form.nome_familia}
                onChange={e => setForm({ ...form, nome_familia: e.target.value.replace(/^\s*fam[íi]lia\s+/i, "") })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Não inclua "Família" — exibido automaticamente.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Bairro</Label>
                <Input className="mt-1" value={form.bairro} onChange={e => setForm({ ...form, bairro: e.target.value })} />
              </div>
              <div>
                <Label>Cidade</Label>
                <Input className="mt-1" value={form.cidade} onChange={e => setForm({ ...form, cidade: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Endereço</Label>
              <Input className="mt-1" value={form.endereco} onChange={e => setForm({ ...form, endereco: e.target.value })} />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea className="mt-1" rows={2} value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit">Criar família</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Confirmar exclusão */}
      <Dialog open={!!familiaParaExcluir} onOpenChange={v => { if (!v) setFamiliaParaExcluir(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif text-xl text-destructive">Excluir núcleo familiar</DialogTitle>
            <DialogDescription className="pt-2">
              Tem certeza que deseja excluir a <strong>Família {familiaParaExcluir?.nome_familia}</strong>?
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800 mt-1">
            ⚠️ Os membros <strong>não serão excluídos</strong> — apenas os vínculos serão removidos.
          </div>
          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" onClick={() => setFamiliaParaExcluir(null)} disabled={excluindo}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmarExclusao} disabled={excluindo}>
              {excluindo ? "Excluindo…" : "Excluir família"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Vínculos */}
      <VinculosDialog
        open={vinculosOpen}
        onOpenChange={v => { setVinculosOpen(v); if (!v) load(); }}
        familiaId={familiaSelecionada?.id ?? null}
        familiaNome={familiaSelecionada?.nome_familia}
      />
    </div>
  );
}
