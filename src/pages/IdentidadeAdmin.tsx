import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Church, Pencil, Plus, Trash2, Save, Loader2, Heart,
} from "lucide-react";
import { toast } from "sonner";

interface Identidade {
  id: string;
  nome_igreja: string;
  cnpj: string | null;
  missao: string | null;
  visao: string | null;
  fundada_em: string | null;
  logo_url: string | null;
  slug: string | null;
  ativa: boolean;
}

interface Valor {
  id: string;
  valor: string;
  descricao: string | null;
  icone: string | null;
  ordem: number;
  ativo: boolean;
}

export default function IdentidadeAdmin() {
  const { hasRole } = useAuth();
  const navigate = useNavigate();

  const [identidade, setIdentidade] = useState<Identidade | null>(null);
  const [valores, setValores] = useState<Valor[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [formId, setFormId] = useState<Partial<Identidade>>({});
  const [editingId, setEditingId] = useState(false);

  const [valorOpen, setValorOpen] = useState(false);
  const [editingValorId, setEditingValorId] = useState<string | null>(null);
  const emptyValor = { valor: "", descricao: "", icone: "", ordem: 0, ativo: true };
  const [formValor, setFormValor] = useState<any>(emptyValor);

  useEffect(() => {
    if (!hasRole(["admin", "secretaria"])) navigate("/", { replace: true });
  }, []);

  const load = async () => {
    setLoading(true);
    const [{ data: id }, { data: vals }] = await Promise.all([
      supabase.from("identidade_igreja").select("*").eq("ativa", true).maybeSingle(),
      supabase.from("valores_igreja").select("*").order("ordem"),
    ]);
    setIdentidade(id ?? null);
    setFormId(id ?? {});
    setValores((vals ?? []) as Valor[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  /* ── Salvar identidade ── */
  const salvarIdentidade = async () => {
    setSaving(true);
    const payload: any = { ...formId };
    Object.keys(payload).forEach(k => { if (payload[k] === "") payload[k] = null; });
    let error;
    if (identidade?.id) {
      ({ error } = await supabase.from("identidade_igreja").update(payload).eq("id", identidade.id));
    } else {
      ({ error } = await supabase.from("identidade_igreja").insert({ ...payload, ativa: true }));
    }
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Identidade salva com sucesso");
    setEditingId(false);
    load();
  };

  /* ── Salvar valor ── */
  const salvarValor = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = { ...formValor };
    Object.keys(payload).forEach(k => { if (payload[k] === "") payload[k] = null; });
    let error;
    if (editingValorId) {
      ({ error } = await supabase.from("valores_igreja").update(payload).eq("id", editingValorId));
    } else {
      ({ error } = await supabase.from("valores_igreja").insert(payload));
    }
    if (error) return toast.error(error.message);
    toast.success(editingValorId ? "Valor atualizado" : "Valor adicionado");
    setValorOpen(false);
    setEditingValorId(null);
    setFormValor(emptyValor);
    load();
  };

  const startEditValor = (v: Valor) => {
    setEditingValorId(v.id);
    setFormValor({ valor: v.valor, descricao: v.descricao ?? "", icone: v.icone ?? "", ordem: v.ordem, ativo: v.ativo });
    setValorOpen(true);
  };

  const excluirValor = async (id: string) => {
    const { error } = await supabase.from("valores_igreja").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Valor removido");
    load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando…
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Identidade da Igreja"
        description="Missão, visão, valores e dados institucionais"
        actions={
          <Button onClick={() => setEditingId(true)}>
            <Pencil className="w-4 h-4 mr-2" /> Editar identidade
          </Button>
        }
      />

      <div className="p-4 md:p-8 space-y-6">
        {/* ── Dados principais ── */}
        <Card className="shadow-card-soft">
          <CardHeader className="pb-3">
            <CardTitle className="font-serif flex items-center gap-2 text-lg">
              <Church className="w-4 h-4 text-gold" /> Dados da Igreja
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {identidade ? (
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Nome</p>
                  <p className="font-medium">{identidade.nome_igreja}</p>
                </div>
                {identidade.cnpj && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">CNPJ</p>
                    <p className="font-medium">{identidade.cnpj}</p>
                  </div>
                )}
                {identidade.fundada_em && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Fundada em</p>
                    <p className="font-medium">
                      {new Date(identidade.fundada_em).toLocaleDateString("pt-BR", { year: "numeric", month: "long", day: "numeric" })}
                    </p>
                  </div>
                )}
                {identidade.slug && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Slug</p>
                    <Badge variant="outline">{identidade.slug}</Badge>
                  </div>
                )}
                {identidade.missao && (
                  <div className="md:col-span-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Missão</p>
                    <p className="text-sm leading-relaxed border-l-2 border-gold/40 pl-3">{identidade.missao}</p>
                  </div>
                )}
                {identidade.visao && (
                  <div className="md:col-span-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Visão</p>
                    <p className="text-sm leading-relaxed border-l-2 border-primary/40 pl-3">{identidade.visao}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Church className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Nenhuma identidade cadastrada ainda.</p>
                <Button className="mt-3" onClick={() => setEditingId(true)}>
                  <Plus className="w-4 h-4 mr-2" /> Cadastrar agora
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Valores ── */}
        <Card className="shadow-card-soft">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="font-serif flex items-center gap-2 text-lg">
              <Heart className="w-4 h-4 text-gold" /> Valores Institucionais
            </CardTitle>
            <Button size="sm" variant="outline" onClick={() => { setEditingValorId(null); setFormValor(emptyValor); setValorOpen(true); }}>
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Novo valor
            </Button>
          </CardHeader>
          <CardContent>
            {valores.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum valor cadastrado.</p>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
                {valores.map((v) => (
                  <div key={v.id} className={`rounded-lg border p-3 flex items-start gap-2 ${v.ativo ? "" : "opacity-50"}`}>
                    {v.icone && <span className="text-xl">{v.icone}</span>}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{v.valor}</p>
                      {v.descricao && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{v.descricao}</p>}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => startEditValor(v)} className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted">
                        <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                      <button onClick={() => excluirValor(v.id)} className="w-7 h-7 flex items-center justify-center rounded hover:bg-destructive/10">
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Dialog identidade ── */}
      <Dialog open={editingId} onOpenChange={(o) => { setEditingId(o); if (!o) setFormId(identidade ?? {}); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">
              {identidade ? "Editar identidade" : "Cadastrar identidade"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome da Igreja *</Label>
              <Input
                required
                value={formId.nome_igreja ?? ""}
                onChange={(e) => setFormId({ ...formId, nome_igreja: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>CNPJ</Label>
                <Input value={formId.cnpj ?? ""} onChange={(e) => setFormId({ ...formId, cnpj: e.target.value })} placeholder="00.000.000/0001-00" />
              </div>
              <div>
                <Label>Fundada em</Label>
                <Input type="date" value={formId.fundada_em ?? ""} onChange={(e) => setFormId({ ...formId, fundada_em: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Missão</Label>
              <Textarea
                rows={2}
                placeholder="A missão da igreja é…"
                value={formId.missao ?? ""}
                onChange={(e) => setFormId({ ...formId, missao: e.target.value })}
              />
            </div>
            <div>
              <Label>Visão</Label>
              <Textarea
                rows={2}
                placeholder="Nossa visão é ser…"
                value={formId.visao ?? ""}
                onChange={(e) => setFormId({ ...formId, visao: e.target.value })}
              />
            </div>
            <div>
              <Label>Slug (URL amigável)</Label>
              <Input
                value={formId.slug ?? ""}
                onChange={(e) => setFormId({ ...formId, slug: e.target.value })}
                placeholder="qibrj"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingId(false)}>Cancelar</Button>
            <Button onClick={salvarIdentidade} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog valor ── */}
      <Dialog open={valorOpen} onOpenChange={(o) => { setValorOpen(o); if (!o) { setEditingValorId(null); setFormValor(emptyValor); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">{editingValorId ? "Editar valor" : "Novo valor"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={salvarValor} className="space-y-3">
            <div className="grid grid-cols-4 gap-3">
              <div>
                <Label>Ícone</Label>
                <Input value={formValor.icone} onChange={(e) => setFormValor({ ...formValor, icone: e.target.value })} placeholder="❤️" />
              </div>
              <div className="col-span-3">
                <Label>Valor *</Label>
                <Input required value={formValor.valor} onChange={(e) => setFormValor({ ...formValor, valor: e.target.value })} placeholder="Amor, Fé, Serviço…" />
              </div>
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea rows={2} value={formValor.descricao} onChange={(e) => setFormValor({ ...formValor, descricao: e.target.value })} />
            </div>
            <div>
              <Label>Ordem</Label>
              <Input type="number" min={0} value={formValor.ordem} onChange={(e) => setFormValor({ ...formValor, ordem: Number(e.target.value) })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setValorOpen(false)}>Cancelar</Button>
              <Button type="submit">{editingValorId ? "Atualizar" : "Salvar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
