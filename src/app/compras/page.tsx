"use client";
import { useEffect, useState } from "react";
import { ShoppingCart, Wrench, Package, AlertTriangle, Clock, CheckCircle2, XCircle } from "lucide-react";
import Link from "next/link";

type ReqCompra = { id: string; status: string; urgencia: string };
type ReqServico = { id: string; status: string; urgencia: string };
type Produto = { id: string; quantidadeAtual: number; quantidadeMinima: number };

const URGENCIA_COLOR: Record<string, string> = {
  URGENTE: "bg-red-100 text-red-700",
  ALTA:    "bg-orange-100 text-orange-700",
  MEDIA:   "bg-yellow-100 text-yellow-700",
  BAIXA:   "bg-green-100 text-green-700",
};

function StatCard({ title, value, sub, href, color, icon: Icon }: {
  title: string; value: number; sub: string; href: string; color: string; icon: React.ElementType;
}) {
  return (
    <Link href={href} className="block bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
          <p className="text-sm text-gray-500 mt-0.5">{sub}</p>
        </div>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
          <Icon size={22} className="text-white" />
        </div>
      </div>
    </Link>
  );
}

export default function ComprasDashboard() {
  const [compras, setCompras] = useState<ReqCompra[]>([]);
  const [servicos, setServicos] = useState<ReqServico[]>([]);
  const [estoque, setEstoque] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/compras/requisicoes").then((r) => r.json()),
      fetch("/api/compras/servicos").then((r) => r.json()),
      fetch("/api/compras/estoque").then((r) => r.json()),
    ]).then(([c, s, e]) => {
      setCompras(Array.isArray(c) ? c : []);
      setServicos(Array.isArray(s) ? s : []);
      setEstoque(Array.isArray(e) ? e : []);
    }).finally(() => setLoading(false));
  }, []);

  const comprasPendentes = compras.filter((r) => r.status === "PENDENTE").length;
  const servicosPendentes = servicos.filter((r) => r.status === "PENDENTE" || r.status === "EM_ANDAMENTO").length;
  const estoqueCritico = estoque.filter((p) => p.quantidadeAtual <= p.quantidadeMinima && p.quantidadeMinima > 0).length;
  const urgentes = [...compras, ...servicos].filter((r) => r.urgencia === "URGENTE" && r.status !== "CONCLUIDA" && r.status !== "CANCELADO" && r.status !== "RECUSADA").length;

  return (
    <main className="flex-1 p-4 sm:p-6 bg-gray-50">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-0.5">Visão geral de compras e estoque</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-gray-400">Carregando...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard
              title="Compras pendentes"
              value={comprasPendentes}
              sub="aguardando aprovação"
              href="/compras/requisicoes"
              color="bg-blue-600"
              icon={ShoppingCart}
            />
            <StatCard
              title="Serviços ativos"
              value={servicosPendentes}
              sub="pendentes ou em andamento"
              href="/compras/servicos"
              color="bg-violet-600"
              icon={Wrench}
            />
            <StatCard
              title="Itens críticos"
              value={estoqueCritico}
              sub="abaixo do mínimo"
              href="/compras/estoque"
              color="bg-amber-500"
              icon={Package}
            />
            <StatCard
              title="Urgências"
              value={urgentes}
              sub="requer atenção imediata"
              href="/compras/requisicoes"
              color="bg-red-600"
              icon={AlertTriangle}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Compras */}
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">Últimas Requisições de Compra</h2>
                <Link href="/compras/requisicoes" className="text-blue-600 text-sm hover:underline">Ver todas</Link>
              </div>
              <div className="divide-y divide-gray-50">
                {compras.slice(0, 5).map((r) => (
                  <div key={r.id} className="px-5 py-3 flex items-center justify-between">
                    <StatusBadge status={(r as Record<string, string>).status} />
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${URGENCIA_COLOR[r.urgencia] ?? ""}`}>
                      {r.urgencia}
                    </span>
                  </div>
                ))}
                {compras.length === 0 && (
                  <p className="px-5 py-8 text-center text-gray-400 text-sm">Nenhuma requisição ainda.</p>
                )}
              </div>
            </div>

            {/* Recent Servicos */}
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">Últimas Requisições de Serviço</h2>
                <Link href="/compras/servicos" className="text-violet-600 text-sm hover:underline">Ver todas</Link>
              </div>
              <div className="divide-y divide-gray-50">
                {servicos.slice(0, 5).map((r) => (
                  <div key={r.id} className="px-5 py-3 flex items-center justify-between">
                    <StatusBadge status={(r as Record<string, string>).status} />
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${URGENCIA_COLOR[r.urgencia] ?? ""}`}>
                      {r.urgencia}
                    </span>
                  </div>
                ))}
                {servicos.length === 0 && (
                  <p className="px-5 py-8 text-center text-gray-400 text-sm">Nenhuma requisição ainda.</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  );
}

const STATUS_MAP: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
  PENDENTE:     { label: "Pendente",     icon: Clock,         cls: "text-amber-600 bg-amber-50" },
  APROVADA:     { label: "Aprovada",     icon: CheckCircle2,  cls: "text-green-600 bg-green-50" },
  EM_COMPRA:    { label: "Em compra",    icon: ShoppingCart,  cls: "text-blue-600 bg-blue-50" },
  CONCLUIDA:    { label: "Concluída",    icon: CheckCircle2,  cls: "text-gray-600 bg-gray-50" },
  RECUSADA:     { label: "Recusada",     icon: XCircle,       cls: "text-red-600 bg-red-50" },
  EM_ANDAMENTO: { label: "Em andamento", icon: Clock,         cls: "text-blue-600 bg-blue-50" },
  CANCELADO:    { label: "Cancelado",    icon: XCircle,       cls: "text-red-600 bg-red-50" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? { label: status, icon: Clock, cls: "text-gray-600 bg-gray-50" };
  const Icon = s.icon;
  return (
    <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${s.cls}`}>
      <Icon size={12} /> {s.label}
    </span>
  );
}
