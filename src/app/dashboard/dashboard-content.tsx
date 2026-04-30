"use client";
import { useCallback, useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Users, Umbrella, TrendingUp, TrendingDown, Cake, AlarmClock, XCircle, FileText, ShieldAlert, Loader2 } from "lucide-react";
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

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
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
                <BarChart data={data.funcionariosPorRestaurante} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="nome" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }} />
                  <Bar dataKey="total" fill="#C41E2E" radius={[4, 4, 0, 0]} name="Funcionários" />
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
