"use client";
import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Users, Building2, Umbrella, DollarSign, TrendingUp, TrendingDown, Clock, Cake } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

const MONTHS_PT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

interface Aniversariante {
  id: string;
  nome: string;
  dia: number;
  mes: number;
  cargo: string;
  restaurante: string;
  isToday: boolean;
}

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
              <li
                key={a.id}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all ${
                  a.isToday
                    ? "bg-red-50 border border-red-200"
                    : "hover:bg-gray-50"
                }`}
              >
                {/* Day badge */}
                <div className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center shrink-0 ${
                  a.isToday ? "bg-red-600 text-white" : "bg-gray-100 text-gray-700"
                }`}>
                  <span className="text-base font-bold leading-none">{String(a.dia).padStart(2, "0")}</span>
                  <span className="text-[9px] font-medium leading-tight opacity-70 uppercase">{MONTHS_PT[a.mes - 1].slice(0, 3)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold truncate ${a.isToday ? "text-red-700" : "text-gray-900"}`}>
                    {a.nome}
                    {a.isToday && <span className="ml-1.5 text-xs">🎂</span>}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{a.cargo} · {a.restaurante}</p>
                </div>
                {a.isToday && (
                  <span className="text-xs font-bold text-red-600 shrink-0">Hoje</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

interface DashboardData {
  totalFuncionarios: number;
  funcionariosAtivos: number;
  totalRestaurantes: number;
  feriasMes: number;
  folhaMes: number;
  admissoesMes: number;
  demissoesMes: number;
  funcionariosPorRestaurante: { nome: string; total: number }[];
  registrosPontoHoje: number;
}

const COLORS = ["#C41E2E", "#1A1A1A", "#E8293B", "#4B4B4B", "#9B1623", "#6B6B6B"];

function StatCard({
  title, value, sub, icon: Icon, color, trend,
}: {
  title: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color: string;
  trend?: { value: number; label: string };
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
              <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trend.value >= 0 ? "text-green-600" : "text-red-600"}`}>
                {trend.value >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
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

export function DashboardContent() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-orange-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) return <p className="text-gray-500">Erro ao carregar dados.</p>;

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Total de Funcionários"
          value={data.totalFuncionarios}
          sub={`${data.funcionariosAtivos} ativos`}
          icon={Users}
          color="bg-red-600"
          trend={{ value: data.admissoesMes, label: "admissões este mês" }}
        />
        <StatCard
          title="Restaurantes Ativos"
          value={data.totalRestaurantes}
          sub="Unidades do grupo"
          icon={Building2}
          color="bg-gray-900"
        />
        <StatCard
          title="Em Férias"
          value={data.feriasMes}
          sub="Funcionários atualmente"
          icon={Umbrella}
          color="bg-red-800"
        />
        <StatCard
          title="Folha do Mês"
          value={formatCurrency(data.folhaMes)}
          sub="Salários líquidos"
          icon={DollarSign}
          color="bg-green-600"
        />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <TrendingUp size={22} className="text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Admissões no mês</p>
              <p className="text-2xl font-bold text-green-600">{data.admissoesMes}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
              <TrendingDown size={22} className="text-red-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Demissões no mês</p>
              <p className="text-2xl font-bold text-red-600">{data.demissoesMes}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
              <Clock size={22} className="text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Registros de ponto hoje</p>
              <p className="text-2xl font-bold text-orange-600">{data.registrosPontoHoje}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Birthday widget + Charts */}
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
                <XAxis dataKey="nome" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                />
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
              <div className="flex sm:flex-col flex-wrap justify-center gap-x-4 gap-y-2 sm:gap-y-2">
                {data.funcionariosPorRestaurante.map((r, i) => (
                  <div key={r.nome} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
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
