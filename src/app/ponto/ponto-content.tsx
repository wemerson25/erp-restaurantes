"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { Plus, Loader2, Clock, Upload, CheckCircle2, AlertCircle, AlarmClock } from "lucide-react";
import { ColaboradorView } from "./colaborador-view";
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
  ATRASO: "destructive",
  FALTA: "destructive",
  SAIDA_ANTECIPADA: "warning",
};

const ocorrenciaLabel: Record<string, string> = {
  NORMAL: "Normal",
  ATRASO: "Atraso",
  FALTA: "Falta",
  SAIDA_ANTECIPADA: "Saída Antecipada",
};

interface AFDResult {
  imported: number;
  updated: number;
  total: number;
  unmatched: string[];
}

export function PontoContent() {
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [afdModalOpen, setAfdModalOpen] = useState(false);
  const [afdLoading, setAfdLoading] = useState(false);
  const [afdResult, setAfdResult] = useState<AFDResult | null>(null);
  const [afdError, setAfdError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [filterMonth, setFilterMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [view, setView] = useState<"geral" | "colaborador">("geral");
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
    const [year, month] = filterMonth.split("-").map(Number);
    const dataInicio = new Date(year, month - 1, 1).toISOString().slice(0, 10);
    const dataFim = new Date(year, month, 0).toISOString().slice(0, 10);
    const params = new URLSearchParams({ dataInicio, dataFim });
    const res = await fetch(`/api/ponto?${params}`);
    const data = await res.json();
    setRegistros(data);
    setLoading(false);
  }, [filterMonth]);

  useEffect(() => {
    fetchRegistros();
  }, [fetchRegistros]);

  function changeMonth(delta: number) {
    const [year, month] = filterMonth.split("-").map(Number);
    const d = new Date(year, month - 1 + delta, 1);
    setFilterMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const monthLabel = new Date(filterMonth + "-02").toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  useEffect(() => {
    fetch("/api/funcionarios?status=ATIVO")
      .then((r) => r.json())
      .then(setFuncionarios);
  }, []);

  function toDateTime(date: string, time: string): string | undefined {
    if (!time) return undefined;
    return `${date}T${time}:00`;
  }

  async function handleAFDImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAfdError("");
    setAfdResult(null);
    setAfdLoading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/ponto/afd", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setAfdError(data.error ?? "Erro ao importar AFD");
        return;
      }
      setAfdResult(data);
      fetchRegistros();
    } catch {
      setAfdError("Erro de conexão");
    } finally {
      setAfdLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
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
  const atrasos = registros.filter((r) => r.ocorrencia === "ATRASO").length;

  return (
    <div className="space-y-4">
      {/* Tabs + Month filter */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {(["geral", "colaborador"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                view === v ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {v === "geral" ? "Visão Geral" : "Por Colaborador"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => changeMonth(-1)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors">&#8249;</button>
          <input
            type="month"
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="flex h-9 rounded-lg border border-gray-200 bg-white px-3 py-1 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent transition-colors"
          />
          <button onClick={() => changeMonth(1)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors">&#8250;</button>
          <span className="text-sm text-gray-500 ml-1 capitalize hidden sm:inline">{monthLabel}</span>
        </div>
      </div>

      {/* Colaborador view */}
      {view === "colaborador" && (
        <ColaboradorView funcionarios={funcionarios} filterMonth={filterMonth} />
      )}

      {/* Geral view */}
      {view === "geral" && <>

      {/* Stats do período */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <div className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
              <Clock size={18} className="text-gray-600" />
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
              <AlarmClock size={18} className="text-red-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Atrasos</p>
              <p className="text-2xl font-bold text-red-600">{atrasos}</p>
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
        <div>{/* spacer */}</div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setAfdResult(null); setAfdError(""); setAfdModalOpen(true); }}>
            <Upload size={16} /> Importar AFD
          </Button>
          <Button onClick={() => setModalOpen(true)}>
            <Plus size={16} /> Registrar Ponto
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 size={24} className="animate-spin text-orange-500" />
          </div>
        ) : registros.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <p className="font-medium">Nenhum registro para este período</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Data</th>
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
                    <tr key={r.id} className={r.ocorrencia === "ATRASO" ? "bg-red-50 hover:bg-red-100" : r.ocorrencia === "FALTA" ? "bg-red-50/60 hover:bg-red-100/60" : "hover:bg-gray-50"}>
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs whitespace-nowrap">
                        {new Date(r.data).toLocaleDateString("pt-BR")}
                      </td>
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
                          {ocorrenciaLabel[r.ocorrencia ?? "NORMAL"] ?? r.ocorrencia}
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

      {/* end geral view */}
      </>}

      {/* AFD Import Modal */}
      <Modal open={afdModalOpen} onClose={() => setAfdModalOpen(false)} title="Importar Arquivo AFD" size="sm">
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-500">
            Importe um arquivo AFD (Portaria MTE 1510) para registrar automaticamente os pontos dos funcionários.
            O sistema busca os colaboradores pelo PIS/PASEP cadastrado.
          </p>

          <div
            className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-red-300 hover:bg-red-50/30 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            {afdLoading ? (
              <div className="flex flex-col items-center gap-2 text-gray-500">
                <Loader2 size={28} className="animate-spin text-red-500" />
                <span className="text-sm font-medium">Processando arquivo...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-gray-400">
                <Upload size={28} />
                <span className="text-sm font-medium">Clique para selecionar o arquivo AFD</span>
                <span className="text-xs">.txt ou .afd</span>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.afd,text/plain"
            className="hidden"
            onChange={handleAFDImport}
            disabled={afdLoading}
          />

          {afdError && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              {afdError}
            </div>
          )}

          {afdResult && (
            <div className="space-y-3">
              <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">{afdResult.total} registro(s) processado(s)</p>
                  <p className="text-xs text-green-700 mt-0.5">
                    {afdResult.imported} criado(s) · {afdResult.updated} atualizado(s)
                  </p>
                </div>
              </div>
              {afdResult.unmatched.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 text-sm text-yellow-800">
                  <p className="font-semibold mb-1">{afdResult.unmatched.length} PIS não encontrado(s):</p>
                  <p className="text-xs font-mono break-all">{afdResult.unmatched.join(", ")}</p>
                  <p className="text-xs mt-1 text-yellow-700">Verifique se o PIS/PASEP está cadastrado no funcionário.</p>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end pt-2 border-t">
            <Button variant="outline" onClick={() => setAfdModalOpen(false)}>Fechar</Button>
          </div>
        </div>
      </Modal>

      {/* Manual Registration Modal */}
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
