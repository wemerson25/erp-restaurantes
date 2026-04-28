"use client";
import { useEffect, useState, useCallback } from "react";
import {
  Plus, Loader2, Umbrella, AlertTriangle, ChevronDown, ChevronRight,
  Calendar, CheckCircle, Clock, XCircle, Search, Pencil, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

interface PeriodoInfo {
  numero: number;
  label: string;
  inicioAquisitivo: string;
  fimAquisitivo: string;
  inicioConcessivo: string;
  fimConcessivo: string;
  diasDevidos: number;
  diasUsados: number;
  diasSaldo: number;
  status: "ADQUIRINDO" | "ADQUIRIDO" | "PARCIAL" | "VENCENDO" | "VENCIDO" | "CONCEDIDO";
  diasParaVencer: number;
  ferias: Array<{ id: string; dataInicio: string; dataFim: string; diasCorridos: number; diasVendidos: number; status: string }>;
}

interface FuncionarioSituacao {
  funcionario: {
    id: string;
    nome: string;
    matricula: string;
    dataAdmissao: string;
    cargo: { nome: string };
    restaurante: { id: string; nome: string };
    status: string;
  };
  periodos: PeriodoInfo[];
  statusMaisUrgente: string;
  ultimasFerias: { dataInicio: string; dataFim: string; diasCorridos: number } | null;
}

interface FeriasHistorico {
  id: string;
  dataInicio: string;
  dataFim: string;
  diasCorridos: number;
  diasVendidos: number;
  status: string;
  observacoes?: string;
  funcionario: { nome: string; matricula: string; cargo: { nome: string }; restaurante: { nome: string } };
}

interface Restaurante { id: string; nome: string }

// ── Status config ──────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  ADQUIRINDO: { label: "Adquirindo",  color: "text-gray-500",   bg: "bg-gray-100",   border: "border-gray-200" },
  ADQUIRIDO:  { label: "Adquirido",   color: "text-green-700",  bg: "bg-green-100",  border: "border-green-200" },
  PARCIAL:    { label: "Parcial",     color: "text-blue-700",   bg: "bg-blue-100",   border: "border-blue-200" },
  VENCENDO:   { label: "Vencendo",    color: "text-orange-700", bg: "bg-orange-100", border: "border-orange-300" },
  VENCIDO:    { label: "Vencido",     color: "text-red-700",    bg: "bg-red-100",    border: "border-red-300" },
  CONCEDIDO:  { label: "Concedido",   color: "text-teal-700",   bg: "bg-teal-100",   border: "border-teal-200" },
};

const FERIAS_STATUS_CFG: Record<string, string> = {
  AGENDADA:     "bg-blue-100 text-blue-700",
  EM_ANDAMENTO: "bg-orange-100 text-orange-700",
  CONCLUIDA:    "bg-green-100 text-green-700",
  CANCELADA:    "bg-gray-100 text-gray-400",
};

function fmt(d: string) { return new Date(d).toLocaleDateString("pt-BR"); }
function fmtShort(d: string) {
  const dt = new Date(d);
  return dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "2-digit" });
}

// ── Main component ─────────────────────────────────────────────────────────

export function FeriasContent() {
  const [tab, setTab] = useState<"periodos" | "historico">("periodos");
  const [situacoes, setSituacoes] = useState<FuncionarioSituacao[]>([]);
  const [historico, setHistorico] = useState<FeriasHistorico[]>([]);
  const [restaurantes, setRestaurantes] = useState<Restaurante[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRestaurante, setFilterRestaurante] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formFuncionarioId, setFormFuncionarioId] = useState("");

  const loadPeriodos = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (filterRestaurante) p.set("restauranteId", filterRestaurante);
    if (filterStatus) p.set("status", filterStatus);
    const res = await fetch(`/api/ferias/periodos?${p}`);
    if (res.ok) setSituacoes(await res.json());
    setLoading(false);
  }, [filterRestaurante, filterStatus]);

  const loadHistorico = useCallback(async () => {
    const res = await fetch("/api/ferias");
    if (res.ok) setHistorico(await res.json());
  }, []);

  useEffect(() => {
    fetch("/api/restaurantes").then(r => r.json()).then(setRestaurantes);
  }, []);

  useEffect(() => { loadPeriodos(); }, [loadPeriodos]);
  useEffect(() => { if (tab === "historico") loadHistorico(); }, [tab, loadHistorico]);

  const filtered = situacoes.filter(s =>
    s.funcionario.nome.toLowerCase().includes(search.toLowerCase()) ||
    s.funcionario.matricula.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    vencidos: situacoes.filter(s => s.periodos.some(p => p.status === "VENCIDO")).length,
    vencendo: situacoes.filter(s => s.periodos.some(p => p.status === "VENCENDO")).length,
    adquiridos: situacoes.filter(s => s.periodos.some(p => ["ADQUIRIDO", "PARCIAL"].includes(p.status))).length,
    adquirindo: situacoes.filter(s => s.statusMaisUrgente === "ADQUIRINDO").length,
  };

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {([["periodos", "Períodos Aquisitivos"], ["historico", "Histórico de Férias"]] as const).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all",
              tab === k ? "bg-white shadow text-orange-600" : "text-gray-500 hover:text-gray-700"
            )}
          >
            {l}
          </button>
        ))}
      </div>

      {tab === "periodos" && (
        <>
          {/* Alert vencidos */}
          {stats.vencidos > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3">
              <AlertTriangle size={18} className="text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700 font-medium">
                <strong>{stats.vencidos}</strong> colaborador{stats.vencidos > 1 ? "es" : ""} com férias VENCIDAS — risco de férias em dobro conforme CLT.
              </p>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "Férias Vencidas",   value: stats.vencidos,   color: "text-red-600",    bg: "bg-red-50",    icon: XCircle },
              { label: "Vencendo em 60 dias",value: stats.vencendo,  color: "text-orange-600", bg: "bg-orange-50", icon: AlertTriangle },
              { label: "Aguardando Agendamento", value: stats.adquiridos, color: "text-green-600", bg: "bg-green-50", icon: Calendar },
              { label: "Em Aquisição",      value: stats.adquirindo, color: "text-gray-500",   bg: "bg-gray-50",   icon: Clock },
            ].map(({ label, value, color, bg, icon: Icon }) => (
              <div key={label} className={cn("rounded-xl border border-gray-100 p-4 shadow-sm", bg)}>
                <div className="flex items-center gap-2 mb-1">
                  <Icon size={14} className={color} />
                  <p className="text-xs text-gray-500">{label}</p>
                </div>
                <p className={cn("text-2xl font-bold", color)}>{value}</p>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input className="pl-8" placeholder="Buscar funcionário..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={filterRestaurante} onChange={e => setFilterRestaurante(e.target.value)} className="sm:w-52">
              <option value="">Todos os restaurantes</option>
              {restaurantes.map(r => <option key={r.id} value={r.id}>{r.nome}</option>)}
            </Select>
            <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="sm:w-44">
              <option value="">Todos os status</option>
              <option value="VENCIDO">Vencido</option>
              <option value="VENCENDO">Vencendo</option>
              <option value="ADQUIRIDO">Adquirido</option>
              <option value="PARCIAL">Parcial</option>
              <option value="ADQUIRINDO">Adquirindo</option>
            </Select>
          </div>

          {/* Employee list */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-12 text-center">
                <Loader2 size={24} className="animate-spin text-orange-500 mx-auto" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <Umbrella size={40} className="mx-auto mb-3 text-gray-300" />
                <p>Nenhum funcionário encontrado</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {filtered.map(s => {
                  const f = s.funcionario;
                  const expanded = expandedId === f.id;
                  const periodoUrgente = s.periodos[0];
                  const cfg = STATUS_CFG[s.statusMaisUrgente] ?? STATUS_CFG.ADQUIRINDO;

                  return (
                    <div key={f.id}>
                      {/* Row */}
                      <div
                        className="px-5 py-4 flex items-center gap-4 cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => setExpandedId(expanded ? null : f.id)}
                      >
                        {/* Status indicator */}
                        <div className={cn("w-2 h-10 rounded-full flex-shrink-0", cfg.bg, "border", cfg.border)} />

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 text-sm">{f.nome}</p>
                          <p className="text-xs text-gray-400">{f.matricula} · {f.cargo.nome} · {f.restaurante.nome}</p>
                        </div>

                        {/* Admission */}
                        <div className="hidden md:block text-center">
                          <p className="text-xs text-gray-400">Admissão</p>
                          <p className="text-sm text-gray-700 font-medium">{fmt(f.dataAdmissao)}</p>
                        </div>

                        {/* Most urgent period summary */}
                        {periodoUrgente && (
                          <div className="hidden lg:block text-center">
                            <p className="text-xs text-gray-400">{periodoUrgente.label}</p>
                            <p className="text-sm text-gray-700">
                              Vence: <span className={cn("font-semibold", cfg.color)}>{fmtShort(periodoUrgente.fimConcessivo)}</span>
                            </p>
                          </div>
                        )}

                        {/* Saldo */}
                        {periodoUrgente && periodoUrgente.status !== "ADQUIRINDO" && (
                          <div className="text-center">
                            <p className="text-xs text-gray-400">Saldo</p>
                            <p className={cn("text-sm font-bold", cfg.color)}>
                              {periodoUrgente.diasSaldo}/{periodoUrgente.diasDevidos} dias
                            </p>
                          </div>
                        )}

                        {/* Status badge */}
                        <span className={cn("inline-flex items-center text-xs px-2.5 py-1 rounded-full font-medium border", cfg.color, cfg.bg, cfg.border)}>
                          {cfg.label}
                        </span>

                        {/* Action */}
                        <button
                          className="flex-shrink-0 bg-orange-500 hover:bg-orange-600 text-white text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                          onClick={e => { e.stopPropagation(); setFormFuncionarioId(f.id); setShowForm(true); }}
                        >
                          <Plus size={12} className="inline mr-1" />Agendar
                        </button>

                        <ChevronDown size={14} className={cn("text-gray-400 transition-transform flex-shrink-0", expanded && "rotate-180")} />
                      </div>

                      {/* Expanded: all periods */}
                      {expanded && (
                        <div className="bg-gray-50 border-t border-gray-100 px-5 py-4">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Períodos Aquisitivos</p>
                          <div className="space-y-3">
                            {s.periodos.map(p => {
                              const pc = STATUS_CFG[p.status] ?? STATUS_CFG.ADQUIRINDO;
                              const bar = Math.min(100, (p.diasUsados / p.diasDevidos) * 100);
                              return (
                                <div key={p.numero} className={cn("rounded-xl border p-4 bg-white", pc.border)}>
                                  <div className="flex items-start justify-between gap-4 mb-3">
                                    <div>
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="text-sm font-semibold text-gray-800">{p.label}</span>
                                        <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium", pc.color, pc.bg, pc.border)}>
                                          {pc.label}
                                        </span>
                                      </div>
                                      <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs text-gray-500">
                                        <span>Período Aquisitivo: <strong className="text-gray-700">{fmtShort(p.inicioAquisitivo)} → {fmtShort(p.fimAquisitivo)}</strong></span>
                                        <span>Período Concessivo: <strong className="text-gray-700">{fmtShort(p.inicioConcessivo)} → {fmtShort(p.fimConcessivo)}</strong></span>
                                        {p.status !== "ADQUIRINDO" && (
                                          <span className={cn(
                                            "font-medium",
                                            p.diasParaVencer < 0 ? "text-red-600" : p.diasParaVencer <= 60 ? "text-orange-600" : "text-gray-500"
                                          )}>
                                            Vencimento: <strong>{fmtShort(p.fimConcessivo)}</strong>
                                            {p.diasParaVencer < 0
                                              ? ` (venceu há ${Math.abs(p.diasParaVencer)} dias)`
                                              : ` (${p.diasParaVencer} dias restantes)`}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    {p.status !== "ADQUIRINDO" && (
                                      <div className="text-right flex-shrink-0">
                                        <p className={cn("text-lg font-bold", pc.color)}>{p.diasSaldo} dias</p>
                                        <p className="text-xs text-gray-400">de saldo</p>
                                      </div>
                                    )}
                                  </div>

                                  {/* Progress bar */}
                                  {p.status !== "ADQUIRINDO" && (
                                    <div className="mt-2">
                                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                                        <span>{p.diasUsados} dias usados</span>
                                        <span>{p.diasDevidos} dias devidos</span>
                                      </div>
                                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                          className={cn("h-full rounded-full transition-all", p.diasUsados >= p.diasDevidos ? "bg-teal-500" : p.status === "VENCIDO" ? "bg-red-400" : "bg-orange-400")}
                                          style={{ width: `${bar}%` }}
                                        />
                                      </div>
                                    </div>
                                  )}

                                  {/* Ferias in this period */}
                                  {p.ferias.length > 0 && (
                                    <div className="mt-3 pt-3 border-t border-gray-100">
                                      <p className="text-xs font-medium text-gray-500 mb-2">Férias neste período:</p>
                                      <div className="flex flex-wrap gap-2">
                                        {p.ferias.map(fr => (
                                          <div key={fr.id} className={cn("inline-flex items-center gap-2 text-xs px-2.5 py-1.5 rounded-lg", FERIAS_STATUS_CFG[fr.status] ?? "bg-gray-100 text-gray-600")}>
                                            <span>{fmtShort(fr.dataInicio)} → {fmtShort(fr.dataFim)}</span>
                                            <span className="font-bold">{fr.diasCorridos}d</span>
                                            {fr.diasVendidos > 0 && (
                                              <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-semibold">+{fr.diasVendidos}v</span>
                                            )}
                                            <span className="opacity-60">({fr.status.replace("_", " ")})</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          {/* Últimas férias */}
                          {s.ultimasFerias && (
                            <p className="text-xs text-gray-400 mt-3">
                              Últimas férias concluídas: {fmt(s.ultimasFerias.dataInicio)} a {fmt(s.ultimasFerias.dataFim)} ({s.ultimasFerias.diasCorridos} dias)
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {tab === "historico" && (
        <HistoricoView
          historico={historico}
          onRefresh={loadHistorico}
          onAgendar={() => { setFormFuncionarioId(""); setShowForm(true); }}
        />
      )}

      {/* Scheduling modal */}
      {showForm && (
        <AgendarModal
          funcionarioId={formFuncionarioId}
          onSuccess={() => { setShowForm(false); loadPeriodos(); loadHistorico(); }}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  );
}

// ── Histórico sub-view ─────────────────────────────────────────────────────

function HistoricoView({
  historico,
  onRefresh,
  onAgendar,
}: {
  historico: FeriasHistorico[];
  onRefresh: () => void;
  onAgendar: () => void;
}) {
  async function updateStatus(id: string, status: string) {
    await fetch(`/api/ferias/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    onRefresh();
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este registro de férias?")) return;
    await fetch(`/api/ferias/${id}`, { method: "DELETE" });
    onRefresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={onAgendar}><Plus size={16} /> Agendar Férias</Button>
      </div>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {historico.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Umbrella size={40} className="mx-auto mb-3 text-gray-300" />
            <p>Nenhuma férias registrada</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Funcionário</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Início</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Fim</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Dias</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 hidden sm:table-cell">Abono</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {historico.map(f => {
                  const scfg = {
                    AGENDADA:     "bg-blue-100 text-blue-700",
                    EM_ANDAMENTO: "bg-orange-100 text-orange-700",
                    CONCLUIDA:    "bg-green-100 text-green-700",
                    CANCELADA:    "bg-gray-100 text-gray-500",
                  }[f.status] ?? "bg-gray-100 text-gray-500";

                  return (
                    <tr key={f.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{f.funcionario.nome}</p>
                        <p className="text-xs text-gray-400">{f.funcionario.matricula} · {f.funcionario.cargo.nome}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{fmt(f.dataInicio)}</td>
                      <td className="px-4 py-3 text-gray-700">{fmt(f.dataFim)}</td>
                      <td className="px-4 py-3 font-semibold">{f.diasCorridos}</td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        {f.diasVendidos > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium bg-amber-100 text-amber-700">
                            {f.diasVendidos}d vendidos
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("text-xs px-2 py-1 rounded-full font-medium", scfg)}>
                          {f.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          {f.status === "AGENDADA" && (
                            <button className="text-xs px-2 py-1 rounded bg-orange-100 text-orange-600 hover:bg-orange-200 font-medium" onClick={() => updateStatus(f.id, "EM_ANDAMENTO")}>Iniciar</button>
                          )}
                          {f.status === "EM_ANDAMENTO" && (
                            <button className="text-xs px-2 py-1 rounded bg-green-100 text-green-600 hover:bg-green-200 font-medium" onClick={() => updateStatus(f.id, "CONCLUIDA")}>Concluir</button>
                          )}
                          {["AGENDADA", "EM_ANDAMENTO"].includes(f.status) && (
                            <button className="text-xs px-2 py-1 rounded bg-red-50 text-red-500 hover:bg-red-100 font-medium" onClick={() => updateStatus(f.id, "CANCELADA")}>Cancelar</button>
                          )}
                          <button className="p-1 text-gray-400 hover:text-red-500" onClick={() => handleDelete(f.id)}>
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Agendar modal ──────────────────────────────────────────────────────────

function AgendarModal({ funcionarioId, onSuccess, onClose }: { funcionarioId: string; onSuccess: () => void; onClose: () => void }) {
  const [funcionarios, setFuncionarios] = useState<Array<{ id: string; nome: string; matricula: string }>>([]);
  const [form, setForm] = useState({ funcionarioId, dataInicio: "", dataFim: "", diasVendidos: 0, observacoes: "" });
  const [venderDias, setVenderDias] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [dias, setDias] = useState(0);

  useEffect(() => {
    fetch("/api/funcionarios?status=ATIVO").then(r => r.json()).then(setFuncionarios);
  }, []);

  useEffect(() => {
    if (form.dataInicio && form.dataFim) {
      const d = Math.ceil((new Date(form.dataFim).getTime() - new Date(form.dataInicio).getTime()) / 86400000) + 1;
      setDias(d > 0 ? d : 0);
    } else {
      setDias(0);
    }
  }, [form.dataInicio, form.dataFim]);

  const maxVendidos = Math.floor(dias / 3);

  useEffect(() => {
    if (!venderDias) setForm(p => ({ ...p, diasVendidos: 0 }));
  }, [venderDias]);

  useEffect(() => {
    if (form.diasVendidos > maxVendidos) setForm(p => ({ ...p, diasVendidos: maxVendidos }));
  }, [maxVendidos, form.diasVendidos]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (dias <= 0) { setError("Data fim deve ser após a data início"); return; }
    if (form.diasVendidos > maxVendidos) { setError(`Máximo de dias a vender: ${maxVendidos} (1/3 de ${dias})`); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/ferias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) { setError((await res.json()).error ?? "Erro"); return; }
      onSuccess();
    } catch { setError("Erro de conexão"); }
    finally { setSaving(false); }
  }

  const L = ({ c }: { c: string }) => <label className="block text-xs font-medium text-gray-600 mb-1">{c}</label>;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2"><Umbrella size={16} className="text-orange-500" /> Agendar Férias</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><ChevronRight size={18} className="rotate-90" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <L c="Funcionário *" />
            <Select value={form.funcionarioId} onChange={e => setForm(p => ({ ...p, funcionarioId: e.target.value }))} required>
              <option value="">Selecione...</option>
              {funcionarios.map(f => <option key={f.id} value={f.id}>{f.nome} ({f.matricula})</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <L c="Data de Início *" />
              <Input type="date" value={form.dataInicio} onChange={e => setForm(p => ({ ...p, dataInicio: e.target.value }))} required />
            </div>
            <div>
              <L c="Data de Fim *" />
              <Input type="date" value={form.dataFim} onChange={e => setForm(p => ({ ...p, dataFim: e.target.value }))} required />
            </div>
          </div>
          {dias > 0 && (
            <p className="text-sm text-orange-600 font-semibold">{dias} dias corridos de descanso</p>
          )}

          {/* Abono pecuniário */}
          <div className="border border-gray-100 rounded-xl p-4 space-y-3 bg-gray-50">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={venderDias}
                onChange={e => setVenderDias(e.target.checked)}
                className="w-4 h-4 accent-amber-500"
              />
              <span className="text-sm font-medium text-gray-700">Vender dias de férias (abono pecuniário)</span>
            </label>
            {venderDias && (
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <L c="Dias a vender *" />
                    <Input
                      type="number"
                      min={1}
                      max={maxVendidos}
                      value={form.diasVendidos || ""}
                      onChange={e => setForm(p => ({ ...p, diasVendidos: Math.max(0, Math.min(maxVendidos, parseInt(e.target.value) || 0)) }))}
                      placeholder="0"
                      required
                    />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-400 mb-1">Máx. permitido (CLT)</p>
                    <p className="text-sm font-bold text-amber-600">{maxVendidos} dias</p>
                    <p className="text-xs text-gray-400">1/3 de {dias}d</p>
                  </div>
                </div>
                {dias > 0 && form.diasVendidos > 0 && (
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                    Total consumido do período: <strong>{dias + form.diasVendidos} dias</strong>
                    {" "}({dias}d descanso + {form.diasVendidos}d vendidos)
                  </p>
                )}
              </div>
            )}
          </div>

          <div>
            <L c="Observações" />
            <Textarea value={form.observacoes} onChange={e => setForm(p => ({ ...p, observacoes: e.target.value }))} rows={2} />
          </div>
          {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>}
          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 size={14} className="animate-spin" />} Agendar
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
