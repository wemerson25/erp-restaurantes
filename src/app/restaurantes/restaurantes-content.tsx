"use client";
import { useEffect, useState, useCallback } from "react";
import { Plus, Loader2, Building2, Users, Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";

interface Restaurante {
  id: string;
  nome: string;
  cnpj: string;
  endereco: string;
  cidade: string;
  estado: string;
  telefone?: string;
  email?: string;
  ativo: boolean;
  _count: { funcionarios: number };
}

export function RestaurantesContent() {
  const [restaurantes, setRestaurantes] = useState<Restaurante[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Restaurante | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ nome: "", cnpj: "", endereco: "", cidade: "", estado: "SP", telefone: "", email: "" });

  const fetchRestaurantes = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/restaurantes");
    setRestaurantes(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchRestaurantes(); }, [fetchRestaurantes]);

  function openEdit(r: Restaurante) {
    setEditTarget(r);
    setForm({ nome: r.nome, cnpj: r.cnpj, endereco: r.endereco, cidade: r.cidade, estado: r.estado, telefone: r.telefone ?? "", email: r.email ?? "" });
    setModalOpen(true);
  }

  function openNew() {
    setEditTarget(null);
    setForm({ nome: "", cnpj: "", endereco: "", cidade: "", estado: "SP", telefone: "", email: "" });
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const url = editTarget ? `/api/restaurantes/${editTarget.id}` : "/api/restaurantes";
      const method = editTarget ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!res.ok) { setError((await res.json()).error ?? "Erro"); return; }
      setModalOpen(false);
      fetchRestaurantes();
    } catch { setError("Erro de conexão"); }
    finally { setSaving(false); }
  }

  const Label = ({ children }: { children: React.ReactNode }) => (
    <label className="block text-xs font-medium text-gray-600 mb-1">{children}</label>
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{restaurantes.filter((r) => r.ativo).length} unidades ativas</p>
        <Button onClick={openNew}><Plus size={16} /> Nova Unidade</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 size={24} className="animate-spin text-orange-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {restaurantes.map((r) => (
            <Card key={r.id} className={!r.ativo ? "opacity-60" : ""}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                      <Building2 size={20} className="text-orange-600" />
                    </div>
                    <div>
                      <CardTitle>{r.nome}</CardTitle>
                      <p className="text-xs text-gray-400">{r.cnpj}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge variant={r.ativo ? "success" : "secondary"}>{r.ativo ? "Ativa" : "Inativa"}</Badge>
                    <Button size="icon" variant="ghost" onClick={() => openEdit(r)}>
                      <Edit2 size={14} />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-gray-600">{r.endereco}</p>
                <p className="text-gray-500">{r.cidade} - {r.estado}</p>
                {r.telefone && <p className="text-gray-500">{r.telefone}</p>}
                {r.email && <p className="text-gray-500">{r.email}</p>}
                <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                  <Users size={14} className="text-gray-400" />
                  <span className="font-semibold text-orange-600">{r._count.funcionarios}</span>
                  <span className="text-gray-500">funcionários</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editTarget ? "Editar Restaurante" : "Nova Unidade"} size="md">
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Nome *</Label>
              <Input value={form.nome} onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))} required />
            </div>
            <div className="col-span-2">
              <Label>CNPJ *</Label>
              <Input value={form.cnpj} onChange={(e) => setForm((p) => ({ ...p, cnpj: e.target.value }))} placeholder="00.000.000/0001-00" required />
            </div>
            <div className="col-span-2">
              <Label>Endereço *</Label>
              <Input value={form.endereco} onChange={(e) => setForm((p) => ({ ...p, endereco: e.target.value }))} required />
            </div>
            <div>
              <Label>Cidade *</Label>
              <Input value={form.cidade} onChange={(e) => setForm((p) => ({ ...p, cidade: e.target.value }))} required />
            </div>
            <div>
              <Label>Estado</Label>
              <Input value={form.estado} onChange={(e) => setForm((p) => ({ ...p, estado: e.target.value }))} maxLength={2} />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={form.telefone} onChange={(e) => setForm((p) => ({ ...p, telefone: e.target.value }))} />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
            </div>
          </div>
          {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>}
          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 size={14} className="animate-spin" />}
              {editTarget ? "Salvar" : "Cadastrar"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
