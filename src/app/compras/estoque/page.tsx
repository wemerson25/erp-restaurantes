"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import {
  ClipboardList, ShoppingCart, BarChart3, Settings2,
  ChevronLeft, ChevronRight, AlertTriangle, Check, Loader2,
  Plus, Pencil, Trash2, X, TrendingUp, TrendingDown, Minus,
  Share2, Copy, CheckCheck,
} from "lucide-react";
import {
  calcularPedido, getSemanaRef, formatarSemana, navegarSemana,
  calcularUsoReal, calcularMedias,
} from "@/lib/calculos-estoque";

// ─── Types ──────────────────────────────────────────────────────────────────

type Produto = {
  id: string; nome: string; categoria: string; unidade: string;
  quantidadeAtual: number; quantidadeMinima: number;
  metaSemanal: number; qtdPorPacote: number; ilimitado: number;
  sacaThresholdCheia: number | null; sacaThresholdMeia: number | null;
  restaurante: string | null; ordemCategoria: number; ativo: number; setor: string;
};

type ContagemMap = Record<string, { qtdContada: number; qtdDeposito: number }>;

type HistoricoProduto = {
  id: string; nome: string; unidade: string; categoria: string;
  metaSemanal: number;
  medias: { diaria: number; semanal: number; mensal: number };
  alerta: boolean;
  historicos: { semanaRef: string; estoqueInicial: number; comprasDia: number; contagemFim: number; usoReal: number }[];
};

type Tab = "contagem" | "pedidos" | "historico" | "produtos";

const emptyProduto = () => ({
  nome: "", categoria: "GERAL", unidade: "un",
  quantidadeAtual: 0, quantidadeMinima: 0,
  metaSemanal: 0, qtdPorPacote: 1, ilimitado: false,
  sacaThresholdCheia: "", sacaThresholdMeia: "",
  restaurante: "", ordemCategoria: 0, setor: "Geral",
});

// ─── Main Component ──────────────────────────────────────────────────────────

export default function EstoquePage() {
  const [tab, setTab] = useState<Tab>("contagem");
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [semana, setSemana] = useState(getSemanaRef());
  const [restaurante, setRestaurante] = useState("");
  const [loadingProd, setLoadingProd] = useState(true);

  const loadProdutos = useCallback(() => {
    setLoadingProd(true);
    fetch("/api/compras/estoque")
      .then((r) => r.json())
      .then((d) => setProdutos(Array.isArray(d) ? d : []))
      .finally(() => setLoadingProd(false));
  }, []);

  useEffect(loadProdutos, [loadProdutos]);

  // All distinct restaurante values from products
  const restaurantes = Array.from(new Set(produtos.map((p) => p.restaurante ?? "").filter(Boolean)));

  const tabBtns: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "contagem", label: "Contagem", icon: ClipboardList },
    { key: "pedidos",  label: "Pedidos",  icon: ShoppingCart },
    { key: "historico", label: "Histórico", icon: BarChart3 },
    { key: "produtos",  label: "Produtos",  icon: Settings2 },
  ];

  const produtosFiltrados = restaurante
    ? produtos.filter((p) => p.restaurante === restaurante)
    : produtos;

  return (
    <main className="flex-1 bg-gray-50 min-h-screen">
      {/* Page header */}
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Controle de Estoque</h1>
            <p className="text-gray-500 text-sm">{produtos.length} produtos cadastrados</p>
          </div>
          {/* Restaurante selector */}
          <select
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
            value={restaurante}
            onChange={(e) => setRestaurante(e.target.value)}
          >
            <option value="">Todas as unidades</option>
            {restaurantes.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4 overflow-x-auto">
          {tabBtns.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                tab === key
                  ? "bg-amber-500 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="p-4 sm:p-6">
        {loadingProd && tab !== "historico" ? (
          <div className="flex items-center justify-center h-48 text-gray-400">
            <Loader2 size={24} className="animate-spin mr-2" /> Carregando produtos...
          </div>
        ) : (
          <>
            {tab === "contagem" && (
              <ContagemTab
                produtos={produtosFiltrados}
                semana={semana}
                restaurante={restaurante}
                onSemanaChange={setSemana}
              />
            )}
            {tab === "pedidos" && (
              <PedidosTab
                semana={semana}
                restaurante={restaurante}
                onSemanaChange={setSemana}
              />
            )}
            {tab === "historico" && (
              <HistoricoTab restaurante={restaurante} />
            )}
            {tab === "produtos" && (
              <ProdutosTab produtos={produtos} onRefresh={loadProdutos} />
            )}
          </>
        )}
      </div>
    </main>
  );
}

// ─── Contagem Tab ────────────────────────────────────────────────────────────

function ContagemTab({
  produtos, semana, restaurante, onSemanaChange,
}: {
  produtos: Produto[]; semana: string; restaurante: string; onSemanaChange: (s: string) => void;
}) {
  const [contagens, setContagens] = useState<ContagemMap>({});
  const [loadingContagem, setLoadingContagem] = useState(true);
  const [finalizando, setFinalizando] = useState(false);
  const [finalizado, setFinalizado] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [copiedSetor, setCopiedSetor] = useState<string | null>(null);
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const setores = [...new Set(
    produtos.filter((p) => p.setor && p.setor !== "Geral").map((p) => p.setor)
  )].sort();

  const getSetorUrl = (s: string) =>
    typeof window !== "undefined"
      ? `${window.location.origin}/contagem?semana=${semana}${restaurante ? `&restaurante=${encodeURIComponent(restaurante)}` : ""}&setor=${encodeURIComponent(s)}`
      : "";

  const copySetorLink = (s: string) => {
    navigator.clipboard.writeText(getSetorUrl(s));
    setCopiedSetor(s);
    setTimeout(() => setCopiedSetor(null), 2500);
  };

  const loadContagens = useCallback(() => {
    setLoadingContagem(true);
    fetch(`/api/compras/contagem?semana=${semana}&restaurante=${encodeURIComponent(restaurante)}`)
      .then((r) => r.json())
      .then((d: { produtoId: string; qtdContada: number; qtdDeposito: number }[]) => {
        const map: ContagemMap = {};
        if (Array.isArray(d)) d.forEach((c) => { map[c.produtoId] = { qtdContada: c.qtdContada, qtdDeposito: c.qtdDeposito }; });
        setContagens(map);
      })
      .finally(() => setLoadingContagem(false));
  }, [semana, restaurante]);

  useEffect(loadContagens, [loadContagens]);

  const saveContagem = (produtoId: string, qtdContada: number, qtdDeposito: number) => {
    clearTimeout(debounceTimers.current[produtoId]);
    debounceTimers.current[produtoId] = setTimeout(() => {
      fetch("/api/compras/contagem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ produtoId, semanaRef: semana, restaurante, qtdContada, qtdDeposito }),
      });
    }, 600);
  };

  const handleContagem = (produtoId: string, field: "qtdContada" | "qtdDeposito", val: number) => {
    setContagens((prev) => {
      const cur = prev[produtoId] ?? { qtdContada: 0, qtdDeposito: 0 };
      const next = { ...cur, [field]: val };
      saveContagem(produtoId, next.qtdContada, next.qtdDeposito);
      return { ...prev, [produtoId]: next };
    });
  };

  const finalizar = async () => {
    if (!confirm(`Finalizar a semana ${semana}? Isso salvará o histórico.`)) return;
    setFinalizando(true);
    const res = await fetch("/api/compras/finalizar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ semanaRef: semana, restaurante }),
    });
    setFinalizando(false);
    if (res.ok) setFinalizado(true);
  };

  const categorias = [...new Set(produtos.map((p) => p.categoria))].sort();

  return (
    <div>
      {/* Week navigation */}
      <div className="flex items-center justify-between mb-3 bg-white rounded-xl border border-gray-100 px-4 py-3">
        <button
          onClick={() => onSemanaChange(navegarSemana(semana, -1))}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="text-center">
          <p className="font-semibold text-gray-900">{formatarSemana(semana)}</p>
          <p className="text-xs text-gray-400">{semana}</p>
        </div>
        <button
          onClick={() => onSemanaChange(navegarSemana(semana, 1))}
          disabled={semana >= getSemanaRef()}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-30"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Share button */}
      <button
        onClick={() => setShowShare(true)}
        className="w-full mb-6 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-blue-200 text-blue-600 text-sm font-medium hover:border-blue-400 hover:bg-blue-50 transition-colors"
      >
        <Share2 size={15} /> Compartilhar link para colaboradores contarem
      </button>

      {/* Share modal */}
      {showShare && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900">Links para contagem</h3>
                <p className="text-xs text-gray-400 mt-0.5">{semana} · {restaurante || "Todas as unidades"}</p>
              </div>
              <button onClick={() => setShowShare(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <div className="px-5 py-5 space-y-3">
              {!restaurante ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  Selecione uma unidade para gerar os links de contagem por setor.
                </p>
              ) : setores.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  Nenhum setor encontrado. Cadastre produtos com setor definido.
                </p>
              ) : (
                <>
                  <p className="text-xs text-gray-500">
                    Envie cada link para o responsável do setor. Não é necessário login.
                  </p>
                  <div className="space-y-2">
                    {setores.map((s) => (
                      <div key={s} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900">{s}</p>
                          <p className="text-xs text-gray-400 truncate font-mono">{getSetorUrl(s)}</p>
                        </div>
                        <button
                          onClick={() => copySetorLink(s)}
                          className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                            copiedSetor === s
                              ? "bg-green-500 text-white"
                              : "bg-blue-600 text-white hover:bg-blue-700"
                          }`}
                        >
                          {copiedSetor === s ? <><CheckCheck size={13} /> Copiado</> : <><Copy size={13} /> Copiar</>}
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {loadingContagem ? (
        <div className="flex items-center justify-center h-32 text-gray-400">
          <Loader2 size={20} className="animate-spin mr-2" /> Carregando contagens...
        </div>
      ) : produtos.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <ClipboardList size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">Nenhum produto cadastrado. Adicione produtos na aba Produtos.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {categorias.map((cat) => {
            const prods = produtos.filter((p) => p.categoria === cat);
            return (
              <div key={cat} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{cat}</p>
                </div>
                <div className="divide-y divide-gray-50">
                  {prods.map((p) => {
                    const c = contagens[p.id] ?? { qtdContada: 0, qtdDeposito: 0 };
                    const { qtd, unidadeExibida } = calcularPedido(p, c.qtdContada, c.qtdDeposito, p.unidade);
                    const apedir = p.ilimitado ? "—" : qtd > 0 ? `${qtd} ${unidadeExibida}` : "OK ✓";
                    const urgente = !p.ilimitado && qtd > 0;
                    return (
                      <div key={p.id} className="px-4 py-3">
                        <div className="flex items-center gap-2 mb-2">
                          <p className="font-medium text-gray-900 flex-1 text-sm">{p.nome}</p>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            p.ilimitado ? "bg-gray-100 text-gray-400" :
                            qtd === 0 ? "bg-green-100 text-green-700" :
                            "bg-red-100 text-red-700"
                          }`}>
                            {apedir}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <label className="text-xs text-gray-400 block mb-1">Contagem ({p.unidade})</label>
                            <input
                              type="number"
                              min={0}
                              step="any"
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono text-center focus:outline-none focus:ring-2 focus:ring-amber-500"
                              value={c.qtdContada || ""}
                              onChange={(e) => handleContagem(p.id, "qtdContada", Number(e.target.value) || 0)}
                              placeholder="0"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="text-xs text-gray-400 block mb-1">Depósito ({p.unidade})</label>
                            <input
                              type="number"
                              min={0}
                              step="any"
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono text-center focus:outline-none focus:ring-2 focus:ring-blue-400"
                              value={c.qtdDeposito || ""}
                              onChange={(e) => handleContagem(p.id, "qtdDeposito", Number(e.target.value) || 0)}
                              placeholder="0"
                            />
                          </div>
                          <div className="text-right min-w-[64px]">
                            <p className="text-xs text-gray-400">Meta</p>
                            <p className="text-sm font-semibold text-gray-600">{p.metaSemanal} {p.unidade}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div className="pt-2">
            {finalizado ? (
              <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-green-50 text-green-700 font-medium">
                <Check size={18} /> Semana finalizada com sucesso!
              </div>
            ) : (
              <button
                onClick={finalizar}
                disabled={finalizando || semana > getSemanaRef()}
                className="w-full py-3 rounded-xl bg-amber-500 text-white font-semibold text-sm hover:bg-amber-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {finalizando ? <><Loader2 size={16} className="animate-spin" /> Finalizando...</> : "Finalizar Semana e Salvar Histórico"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Pedidos Tab ─────────────────────────────────────────────────────────────

type PedidoItem = {
  produto: Produto; contagem: number; deposito: number;
  qtdPedido: number; unidadeExibida: string; trazerDeposito: number;
};

function PedidosTab({
  semana, restaurante, onSemanaChange,
}: {
  semana: string; restaurante: string; onSemanaChange: (s: string) => void;
}) {
  const [pedidos, setPedidos] = useState<PedidoItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/compras/pedidos?semana=${semana}&restaurante=${encodeURIComponent(restaurante)}`)
      .then((r) => r.json())
      .then((d) => setPedidos(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, [semana, restaurante]);

  const aOrdenar = pedidos.filter((p) => p.qtdPedido > 0);
  const categorias = [...new Set(aOrdenar.map((p) => p.produto.categoria))].sort();

  const copiarLista = () => {
    const linhas = categorias.flatMap((cat) => {
      const itens = aOrdenar.filter((p) => p.produto.categoria === cat);
      return [`▸ ${cat}`, ...itens.map((p) => `  • ${p.produto.nome}: ${p.qtdPedido} ${p.unidadeExibida}`)];
    });
    navigator.clipboard.writeText(linhas.join("\n"));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 bg-white rounded-xl border border-gray-100 px-4 py-3">
        <button onClick={() => onSemanaChange(navegarSemana(semana, -1))} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ChevronLeft size={18} />
        </button>
        <div className="text-center">
          <p className="font-semibold text-gray-900">{formatarSemana(semana)}</p>
          <p className="text-xs text-gray-400">{aOrdenar.length} itens a pedir</p>
        </div>
        <button onClick={() => onSemanaChange(navegarSemana(semana, 1))} disabled={semana >= getSemanaRef()} className="p-2 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-30">
          <ChevronRight size={18} />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32 text-gray-400"><Loader2 size={20} className="animate-spin mr-2" /> Calculando...</div>
      ) : aOrdenar.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <Check size={40} className="mx-auto text-green-500 mb-3" />
          <p className="text-gray-600 font-medium">Estoque completo!</p>
          <p className="text-gray-400 text-sm mt-1">Nenhum item precisa ser pedido esta semana.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {categorias.map((cat) => {
            const itens = aOrdenar.filter((p) => p.produto.categoria === cat);
            return (
              <div key={cat} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{cat}</p>
                </div>
                <div className="divide-y divide-gray-50">
                  {itens.map(({ produto, contagem, deposito, qtdPedido, unidadeExibida, trazerDeposito }) => (
                    <div key={produto.id} className="px-4 py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 text-sm">{produto.nome}</p>
                        <p className="text-xs text-gray-400">
                          Contagem: {contagem} · Depósito: {deposito} · Meta: {produto.metaSemanal} {produto.unidade}
                          {trazerDeposito > 0 && <span className="text-blue-600"> · Trazer {trazerDeposito} do depósito</span>}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-gray-400">A pedir</p>
                        <p className="text-lg font-bold text-red-600">{qtdPedido} <span className="text-sm font-normal text-gray-500">{unidadeExibida}</span></p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          <button
            onClick={copiarLista}
            className="w-full py-3 rounded-xl border-2 border-dashed border-gray-300 text-gray-600 text-sm font-medium hover:border-amber-400 hover:text-amber-600 transition-colors"
          >
            Copiar lista de pedidos
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Histórico Tab ────────────────────────────────────────────────────────────

function HistoricoTab({ restaurante }: { restaurante: string }) {
  const [todos, setTodos] = useState<HistoricoProduto[]>([]);
  const [selected, setSelected] = useState<HistoricoProduto | null>(null);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/compras/historico?restaurante=${encodeURIComponent(restaurante)}`)
      .then((r) => r.json())
      .then((d) => setTodos(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, [restaurante]);

  const alertas = todos.filter((p) => p.alerta);
  const filtrados = todos.filter((p) => p.nome.toLowerCase().includes(busca.toLowerCase()));

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 mb-4">
        <input
          type="search"
          placeholder="Buscar produto..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      </div>

      {alertas.length > 0 && !busca && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={15} className="text-amber-600" />
            <p className="text-sm font-semibold text-amber-700">{alertas.length} produto(s) com meta desajustada (&gt;20%)</p>
          </div>
          <div className="space-y-0.5">
            {alertas.slice(0, 3).map((p) => (
              <button key={p.id} onClick={() => setSelected(p)} className="text-xs text-amber-600 underline block">
                {p.nome} — meta: {p.metaSemanal}, média: {p.medias.semanal.toFixed(1)}/semana
              </button>
            ))}
          </div>
        </div>
      )}

      {selected && (
        <div className="mb-4 bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="font-bold text-gray-900">{selected.nome}</p>
              <p className="text-xs text-gray-400">{selected.categoria} · {selected.unidade}</p>
            </div>
            <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { l: "Média/dia", v: selected.medias.diaria },
              { l: "Média/semana", v: selected.medias.semanal },
              { l: "Média/mês", v: selected.medias.mensal },
            ].map(({ l, v }) => (
              <div key={l} className="bg-gray-50 rounded-lg p-2 text-center">
                <p className="text-xs text-gray-400">{l}</p>
                <p className="text-sm font-bold text-gray-900">{v.toFixed(1)} {selected.unidade}</p>
              </div>
            ))}
          </div>
          {selected.historicos.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-gray-400">
                    <th className="text-left py-2">Semana</th>
                    <th className="text-right py-2">Inicial</th>
                    <th className="text-right py-2">Compras</th>
                    <th className="text-right py-2">Fim</th>
                    <th className="text-right py-2 font-bold text-gray-700">Uso</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.historicos.map((h, i) => (
                    <tr key={h.semanaRef} className={i % 2 === 0 ? "" : "bg-gray-50"}>
                      <td className="py-1.5 font-medium text-gray-700">{h.semanaRef}</td>
                      <td className="text-right py-1.5 text-gray-500">{h.estoqueInicial}</td>
                      <td className="text-right py-1.5 text-gray-500">{h.comprasDia}</td>
                      <td className="text-right py-1.5 text-gray-500">{h.contagemFim}</td>
                      <td className="text-right py-1.5 font-bold text-amber-700">{h.usoReal.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-32 text-gray-400"><Loader2 size={20} className="animate-spin mr-2" /> Carregando...</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          {filtrados.length === 0 ? (
            <p className="p-8 text-center text-gray-400 text-sm">Nenhum produto com histórico.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {filtrados.map((p) => {
                const diff = p.medias.semanal > 0 && p.metaSemanal > 0
                  ? (p.medias.semanal - p.metaSemanal) / p.metaSemanal : 0;
                const Icon = diff > 0.1 ? TrendingUp : diff < -0.1 ? TrendingDown : Minus;
                const color = diff > 0.1 ? "text-red-500" : diff < -0.1 ? "text-blue-500" : "text-gray-400";
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelected((prev) => prev?.id === p.id ? null : p)}
                    className={`w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left ${selected?.id === p.id ? "bg-amber-50" : ""}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900 truncate">{p.nome}</p>
                        {p.alerta && <AlertTriangle size={13} className="text-amber-500 flex-shrink-0" />}
                      </div>
                      <p className="text-xs text-gray-400">{p.categoria}</p>
                    </div>
                    <div className="flex items-center gap-3 ml-3">
                      <div className="text-right">
                        <p className="text-xs text-gray-400">Média/sem</p>
                        <p className="text-sm font-semibold text-gray-900">{p.medias.semanal.toFixed(1)} {p.unidade}</p>
                      </div>
                      <Icon size={16} className={color} />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Produtos Tab ─────────────────────────────────────────────────────────────

function ProdutosTab({ produtos, onRefresh }: { produtos: Produto[]; onRefresh: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyProduto());
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busca, setBusca] = useState("");

  const f = (k: string, v: unknown) => setForm((prev) => ({ ...prev, [k]: v }));

  const save = async () => {
    if (!form.nome) return alert("Nome é obrigatório.");
    setSaving(true);
    const body = {
      ...form,
      ilimitado: form.ilimitado,
      sacaThresholdCheia: form.sacaThresholdCheia === "" ? null : Number(form.sacaThresholdCheia),
      sacaThresholdMeia: form.sacaThresholdMeia === "" ? null : Number(form.sacaThresholdMeia),
    };
    if (editId) {
      await fetch(`/api/compras/estoque/${editId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } else {
      await fetch("/api/compras/estoque", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    }
    setSaving(false);
    setShowForm(false);
    setEditId(null);
    setForm(emptyProduto());
    onRefresh();
  };

  const startEdit = (p: Produto) => {
    setForm({
      nome: p.nome, categoria: p.categoria, unidade: p.unidade,
      quantidadeAtual: p.quantidadeAtual, quantidadeMinima: p.quantidadeMinima,
      metaSemanal: p.metaSemanal, qtdPorPacote: p.qtdPorPacote,
      ilimitado: Boolean(p.ilimitado),
      sacaThresholdCheia: p.sacaThresholdCheia != null ? String(p.sacaThresholdCheia) : "",
      sacaThresholdMeia: p.sacaThresholdMeia != null ? String(p.sacaThresholdMeia) : "",
      restaurante: p.restaurante ?? "", ordemCategoria: p.ordemCategoria,
      setor: p.setor ?? "Geral",
    });
    setEditId(p.id);
    setShowForm(true);
  };

  const remove = async (id: string) => {
    if (!confirm("Arquivar este produto?")) return;
    await fetch(`/api/compras/estoque/${id}`, { method: "DELETE" });
    onRefresh();
  };

  const filtrados = produtos.filter((p) => p.nome.toLowerCase().includes(busca.toLowerCase()));

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <input
          type="search"
          placeholder="Buscar produto..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="flex-1 min-w-[180px] border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
        <button
          onClick={() => { setForm(emptyProduto()); setEditId(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 transition-colors"
        >
          <Plus size={15} /> Novo Produto
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
              <th className="text-left px-4 py-3">Produto</th>
              <th className="text-left px-3 py-3">Categoria</th>
              <th className="text-center px-3 py-3">Meta/sem</th>
              <th className="text-center px-3 py-3">Qtd/pacote</th>
              <th className="text-center px-3 py-3">Unidade</th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtrados.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">Nenhum produto cadastrado.</td></tr>
            ) : filtrados.map((p) => (
              <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{p.nome}</p>
                  {p.restaurante && (
                    <p className="text-xs text-gray-400">
                      {p.restaurante}{p.setor && p.setor !== "Geral" && ` · ${p.setor}`}
                    </p>
                  )}
                  {Boolean(p.ilimitado) && <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">ilimitado</span>}
                </td>
                <td className="px-3 py-3 text-gray-600">{p.categoria}</td>
                <td className="px-3 py-3 text-center text-gray-700 font-mono">{p.metaSemanal}</td>
                <td className="px-3 py-3 text-center text-gray-600 font-mono">{p.qtdPorPacote}</td>
                <td className="px-3 py-3 text-center text-gray-500">{p.unidade}</td>
                <td className="px-3 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => startEdit(p)} className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 transition-colors"><Pencil size={14} /></button>
                    <button onClick={() => remove(p.id)} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 transition-colors"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">{editId ? "Editar" : "Novo"} Produto</h2>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nome *</label>
                <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  value={form.nome} onChange={(e) => f("nome", e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Categoria</label>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    value={form.categoria} onChange={(e) => f("categoria", e.target.value)} placeholder="Ex: CARNES, LATICÍNIOS..." />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Unidade</label>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    value={form.unidade} onChange={(e) => f("unidade", e.target.value)} placeholder="kg, L, un, cx..." />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Meta semanal</label>
                  <input type="number" min={0} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    value={form.metaSemanal} onChange={(e) => f("metaSemanal", Number(e.target.value))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Qtd por pacote</label>
                  <input type="number" min={0.1} step="any" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    value={form.qtdPorPacote} onChange={(e) => f("qtdPorPacote", Number(e.target.value))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Ordem na categoria</label>
                  <input type="number" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    value={form.ordemCategoria} onChange={(e) => f("ordemCategoria", Number(e.target.value))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Restaurante (opcional)</label>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    value={form.restaurante} onChange={(e) => f("restaurante", e.target.value)} placeholder="Ex: YKEDIN, DECK..." />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Setor</label>
                  <select
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
                    value={form.setor}
                    onChange={(e) => f("setor", e.target.value)}
                  >
                    <option value="Geral">Geral</option>
                    <option value="Cozinha">Cozinha</option>
                    <option value="Atendimento">Atendimento</option>
                    <option value="Sushibar">Sushibar</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Threshold saca (cheia)</label>
                  <input type="number" step="any" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    value={form.sacaThresholdCheia} onChange={(e) => f("sacaThresholdCheia", e.target.value)} placeholder="Deixe vazio se não aplicável" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Threshold saca (meia)</label>
                  <input type="number" step="any" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    value={form.sacaThresholdMeia} onChange={(e) => f("sacaThresholdMeia", e.target.value)} placeholder="Deixe vazio se não aplicável" />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={Boolean(form.ilimitado)} onChange={(e) => f("ilimitado", e.target.checked)}
                  className="w-4 h-4 rounded accent-amber-500" />
                <span className="text-sm text-gray-700">Produto ilimitado (não precisa pedir)</span>
              </label>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
              <button onClick={() => { setShowForm(false); setEditId(null); }} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors">
                Cancelar
              </button>
              <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors">
                {saving ? <><Loader2 size={14} className="animate-spin" /> Salvando...</> : <><Check size={14} /> {editId ? "Salvar" : "Criar"}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
