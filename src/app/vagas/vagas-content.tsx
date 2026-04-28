"use client";
import { useEffect, useState, useCallback } from "react";
import { Plus, Loader2, Briefcase, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatDate } from "@/lib/utils";

interface Vaga {
  id: string;
  titulo: string;
  descricao: string;
  requisitos: string;
  salario?: number;
  tipoContrato: string;
  status: string;
  createdAt: string;
  restaurante: { nome: string };
  _count: { candidaturas: number };
}
interface Restaurante { id: string; nome: string }

const statusVariant: Record<string, string> = {
  ABERTA: "success",
  FECHADA: "destructive",
  SUSPENSA: "warning",
};

export function VagasContent() {
  const [vagas, setVagas] = useState<Vaga[]>([]);
  const [restaurantes, setRestaurantes] = useState<Restaurante[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("ABERTA");
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    titulo: "", descricao: "", requisitos: "", salario: "", tipoContrato: "CLT", restauranteId: "", status: "ABERTA",
  });

  const fetchVagas = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterStatus) params.set("status", filterStatus);
    const res = await fetch(`/api/vagas?${params}`);
    setVagas(await res.json());
    setLoading(false);
  }, [filterStatus]);

  useEffect(() => { fetchVagas(); }, [fetchVagas]);
  useEffect(() => { fetch("/api/restaurantes").then((r) => r.json()).then(setRestaurantes); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/vagas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) { setError((await res.json()).error ?? "Erro"); return; }
      setModalOpen(false);
      setForm({ titulo: "", descricao: "", requisitos: "", salario: "", tipoContrato: "CLT", restauranteId: "", status: "ABERTA" });
      fetchVagas();
    } catch { setError("Erro de conexão"); }
    finally { setSaving(false); }
  }

  const abertas = vagas.filter((v) => v.status === "ABERTA").length;
  const totalCandidaturas = vagas.reduce((acc, v) => acc + v._count.candidaturas, 0);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <Briefcase size={18} className="text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Vagas Abertas</p>
              <p className="text-2xl font-bold text-green-600">{abertas}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <Users size={18} className="text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Candidaturas</p>
              <p className="text-2xl font-bold text-blue-600">{totalCandidaturas}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
              <Briefcase size={18} className="text-orange-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Total de Vagas</p>
              <p className="text-2xl font-bold text-orange-600">{vagas.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex gap-3 items-center justify-between">
        <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-40">
          <option value="">Todas</option>
          <option value="ABERTA">Abertas</option>
          <option value="FECHADA">Fechadas</option>
          <option value="SUSPENSA">Suspensas</option>
        </Select>
        <Button onClick={() => setModalOpen(true)}><Plus size={16} /> Nova Vaga</Button>
      </div>

      {/* Cards de vagas */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 size={24} className="animate-spin text-orange-500" />
        </div>
      ) : vagas.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-gray-400">
          <p className="font-medium">Nenhuma vaga encontrada</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {vagas.map((v) => (
            <Card key={v.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base leading-tight">{v.titulo}</CardTitle>
                  <Badge variant={statusVariant[v.status] as never}>{v.status}</Badge>
                </div>
                <p className="text-xs text-gray-500">{v.restaurante.nome} · {v.tipoContrato}</p>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 line-clamp-2 mb-3">{v.descricao}</p>
                <div className="space-y-1 text-xs text-gray-500">
                  <p><span className="font-medium text-gray-700">Requisitos:</span> {v.requisitos}</p>
                  {v.salario && <p><span className="font-medium text-gray-700">Salário:</span> {formatCurrency(v.salario)}</p>}
                  <p><span className="font-medium text-gray-700">Publicada em:</span> {formatDate(v.createdAt)}</p>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2">
                  <Users size={14} className="text-gray-400" />
                  <span className="text-sm font-medium text-gray-700">{v._count.candidaturas} candidatura(s)</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Nova Vaga" size="lg">
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Título da Vaga *</label>
            <Input value={form.titulo} onChange={(e) => setForm((p) => ({ ...p, titulo: e.target.value }))} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Restaurante *</label>
              <Select value={form.restauranteId} onChange={(e) => setForm((p) => ({ ...p, restauranteId: e.target.value }))} required>
                <option value="">Selecione...</option>
                {restaurantes.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de Contrato</label>
              <Select value={form.tipoContrato} onChange={(e) => setForm((p) => ({ ...p, tipoContrato: e.target.value }))}>
                <option value="CLT">CLT</option>
                <option value="PJ">PJ</option>
                <option value="TEMPORARIO">Temporário</option>
                <option value="ESTAGIO">Estágio</option>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Salário (R$)</label>
              <Input type="number" step="0.01" value={form.salario} onChange={(e) => setForm((p) => ({ ...p, salario: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <Select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
                <option value="ABERTA">Aberta</option>
                <option value="SUSPENSA">Suspensa</option>
              </Select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Descrição *</label>
            <Textarea value={form.descricao} onChange={(e) => setForm((p) => ({ ...p, descricao: e.target.value }))} rows={3} required />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Requisitos *</label>
            <Textarea value={form.requisitos} onChange={(e) => setForm((p) => ({ ...p, requisitos: e.target.value }))} rows={2} required />
          </div>
          {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>}
          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 size={14} className="animate-spin" />} Publicar Vaga
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
