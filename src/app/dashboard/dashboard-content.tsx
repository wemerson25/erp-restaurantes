"use client";
import { useCallback, useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
  LineChart, Line, Legend,
} from "recharts";
import {
  Users, Umbrella, TrendingUp, TrendingDown, Cake,
  AlarmClock, XCircle, FileText, ShieldAlert, Loader2,
  AlertTriangle, Clock, Activity, BarChart2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const COLORS = ["#C41E2E", "#1A1A1A", "#E8293B", "#4B4B4B", "#9B1623", "#6B6B6B"];
const MONTHS_PT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

// ─── Types ───────────────────────────────────────────────────────────────────

interface RankingItem { funcionarioId: string; nome: string; matricula: string; count: number }

interface DashboardData {
  totalFuncionarios: number;
  funcionariosAtivos: number;
  feriasMes: number;
  admissoesMes: number;
  demissoesMes: number;
  funcionariosPorRestaurante: { nome: string; total: number }[];
}

interface RankingData {
  rankingAtrasos: RankingItem[];
  rankingFaltas: RankingItem[];
  rankingAtestados: RankingItem[];
  rankingAdvertencias: RankingItem[];
}

interface RankingFilter {
  period: "month" | "all";
  month: string;
}

interface Aniversariante {
  id: string; nome: string; dia: number; mes: number;
  cargo: string; restaurante: string; isToday: boolean;
}

interface AdvancedData {
  emExperiencia: { id: string; nome: string; restaurante: string; cargo: string; dataAdmissao: string; diasNaEmpresa: number; diasRestantes: number; alerta: "vencendo" | "normal" }[];
  feriasVencendo: { id: string; nome: string; restaurante: string; diasAteVencer: number; periodoFim: string; prioridade: "alta" | "media" }[];
  feriasVencidas: { id: string; nome: string; restaurante: string; diasVencidas: number }[];
  horasExtrasMesAnterior: { id: string; nome: string; matricula: string; restaurante: string; cargo: string; totalHoras: number }[];
  mesAntLabel: string;
  heatmap: {
    porDia: { dia: number; nome: string; count: number }[];
    total: number;
    porLoja: { nome: string; count: number }[];
  };
  scoresDisciplinares: { id: string; nome: string; matricula: string; restaurante: string; cargo: string; score: number; nivel: "atencao" | "critico"; atrasos: number; faltas: number; advertencias: number; atestados: number }[];
  comparativoLojas: { restaurante: string; totalAtivos: number; atrasos: number; faltas: number; advertencias: number; admissoes: number; demissoes: number; turnoverPct: number }[];
}

// ─── SkeletonCard ─────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="h-32 animate-pulse bg-gray-100 rounded-xl" />
  );
}

// ─── AlertasRH ────────────────────────────────────────────────────────────────

function AlertasRH({ data }: { data: AdvancedData }) {
  const vencidas = data.feriasVencidas;
  const vencendoAlta = data.feriasVencendo.filter((f) => f.prioridade === "alta");
  const vencendoMedia = data.feriasVencendo.filter((f) => f.prioridade === "media");
  const expVencendo = data.emExperiencia.filter((e) => e.alerta === "vencendo");

  const hasAny = vencidas.length > 0 || vencendoAlta.length > 0 || vencendoMedia.length > 0 || expVencendo.length > 0;
  if (!hasAny) return null;

  return (
    <Card className="border-orange-200 bg-orange-50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-orange-800 text-base">
          <AlertTriangle size={18} className="text-orange-600" />
          Pendências RH
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {vencidas.length > 0 && (
          <div>
            <span className="inline-block bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5 rounded-full mb-2">
              Férias Vencidas ({vencidas.length})
            </span>
            <ul className="space-y-1">
              {vencidas.slice(0, 6).map((f) => (
                <li key={f.id} className="flex items-center justify-between text-xs text-red-800">
                  <span className="font-medium truncate max-w-[60%]">{f.nome}</span>
                  <span className="text-red-600 shrink-0">{f.diasVencidas} dias vencida · {f.restaurante}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {vencendoAlta.length > 0 && (
          <div>
            <span className="inline-block bg-orange-200 text-orange-800 text-xs font-semibold px-2 py-0.5 rounded-full mb-2">
              Férias Vencendo (Alta Prioridade — {vencendoAlta.length})
            </span>
            <ul className="space-y-1">
              {vencendoAlta.slice(0, 6).map((f) => (
                <li key={f.id} className="flex items-center justify-between text-xs text-orange-800">
                  <span className="font-medium truncate max-w-[60%]">{f.nome}</span>
                  <span className="text-orange-600 shrink-0">{f.diasAteVencer} dias para vencer · {f.restaurante}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {vencendoMedia.length > 0 && (
          <div>
            <span className="inline-block bg-yellow-100 text-yellow-800 text-xs font-semibold px-2 py-0.5 rounded-full mb-2">
              Férias Vencendo (Média Prioridade — {vencendoMedia.length})
            </span>
            <ul className="space-y-1">
              {vencendoMedia.slice(0, 6).map((f) => (
                <li key={f.id} className="flex items-center justify-between text-xs text-yellow-800">
                  <span className="font-medium truncate max-w-[60%]">{f.nome}</span>
                  <span className="text-yellow-700 shrink-0">{f.diasAteVencer} dias para vencer · {f.restaurante}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {expVencendo.length > 0 && (
          <div>
            <span className="inline-block bg-orange-100 text-orange-700 text-xs font-semibold px-2 py-0.5 rounded-full mb-2">
              Experiência Vencendo ({expVencendo.length})
            </span>
            <ul className="space-y-1">
              {expVencendo.slice(0, 6).map((f) => (
                <li key={f.id} className="flex items-center justify-between text-xs text-orange-800">
                  <span className="font-medium truncate max-w-[60%]">{f.nome}</span>
                  <span className="text-orange-600 shrink-0">{f.diasRestantes} dias restantes de experiência · {f.restaurante}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── ExperienciaCard ──────────────────────────────────────────────────────────

const TIPO_DEMISSAO_OPTIONS = [
  { value: "SEM_JUSTA_CAUSA", label: "Sem Justa Causa" },
  { value: "JUSTA_CAUSA",     label: "Justa Causa" },
  { value: "ACORDO",          label: "Acordo" },
  { value: "PEDIU_DEMISSAO",  label: "Pediu Demissão" },
];

function ExperienciaCard({ data }: { data: AdvancedData }) {
  const [items, setItems] = useState(data.emExperiencia);
  const [demitindoId, setDemitindoId] = useState<string | null>(null);
  const [form, setForm] = useState({ dataDemissao: "", tipoDemissao: "" });
  const [saving, setSaving] = useState(false);

  async function confirmarDemissao(id: string) {
    if (!form.dataDemissao || !form.tipoDemissao) return;
    setSaving(true);
    try {
      await fetch(`/api/funcionarios/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DEMITIDO", dataDemissao: form.dataDemissao, tipoDemissao: form.tipoDemissao }),
      });
      setItems(prev => prev.filter(f => f.id !== id));
      setDemitindoId(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Clock size={16} className="text-blue-600" />
            </div>
            Em Experiência
          </div>
          <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">
            {items.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {items.length === 0 ? (
          <p className="text-sm text-gray-400 italic py-4 text-center">Nenhum colaborador em período de experiência</p>
        ) : (
          <ul className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {items.map((f) => {
              const pct = Math.round((f.diasNaEmpresa / 90) * 100);
              const badgeColor =
                f.diasRestantes <= 15 ? "bg-red-100 text-red-700" :
                f.diasRestantes <= 30 ? "bg-yellow-100 text-yellow-700" :
                "bg-green-100 text-green-700";
              const isOpen = demitindoId === f.id;
              return (
                <li key={f.id} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 truncate">{f.nome}</p>
                      <p className="text-xs text-gray-400 truncate">{f.restaurante} · {f.cargo}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badgeColor}`}>
                        {f.diasRestantes}d
                      </span>
                      <button
                        onClick={() => {
                          setDemitindoId(isOpen ? null : f.id);
                          setForm({ dataDemissao: "", tipoDemissao: "" });
                        }}
                        className="text-[11px] font-semibold px-2 py-0.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                      >
                        {isOpen ? "Cancelar" : "Demitir"}
                      </button>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        f.diasRestantes <= 15 ? "bg-red-500" :
                        f.diasRestantes <= 30 ? "bg-yellow-400" : "bg-blue-500"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {isOpen && (
                    <div className="bg-red-50 border border-red-100 rounded-xl p-3 space-y-2">
                      <p className="text-xs font-semibold text-red-700">Registrar demissão — {f.nome}</p>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <label className="text-[10px] text-gray-500 mb-1 block">Data de demissão</label>
                          <input
                            type="date"
                            value={form.dataDemissao}
                            onChange={e => setForm(p => ({ ...p, dataDemissao: e.target.value }))}
                            className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-400"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-[10px] text-gray-500 mb-1 block">Tipo</label>
                          <select
                            value={form.tipoDemissao}
                            onChange={e => setForm(p => ({ ...p, tipoDemissao: e.target.value }))}
                            className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-400"
                          >
                            <option value="">Selecione</option>
                            {TIPO_DEMISSAO_OPTIONS.map(o => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <button
                        onClick={() => confirmarDemissao(f.id)}
                        disabled={!form.dataDemissao || !form.tipoDemissao || saving}
                        className="w-full text-xs font-semibold bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white rounded-lg py-1.5 transition-colors flex items-center justify-center gap-1"
                      >
                        {saving ? <Loader2 size={12} className="animate-spin" /> : null}
                        Confirmar Demissão
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ─── HorasExtrasCard ──────────────────────────────────────────────────────────

function HorasExtrasCard({ data }: { data: AdvancedData }) {
  const items = data.horasExtrasMesAnterior;
  const maxHoras = items.length > 0 ? items[0].totalHoras : 1;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
            <AlarmClock size={16} className="text-orange-600" />
          </div>
          Mais Horas Extras
          <span className="text-xs font-normal text-gray-400 ml-1">({data.mesAntLabel})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {items.length === 0 ? (
          <p className="text-sm text-gray-400 italic py-4 text-center">Nenhum registro de horas extras no mês anterior</p>
        ) : (
          <ol className="space-y-2.5">
            {items.map((f, i) => (
              <li key={f.id} className="flex items-center gap-3">
                <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${
                  i === 0 ? "bg-red-600 text-white" : i === 1 ? "bg-orange-500 text-white" : i === 2 ? "bg-amber-400 text-white" : "bg-gray-200 text-gray-600"
                }`}>{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-xs font-semibold text-gray-900 truncate max-w-[65%]">{f.nome}</p>
                    <span className={`text-xs font-bold shrink-0 ${i === 0 ? "text-red-600" : "text-gray-600"}`}>{f.totalHoras}h</span>
                  </div>
                  <p className="text-[10px] text-gray-400 truncate">{f.restaurante} · {f.cargo}</p>
                  <div className="mt-1 h-1 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${i === 0 ? "bg-red-500" : "bg-orange-300"}`}
                      style={{ width: `${Math.round((f.totalHoras / maxHoras) * 100)}%` }}
                    />
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

// ─── ScoreCard ────────────────────────────────────────────────────────────────

function ScoreCard({ data }: { data: AdvancedData }) {
  const items = data.scoresDisciplinares;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
            <ShieldAlert size={16} className="text-red-600" />
          </div>
          Colaboradores em Atenção
          <span className="text-xs font-normal text-gray-400 ml-1">(mês atual + anterior)</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {items.length === 0 ? (
          <p className="text-sm text-gray-400 italic py-4 text-center">
            Nenhum colaborador com ocorrências no período
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 pr-3 text-gray-500 font-medium">Colaborador</th>
                  <th className="text-left py-2 pr-3 text-gray-500 font-medium">Nível</th>
                  <th className="text-center py-2 px-1 text-gray-500 font-medium">Atr.</th>
                  <th className="text-center py-2 px-1 text-gray-500 font-medium">Falt.</th>
                  <th className="text-center py-2 px-1 text-gray-500 font-medium">Adv.</th>
                  <th className="text-center py-2 px-1 text-gray-500 font-medium">Ates.</th>
                  <th className="text-center py-2 pl-1 text-gray-500 font-medium">Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-2 pr-3">
                      <p className="font-semibold text-gray-900 truncate max-w-[160px]">{s.nome}</p>
                      <p className="text-gray-400 truncate max-w-[160px]">{s.restaurante}</p>
                    </td>
                    <td className="py-2 pr-3">
                      {s.nivel === "critico" ? (
                        <span className="inline-flex items-center gap-1 bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold whitespace-nowrap">
                          🔴 Crítico
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-semibold whitespace-nowrap">
                          🟡 Atenção
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-1 text-center">
                      <span className={`font-bold ${s.atrasos > 0 ? "text-orange-500" : "text-gray-300"}`}>{s.atrasos}</span>
                    </td>
                    <td className="py-2 px-1 text-center">
                      <span className={`font-bold ${s.faltas > 0 ? "text-red-500" : "text-gray-300"}`}>{s.faltas}</span>
                    </td>
                    <td className="py-2 px-1 text-center">
                      <span className={`font-bold ${s.advertencias > 0 ? "text-gray-700" : "text-gray-300"}`}>{s.advertencias}</span>
                    </td>
                    <td className="py-2 px-1 text-center">
                      <span className={`font-bold ${s.atestados > 0 ? "text-blue-500" : "text-gray-300"}`}>{s.atestados}</span>
                    </td>
                    <td className="py-2 pl-1 text-center">
                      <span className={`font-bold text-sm ${s.nivel === "critico" ? "text-red-600" : "text-yellow-600"}`}>
                        {s.score}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── HeatmapAtrasos ───────────────────────────────────────────────────────────

function HeatmapAtrasos({ data }: { data: AdvancedData }) {
  if (!data.heatmap.total) return null;
  const { porDia, total, porLoja } = data.heatmap;
  const maxCount = Math.max(...porDia.map((d) => d.count), 1);

  function cellBg(count: number) {
    if (count === 0) return "bg-gray-50 text-gray-300";
    const ratio = count / maxCount;
    if (ratio < 0.25) return "bg-red-100 text-red-700";
    if (ratio < 0.6) return "bg-red-300 text-red-900";
    return "bg-red-600 text-white";
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
            <Activity size={16} className="text-red-600" />
          </div>
          Atrasos por Dia da Semana
          <span className="text-xs font-normal text-gray-400 ml-1">(90 dias · {total} total)</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        <div className="flex gap-2">
          {porDia.map((d) => (
            <div
              key={d.dia}
              className={`flex-1 rounded-xl p-2 text-center transition-colors ${cellBg(d.count)}`}
            >
              <p className="text-xs font-medium opacity-70 mb-1">{d.nome}</p>
              <p className="text-lg font-bold leading-none">{d.count}</p>
            </div>
          ))}
        </div>
        {porLoja.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Por Loja</p>
            <div className="flex flex-wrap gap-2">
              {porLoja.slice(0, 8).map((l) => (
                <span key={l.nome} className="bg-red-50 text-red-700 text-xs font-medium px-2.5 py-1 rounded-full border border-red-100">
                  {l.nome}: {l.count}
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── ComparativoLojas ─────────────────────────────────────────────────────────

function ComparativoLojas({ data }: { data: AdvancedData }) {
  const rows = data.comparativoLojas;
  if (rows.length === 0) return null;

  // Find max values per column for highlighting
  const maxAtivos   = Math.max(...rows.map((r) => r.totalAtivos));
  const maxAtrasos  = Math.max(...rows.map((r) => r.atrasos));
  const maxFaltas   = Math.max(...rows.map((r) => r.faltas));
  const maxAdv      = Math.max(...rows.map((r) => r.advertencias));
  const maxAdm      = Math.max(...rows.map((r) => r.admissoes));
  const maxDem      = Math.max(...rows.map((r) => r.demissoes));
  const maxTurnover = Math.max(...rows.map((r) => r.turnoverPct));

  function cellClass(val: number, max: number) {
    return val === max && max > 0 ? "text-red-600 font-bold" : "text-gray-700";
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
            <BarChart2 size={16} className="text-gray-600" />
          </div>
          Comparativo entre Lojas
          <span className="text-xs font-normal text-gray-400 ml-1">(30 dias)</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 pr-3 text-gray-500 font-medium">Loja</th>
                <th className="text-center py-2 px-2 text-gray-500 font-medium">Ativos</th>
                <th className="text-center py-2 px-2 text-gray-500 font-medium">Atrasos</th>
                <th className="text-center py-2 px-2 text-gray-500 font-medium">Faltas</th>
                <th className="text-center py-2 px-2 text-gray-500 font-medium">Adv.</th>
                <th className="text-center py-2 px-2 text-gray-500 font-medium">Adm.</th>
                <th className="text-center py-2 px-2 text-gray-500 font-medium">Dem.</th>
                <th className="text-center py-2 pl-2 text-gray-500 font-medium">Turnover%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((r) => (
                <tr key={r.restaurante} className="hover:bg-gray-50 transition-colors">
                  <td className="py-2 pr-3 font-medium text-gray-800 truncate max-w-[140px]">{r.restaurante}</td>
                  <td className={`py-2 px-2 text-center ${cellClass(r.totalAtivos, maxAtivos)}`}>{r.totalAtivos}</td>
                  <td className={`py-2 px-2 text-center ${cellClass(r.atrasos, maxAtrasos)}`}>{r.atrasos}</td>
                  <td className={`py-2 px-2 text-center ${cellClass(r.faltas, maxFaltas)}`}>{r.faltas}</td>
                  <td className={`py-2 px-2 text-center ${cellClass(r.advertencias, maxAdv)}`}>{r.advertencias}</td>
                  <td className={`py-2 px-2 text-center ${cellClass(r.admissoes, maxAdm)}`}>{r.admissoes}</td>
                  <td className={`py-2 px-2 text-center ${cellClass(r.demissoes, maxDem)}`}>{r.demissoes}</td>
                  <td className={`py-2 pl-2 text-center ${cellClass(r.turnoverPct, maxTurnover)}`}>{r.turnoverPct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({ title, value, sub, icon: Icon, color, trend }: {
  title: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string;
  trend?: { value: number; label: string; positive?: boolean };
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm text-gray-500 font-medium">{title}</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
            {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
            {trend && (
              <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${
                (trend.positive ?? trend.value >= 0) ? "text-green-600" : "text-red-600"
              }`}>
                {(trend.positive ?? trend.value >= 0) ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {Math.abs(trend.value)} {trend.label}
              </div>
            )}
          </div>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
            <Icon size={22} className="text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── RankingColumn ────────────────────────────────────────────────────────────

const MEDAL_COLORS = ["bg-red-600", "bg-orange-500", "bg-amber-400", "bg-gray-300", "bg-gray-200"];
const MEDAL_TEXT   = ["text-white",  "text-white",    "text-white",   "text-gray-700", "text-gray-600"];

function RankingColumn({ title, subtitle, icon: Icon, iconColor, items, emptyMsg }: {
  title: string; subtitle: string;
  icon: React.ElementType; iconColor: string;
  items: RankingItem[]; emptyMsg: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${iconColor}`}>
          <Icon size={14} className="text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900 leading-none">{title}</p>
          <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-gray-400 italic py-2">{emptyMsg}</p>
      ) : (
        <ol className="space-y-2">
          {items.map((item, i) => (
            <li key={item.funcionarioId} className="flex items-center gap-2.5">
              <span className={`w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${MEDAL_COLORS[i]} ${MEDAL_TEXT[i]}`}>
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-800 truncate">{item.nome}</p>
                <div className="mt-0.5 h-1 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${i === 0 ? "bg-red-500" : "bg-gray-400"}`}
                    style={{ width: `${Math.round((item.count / items[0].count) * 100)}%` }}
                  />
                </div>
              </div>
              <span className={`text-xs font-bold shrink-0 ${i === 0 ? "text-red-600" : "text-gray-500"}`}>
                {item.count}x
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// ─── BirthdayWidget ───────────────────────────────────────────────────────────

function BirthdayWidget() {
  const today = new Date();
  const [month, setMonth] = useState(today.getUTCMonth() + 1);
  const [list, setList] = useState<Aniversariante[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/aniversarios?month=${month}`)
      .then((r) => r.json())
      .then(setList)
      .finally(() => setLoading(false));
  }, [month]);

  function changeMonth(delta: number) {
    setMonth((m) => ((m - 1 + delta + 12) % 12) + 1);
  }

  const todayCount = list.filter((a) => a.isToday).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
              <Cake size={16} className="text-red-600" />
            </div>
            <CardTitle className="text-base">Aniversariantes</CardTitle>
            {todayCount > 0 && (
              <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">
                {todayCount} hoje!
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => changeMonth(-1)} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors text-lg leading-none">‹</button>
            <span className="text-sm font-medium text-gray-700 w-20 text-center">{MONTHS_PT[month - 1]}</span>
            <button onClick={() => changeMonth(1)} className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors text-lg leading-none">›</button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : list.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Cake size={28} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhum aniversariante em {MONTHS_PT[month - 1]}</p>
          </div>
        ) : (
          <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {list.map((a) => (
              <li key={a.id} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all ${
                a.isToday ? "bg-red-50 border border-red-200" : "hover:bg-gray-50"
              }`}>
                <div className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center shrink-0 ${
                  a.isToday ? "bg-red-600 text-white" : "bg-gray-100 text-gray-700"
                }`}>
                  <span className="text-base font-bold leading-none">{String(a.dia).padStart(2, "0")}</span>
                  <span className="text-[9px] font-medium leading-tight opacity-70 uppercase">{MONTHS_PT[a.mes - 1].slice(0, 3)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold truncate ${a.isToday ? "text-red-700" : "text-gray-900"}`}>
                    {a.nome}{a.isToday && <span className="ml-1.5 text-xs">🎂</span>}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{a.cargo} · {a.restaurante}</p>
                </div>
                {a.isToday && <span className="text-xs font-bold text-red-600 shrink-0">Hoje</span>}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ─── DashboardContent ─────────────────────────────────────────────────────────

function defaultLastMonth(): string {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function DashboardContent() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [rankings, setRankings] = useState<RankingData | null>(null);
  const [rankingLoading, setRankingLoading] = useState(true);
  const [rankingFilter, setRankingFilter] = useState<RankingFilter>({
    period: "month",
    month: defaultLastMonth(),
  });
  const [advanced, setAdvanced] = useState<AdvancedData | null>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch("/api/dashboard/advanced")
      .then((r) => r.json())
      .then(setAdvanced)
      .catch(console.error);
  }, []);

  const fetchRankings = useCallback((filter: RankingFilter) => {
    setRankingLoading(true);
    const params = filter.period === "all"
      ? "period=all"
      : `month=${filter.month}`;
    fetch(`/api/dashboard/ranking?${params}`)
      .then((r) => r.json())
      .then(setRankings)
      .catch(console.error)
      .finally(() => setRankingLoading(false));
  }, []);

  useEffect(() => {
    fetchRankings(rankingFilter);
  }, [rankingFilter, fetchRankings]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) return <p className="text-gray-500">Erro ao carregar dados.</p>;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Funcionários Ativos"
          value={data.funcionariosAtivos}
          icon={Users}
          color="bg-red-600"
        />
        <StatCard
          title="Em Férias"
          value={data.feriasMes}
          sub="Atualmente"
          icon={Umbrella}
          color="bg-red-800"
        />
        <StatCard
          title="Admissões no Mês"
          value={data.admissoesMes}
          sub="Novas contratações"
          icon={TrendingUp}
          color="bg-green-600"
          trend={data.admissoesMes > 0 ? { value: data.admissoesMes, label: "este mês", positive: true } : undefined}
        />
        <StatCard
          title="Demissões no Mês"
          value={data.demissoesMes}
          sub="Desligamentos"
          icon={TrendingDown}
          color="bg-gray-800"
          trend={data.demissoesMes > 0 ? { value: data.demissoesMes, label: "este mês", positive: false } : undefined}
        />
      </div>

      {/* Alertas RH */}
      {advanced ? (
        (advanced.feriasVencidas.length > 0 ||
          advanced.feriasVencendo.length > 0 ||
          advanced.emExperiencia.some((e) => e.alerta === "vencendo")) && (
          <AlertasRH data={advanced} />
        )
      ) : (
        <SkeletonCard />
      )}

      {/* Experiência + Horas Extras */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {advanced ? <ExperienciaCard data={advanced} /> : <SkeletonCard />}
        {advanced ? <HorasExtrasCard data={advanced} /> : <SkeletonCard />}
      </div>

      {/* Score Disciplinar */}
      {advanced ? <ScoreCard data={advanced} /> : <SkeletonCard />}

      {/* Heatmap */}
      {advanced?.heatmap.total ? <HeatmapAtrasos data={advanced} /> : null}

      {/* Comparativo Lojas */}
      {advanced ? <ComparativoLojas data={advanced} /> : <SkeletonCard />}

      {/* Ranking */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert size={18} className="text-red-600" />
              Ranking de Ocorrências
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex bg-gray-100 p-0.5 rounded-lg">
                <button
                  onClick={() => setRankingFilter((f) => ({ ...f, period: "month" }))}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${rankingFilter.period === "month" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
                >
                  Por mês
                </button>
                <button
                  onClick={() => setRankingFilter((f) => ({ ...f, period: "all" }))}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${rankingFilter.period === "all" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
                >
                  Todo o período
                </button>
              </div>
              {rankingFilter.period === "month" && (
                <input
                  type="month"
                  value={rankingFilter.month}
                  onChange={(e) => setRankingFilter((f) => ({ ...f, month: e.target.value }))}
                  className="h-8 rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent transition-colors"
                />
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {rankingLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 size={20} className="animate-spin text-red-500" />
            </div>
          ) : rankings && (
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-6 divide-x-0 xl:divide-x divide-gray-100">
              {(() => {
                const subtitle = rankingFilter.period === "all"
                  ? "Todo o período"
                  : new Date(rankingFilter.month + "-02").toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
                return (
                  <>
                    <RankingColumn title="Atrasos" subtitle={subtitle} icon={AlarmClock} iconColor="bg-red-600" items={rankings.rankingAtrasos} emptyMsg="Nenhum atraso" />
                    <div className="xl:pl-6">
                      <RankingColumn title="Faltas" subtitle={subtitle} icon={XCircle} iconColor="bg-rose-700" items={rankings.rankingFaltas} emptyMsg="Nenhuma falta" />
                    </div>
                    <div className="xl:pl-6">
                      <RankingColumn title="Atestados" subtitle={subtitle} icon={FileText} iconColor="bg-orange-500" items={rankings.rankingAtestados} emptyMsg="Nenhum atestado" />
                    </div>
                    <div className="xl:pl-6">
                      <RankingColumn title="Advertências" subtitle={subtitle} icon={ShieldAlert} iconColor="bg-gray-700" items={rankings.rankingAdvertencias} emptyMsg="Nenhuma advertência" />
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Birthday + Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-1">
          <BirthdayWidget />
        </div>
        <div className="xl:col-span-2 grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Funcionários por Restaurante</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.funcionariosPorRestaurante} margin={{ top: 5, right: 20, left: 0, bottom: 55 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="nome"
                    tick={{ fontSize: 10 }}
                    angle={-30}
                    textAnchor="end"
                    interval={0}
                    tickFormatter={(v: string) => v.length > 18 ? v.slice(0, 17) + "…" : v}
                  />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                    formatter={(value) => [value, "Funcionários ativos"]}
                  />
                  <Bar dataKey="total" fill="#C41E2E" radius={[4, 4, 0, 0]} name="Funcionários ativos" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Distribuição por Unidade</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <ResponsiveContainer width="100%" height={220} className="sm:max-w-[55%]">
                  <PieChart>
                    <Pie
                      data={data.funcionariosPorRestaurante}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={90}
                      dataKey="total"
                      nameKey="nome"
                    >
                      {data.funcionariosPorRestaurante.map((_, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: "8px", fontSize: "12px" }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex sm:flex-col flex-wrap justify-center gap-x-4 gap-y-2">
                  {data.funcionariosPorRestaurante.map((r, i) => (
                    <div key={r.nome} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <div className="min-w-0">
                        <p className="text-xs text-gray-700 font-medium">{r.nome}</p>
                        <p className="text-xs text-gray-400">{r.total} funcionários</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
