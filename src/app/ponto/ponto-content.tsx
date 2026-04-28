"use client";
import { useEffect, useState, useCallback } from "react";
import { Plus, Loader2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, formatCurrency } from "@/lib/utils";

interface Registro {
  id: string;
  data: string;
  entrada?: string;
  saidaAlmoco?: string;
  retornoAlmoco?: string;
  saida?: string;
  horasTrabalhadas?: number;
  horasExtras?: number;
  ocorrencia?: string;
  justificativa?: string;
  funcionario: { nome: string; matricula: string; cargo: { nome: string }; restaurante: { nome: string } };
}

interface Funcionario { id: string; nome: string; matricula: string }

const ocorrenciaVariant: Record<string, "success" | "warning" | "destructive" | "secondary"> = {
  NORMAL: "success",
  ATRASO: "warning",
  FALTA: "destructive",
  SAIDA_ANTECIPADA: "warning",
};

export function PontoContent() {
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [filterData, setFilterData] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    funcionarioId: "",
    data: new Date().toISOString().slice(0, 10),
    entrada: "",
    saidaAlmoco: "",
    retornoAlmoco: "",
    saida: "",
    ocorrencia: "NORMAL",
    justificativa: "",
  });

  const fetchRegistros = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterData) {
      params.set("dataInicio", filterData);
      params.set("dataFim", filterData);
    }
    const res = await fetch(`/api/ponto?${params}`);
    const data = await res.json();
    setRegistros(data);
    setLoading(false);
  }, [filterData]);

  useEffect(() => {
    fetchRegistros();
  }, [fetchRegistros]);

  useEffect(() => {
    fetch("/api/funcionarios?status=ATIVO")
      .then((r) => r.json())
      .then(setFuncionarios);
  }, []);

  function toDateTime(date: string, time: string): string | undefined {
    if (!time) return undefined;
    return `${date}T${time}:00`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const body = {
        funcionarioId: form.funcionarioId,
        data: form.data,
        entrada: toDateTime(form.data, form.entrada),
        saidaAlmoco: toDateTime(form.data, form.saidaAlmoco),
        retornoAlmoco: toDateTime(form.data, form.retornoAlmoco),
        saida: toDateTime(form.data, form.saida),
        ocorrencia: form.ocorrencia,
        justificativa: form.justificativa || undefined,
      };
      const res = await fetch("/api/ponto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Erro ao salvar");
        return;
      }
      setModalOpen(false);
      setForm({ funcionarioId: "", data: new Date().toISOString().slice(0, 10), entrada: "", saidaAlmoco: "", retornoAlmoco: "", saida: "", ocorrencia: "NORMAL", justificativa: "" });
      fetchRegistros();
    } catch {
      setError("Erro de conexão");
    } finally {
      setSaving(false);
    }
  }

  const totalHorasExtras = registros.reduce((acc, r) => acc + (r.horasExtras ?? 0), 0);
  const totalHoras = registros.reduce((acc, r) => acc + (r.horasTrabalhadas ?? 0), 0);
  const faltas = registros.filter((r) => r.ocorrencia === "FALTA").length;

  return (
    <div className="space-y-4">
      {/* Stats do dia */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <div className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
              <Clock size={18} className="text-orange-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Total de Registros</p>
              <p className="text-2xl font-bold text-gray-900">{registros.length}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <Clock size={18} className="text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Horas Extras</p>
              <p className="text-2xl font-bold text-blue-600">{totalHorasExtras.toFixed(1)}h</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
              <Clock size={18} className="text-red-500" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Faltas</p>
              <p className="text-2xl font-bold text-red-500">{faltas}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2">
          <Input
            type="date"
            value={filterData}
            onChange={(e) => setFilterData(e.target.value)}
            className="w-44"
          />
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus size={16} /> Registrar Ponto
        </Button>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 size={24} className="animate-spin text-orange-500" />
          </div>
        ) : registros.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <p className="font-medium">Nenhum registro para esta data</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Funcionário</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Restaurante</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Entrada</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Saída Almoço</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Retorno</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Saída</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">H. Trabalhadas</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">H. Extras</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Ocorrência</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {registros.map((r) => {
                  const fmt = (d?: string) => d ? new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—";
                  return (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{r.funcionario.nome}</p>
                        <p className="text-xs text-gray-400">{r.funcionario.matricula} · {r.funcionario.cargo.nome}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{r.funcionario.restaurante.nome}</td>
                      <td className="px-4 py-3 text-gray-700 font-mono">{fmt(r.entrada)}</td>
                      <td className="px-4 py-3 text-gray-600 font-mono">{fmt(r.saidaAlmoco)}</td>
                      <td className="px-4 py-3 text-gray-600 font-mono">{fmt(r.retornoAlmoco)}</td>
                      <td className="px-4 py-3 text-gray-700 font-mono">{fmt(r.saida)}</td>
                      <td className="px-4 py-3 font-semibold text-gray-900">{r.horasTrabalhadas ? `${r.horasTrabalhadas}h` : "—"}</td>
                      <td className="px-4 py-3">{r.horasExtras ? <span className="text-orange-600 font-semibold">{r.horasExtras}h</span> : "—"}</td>
                      <td className="px-4 py-3">
                        <Badge variant={ocorrenciaVariant[r.ocorrencia ?? "NORMAL"] ?? "secondary"} className="text-xs">
                          {r.ocorrencia ?? "NORMAL"}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!loading && registros.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-500 flex gap-6">
            <span>{registros.length} registro(s)</span>
            <span>Total: {totalHoras.toFixed(1)}h trabalhadas</span>
            <span>{totalHorasExtras.toFixed(1)}h extras</span>
          </div>
        )}
      </Card>

      {/* Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Registrar Ponto" size="md">
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Funcionário *</label>
            <Select value={form.funcionarioId} onChange={(e) => setForm((p) => ({ ...p, funcionarioId: e.target.value }))} required>
              <option value="">Selecione...</option>
              {funcionarios.map((f) => (
                <option key={f.id} value={f.id}>{f.nome} ({f.matricula})</option>
              ))}
            </Select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Data *</label>
            <Input type="date" value={form.data} onChange={(e) => setForm((p) => ({ ...p, data: e.target.value }))} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Entrada</label>
              <Input type="time" value={form.entrada} onChange={(e) => setForm((p) => ({ ...p, entrada: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Saída Almoço</label>
              <Input type="time" value={form.saidaAlmoco} onChange={(e) => setForm((p) => ({ ...p, saidaAlmoco: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Retorno Almoço</label>
              <Input type="time" value={form.retornoAlmoco} onChange={(e) => setForm((p) => ({ ...p, retornoAlmoco: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Saída</label>
              <Input type="time" value={form.saida} onChange={(e) => setForm((p) => ({ ...p, saida: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Ocorrência</label>
            <Select value={form.ocorrencia} onChange={(e) => setForm((p) => ({ ...p, ocorrencia: e.target.value }))}>
              <option value="NORMAL">Normal</option>
              <option value="ATRASO">Atraso</option>
              <option value="FALTA">Falta</option>
              <option value="SAIDA_ANTECIPADA">Saída Antecipada</option>
            </Select>
          </div>
          {form.ocorrencia !== "NORMAL" && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Justificativa</label>
              <Textarea value={form.justificativa} onChange={(e) => setForm((p) => ({ ...p, justificativa: e.target.value }))} rows={2} />
            </div>
          )}
          {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>}
          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 size={14} className="animate-spin" />} Registrar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
