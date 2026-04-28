"use client";
import { useEffect, useState, useCallback } from "react";
import { Plus, Loader2, ChefHat, Edit2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/utils";

interface Cargo {
  id: string;
  nome: string;
  descricao?: string;
  salarioBase: number;
  departamento: string;
  _count: { funcionarios: number };
}

const deptColors: Record<string, string> = {
  Gestão: "bg-purple-100 text-purple-700",
  Cozinha: "bg-orange-100 text-orange-700",
  Salão: "bg-blue-100 text-blue-700",
  Financeiro: "bg-green-100 text-green-700",
  RH: "bg-pink-100 text-pink-700",
};

export function CargosContent() {
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Cargo | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ nome: "", descricao: "", salarioBase: "", departamento: "" });

  const fetchCargos = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/cargos");
    setCargos(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchCargos(); }, [fetchCargos]);

  function openEdit(c: Cargo) {
    setEditTarget(c);
    setForm({ nome: c.nome, descricao: c.descricao ?? "", salarioBase: String(c.salarioBase), departamento: c.departamento });
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const url = editTarget ? `/api/cargos/${editTarget.id}` : "/api/cargos";
      const method = editTarget ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!res.ok) { setError((await res.json()).error ?? "Erro"); return; }
      setModalOpen(false);
      fetchCargos();
    } catch { setError("Erro de conexão"); }
    finally { setSaving(false); }
  }

  const depts = [...new Set(cargos.map((c) => c.departamento))].sort();

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{cargos.length} cargos cadastrados</p>
        <Button onClick={() => { setEditTarget(null); setForm({ nome: "", descricao: "", salarioBase: "", departamento: "" }); setModalOpen(true); }}>
          <Plus size={16} /> Novo Cargo
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 size={24} className="animate-spin text-orange-500" />
        </div>
      ) : (
        <div className="space-y-6">
          {depts.map((dept) => (
            <div key={dept}>
              <div className="flex items-center gap-2 mb-3">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${deptColors[dept] ?? "bg-gray-100 text-gray-700"}`}>{dept}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {cargos.filter((c) => c.departamento === dept).map((c) => (
                  <Card key={c.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-orange-50 rounded-lg flex items-center justify-center">
                            <ChefHat size={16} className="text-orange-500" />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 text-sm">{c.nome}</p>
                            <p className="text-xs text-orange-600 font-medium">{formatCurrency(c.salarioBase)}/mês</p>
                          </div>
                        </div>
                        <Button size="icon" variant="ghost" onClick={() => openEdit(c)}>
                          <Edit2 size={13} />
                        </Button>
                      </div>
                      {c.descricao && <p className="text-xs text-gray-500 mb-2">{c.descricao}</p>}
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Users size={12} />
                        <span className="font-medium text-gray-700">{c._count.funcionarios}</span> funcionários
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editTarget ? "Editar Cargo" : "Novo Cargo"} size="sm">
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nome do Cargo *</label>
            <Input value={form.nome} onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))} required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Departamento *</label>
            <Input value={form.departamento} onChange={(e) => setForm((p) => ({ ...p, departamento: e.target.value }))} placeholder="Ex: Cozinha, Salão, Gestão..." required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Salário Base (R$) *</label>
            <Input type="number" step="0.01" value={form.salarioBase} onChange={(e) => setForm((p) => ({ ...p, salarioBase: e.target.value }))} required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Descrição</label>
            <Textarea value={form.descricao} onChange={(e) => setForm((p) => ({ ...p, descricao: e.target.value }))} rows={2} />
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
