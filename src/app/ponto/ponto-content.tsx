"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { Loader2, Clock, Upload, CheckCircle2, AlertCircle, AlarmClock, Trash2, FileSpreadsheet, Download } from "lucide-react";
import { ColaboradorView } from "./colaborador-view";
import { HorasExtrasView } from "./horas-extras-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { formatDate, formatCurrency } from "@/lib/utils";

interface Registro {
  id: string;
  data: string;
  entrada?: string;
  saida1?: string;
  entrada2?: string;
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
  FOLGA: "secondary",
};

const ocorrenciaLabel: Record<string, string> = {
  NORMAL: "Normal",
  ATRASO: "Atraso",
  FALTA: "Falta",
  SAIDA_ANTECIPADA: "Saída Antecipada",
  FOLGA: "Folga",
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
  const excelInputRef = useRef<HTMLInputElement>(null);
  const [excelModalOpen, setExcelModalOpen] = useState(false);
  const [excelLoading, setExcelLoading] = useState(false);
  const [excelResult, setExcelResult] = useState<AFDResult | null>(null);
  const [excelError, setExcelError] = useState("");
  const [filterMonth, setFilterMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [view, setView] = useState<"geral" | "colaborador" | "horas-extras">("colaborador");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    funcionarioId: "",
    data: new Date().toISOString().slice(0, 10),
    ocorrencia: "NORMAL",
    justificativa: "",
  });
  const [horarios, setHorarios] = useState({
    entrada: "", saida1: "", entrada2: "",
    saidaAlmoco: "", retornoAlmoco: "", saida: "",
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

  async function handleExcelImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setExcelError("");
    setExcelResult(null);
    setExcelLoading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/ponto/excel", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setExcelError(data.error ?? "Erro ao importar Excel");
        return;
      }
      setExcelResult(data);
      fetchRegistros();
    } catch {
      setExcelError("Erro de conexão");
    } finally {
      setExcelLoading(false);
      if (excelInputRef.current) excelInputRef.current.value = "";
    }
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

  function resetModal() {
    setForm({ funcionarioId: "", data: new Date().toISOString().slice(0, 10), ocorrencia: "NORMAL", justificativa: "" });
    setHorarios({ entrada: "", saida1: "", entrada2: "", saidaAlmoco: "", retornoAlmoco: "", saida: "" });
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const toISO = (t: string) => t ? `${form.data}T${t}:00` : undefined;
      const body = {
        funcionarioId: form.funcionarioId,
        data: form.data,
        entrada:       toISO(horarios.entrada),
        saida1:        toISO(horarios.saida1),
        entrada2:      toISO(horarios.entrada2),
        saidaAlmoco:   toISO(horarios.saidaAlmoco),
        retornoAlmoco: toISO(horarios.retornoAlmoco),
        saida:         toISO(horarios.saida),
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
      resetModal();
      fetchRegistros();
    } catch {
      setError("Erro de conexão");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteRegistro(id: string) {
    if (!confirm("Excluir este registro de ponto?")) return;
    await fetch(`/api/ponto/${id}`, { method: "DELETE" });
    fetchRegistros();
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
          {(["geral", "colaborador", "horas-extras"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                view === v ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {v === "geral" ? "Visão Geral" : v === "colaborador" ? "Por Colaborador" : "Horas Extras"}
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

      {/* Horas Extras view */}
      {view === "horas-extras" && (
        <HorasExtrasView filterMonth={filterMonth} />
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
      <div className="flex flex-wrap gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={() => { setExcelResult(null); setExcelError(""); setExcelModalOpen(true); }}>
          <FileSpreadsheet size={15} /> <span className="hidden sm:inline">Importar Excel</span><span className="sm:hidden">Excel</span>
        </Button>
        <Button variant="outline" size="sm" onClick={() => { setAfdResult(null); setAfdError(""); setAfdModalOpen(true); }}>
          <Upload size={15} /> <span className="hidden sm:inline">Importar AFD</span><span className="sm:hidden">AFD</span>
        </Button>
        <Button size="sm" onClick={() => setModalOpen(true)}>
          <Plus size={15} /> <span className="hidden sm:inline">Registrar Ponto</span><span className="sm:hidden">Registrar</span>
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
            <p className="font-medium">Nenhum registro para este período</p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-gray-100">
              {registros.map((r) => {
                const fmt = (d?: string) => d ? new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) : "—";
                const oc = r.ocorrencia ?? "NORMAL";
                const rowBg = oc === "ATRASO" || oc === "FALTA" ? "bg-red-50" : oc === "SAIDA_ANTECIPADA" ? "bg-amber-50" : oc === "FOLGA" ? "bg-blue-50" : "";
                return (
                  <div key={r.id} className={`p-4 space-y-2 ${rowBg}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 text-sm truncate">{r.funcionario.nome}</p>
                        <p className="text-xs text-gray-400">{r.funcionario.cargo.nome} · {r.funcionario.restaurante.nome}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-mono text-gray-600">{new Date(r.data).toLocaleDateString("pt-BR", { timeZone: "UTC" })}</p>
                        <Badge variant={ocorrenciaVariant[oc] ?? "secondary"} className="text-xs mt-0.5">
                          {ocorrenciaLabel[oc] ?? oc}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex gap-3 font-mono text-gray-700">
                        <span>↓ {fmt(r.entrada)}</span>
                        <span>↑ {fmt(r.saida)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-800">{r.horasTrabalhadas ? `${r.horasTrabalhadas}h` : "—"}</span>
                        {(r.horasExtras ?? 0) > 0 && <span className="text-orange-600">+{r.horasExtras}h</span>}
                        <button
                          onClick={() => handleDeleteRegistro(r.id)}
                          className="p-2 text-gray-300 hover:text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Data</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Funcionário</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Restaurante</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">E1</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">S1</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">E2</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">S2</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">E3</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">S3</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">H. Trabalhadas</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">H. Extras</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Ocorrência</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {registros.map((r) => {
                    const fmt = (d?: string) => d ? new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) : "—";
                    return (
                      <tr key={r.id} className={r.ocorrencia === "ATRASO" ? "bg-red-50 hover:bg-red-100" : r.ocorrencia === "FALTA" ? "bg-red-50/60 hover:bg-red-100/60" : "hover:bg-gray-50"}>
                        <td className="px-4 py-3 text-gray-600 font-mono text-xs whitespace-nowrap">
                          {new Date(r.data).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{r.funcionario.nome}</p>
                          <p className="text-xs text-gray-400">{r.funcionario.matricula} · {r.funcionario.cargo.nome}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{r.funcionario.restaurante.nome}</td>
                        <td className="px-4 py-3 text-gray-700 font-mono">{fmt(r.entrada)}</td>
                        <td className="px-4 py-3 text-gray-500 font-mono">{fmt(r.saida1)}</td>
                        <td className="px-4 py-3 text-gray-500 font-mono">{fmt(r.entrada2)}</td>
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
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleDeleteRegistro(r.id)}
                            className="p-1.5 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Excluir registro"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
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

      {/* Excel Import Modal */}
      <Modal open={excelModalOpen} onClose={() => setExcelModalOpen(false)} title="Importar Excel de Ponto" size="sm">
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-500">
            Faça upload de uma planilha Excel com as batidas dos funcionários. O sistema identifica os
            colaboradores pelo <strong>nome</strong> e cria os registros automaticamente.
          </p>

          <a
            href="/api/ponto/excel"
            className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700 font-medium"
          >
            <Download size={15} /> Baixar template (.xlsx)
          </a>

          <div
            className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-green-400 hover:bg-green-50/30 transition-colors"
            onClick={() => excelInputRef.current?.click()}
          >
            {excelLoading ? (
              <div className="flex flex-col items-center gap-2 text-gray-500">
                <Loader2 size={28} className="animate-spin text-green-600" />
                <span className="text-sm font-medium">Processando planilha...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-gray-400">
                <FileSpreadsheet size={28} />
                <span className="text-sm font-medium">Clique para selecionar o arquivo Excel</span>
                <span className="text-xs">.xlsx ou .xls</span>
              </div>
            )}
          </div>
          <input
            ref={excelInputRef}
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={handleExcelImport}
            disabled={excelLoading}
          />

          {excelError && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              {excelError}
            </div>
          )}

          {excelResult && (
            <div className="space-y-3">
              <div className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800">
                <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold">{excelResult.total} registro(s) processado(s)</p>
                  <p className="text-xs text-green-700 mt-0.5">
                    {excelResult.imported} criado(s) · {excelResult.updated} atualizado(s)
                  </p>
                </div>
              </div>
              {excelResult.unmatched.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 text-sm text-yellow-800">
                  <p className="font-semibold mb-1">{excelResult.unmatched.length} funcionário(s) não encontrado(s):</p>
                  <p className="text-xs font-mono break-all">{excelResult.unmatched.join(", ")}</p>
                  <p className="text-xs mt-1 text-yellow-700">Verifique se o nome na planilha corresponde ao cadastro.</p>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end pt-2 border-t">
            <Button variant="outline" onClick={() => setExcelModalOpen(false)}>Fechar</Button>
          </div>
        </div>
      </Modal>

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
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); resetModal(); }} title="Registrar Ponto" size="md">
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

          {/* Batidas — 6 campos fixos */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-600">Batidas</p>
            <div className="grid grid-cols-2 gap-2">
              {([
                { key: "entrada",       label: "Entrada 1" },
                { key: "saida1",        label: "Saída 1" },
                { key: "entrada2",      label: "Entrada 2" },
                { key: "saidaAlmoco",   label: "Saída 2", note: "refeição" },
                { key: "retornoAlmoco", label: "Entrada 3", note: "refeição" },
                { key: "saida",         label: "Saída 3" },
              ] as const).map(({ key, label, note }) => (
                <div key={key}>
                  <label className="block text-xs text-gray-500 mb-1">
                    {label}{note && <span className="text-orange-500 ml-1">({note})</span>}
                  </label>
                  <Input
                    type="time"
                    value={horarios[key]}
                    onChange={(e) => setHorarios((prev) => ({ ...prev, [key]: e.target.value }))}
                  />
                </div>
              ))}
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
              <Input value={form.justificativa} onChange={(e) => setForm((p) => ({ ...p, justificativa: e.target.value }))} />
            </div>
          )}
          {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>}
          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button type="button" variant="outline" onClick={() => { setModalOpen(false); resetModal(); }}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 size={14} className="animate-spin" />} Registrar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
