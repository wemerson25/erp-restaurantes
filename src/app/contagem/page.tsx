"use client";
import { useEffect, useState, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, CheckCircle2, Package, ChevronDown, ChevronUp, User } from "lucide-react";
import { getSemanaRef, formatarSemana, calcularPedido } from "@/lib/calculos-estoque";
import Image from "next/image";

type Produto = {
  id: string; nome: string; categoria: string; unidade: string;
  metaSemanal: number; qtdPorPacote: number; ilimitado: number;
  sacaThresholdCheia: number | null; sacaThresholdMeia: number | null;
  restaurante: string | null; setor: string;
};

type ContagemEntry = { qtdContada: number; qtdDeposito: number; saving?: boolean; saved?: boolean };
type ContagemMap = Record<string, ContagemEntry>;

function ContagemPublica() {
  const params = useSearchParams();
  const restaurante = params.get("restaurante") ?? "";
  const setor       = params.get("setor")       ?? "";
  const semana      = params.get("semana")      ?? getSemanaRef();

  const [nameChecked, setNameChecked]   = useState(false);
  const [responsavel, setResponsavel]   = useState("");
  const [nomeInput, setNomeInput]       = useState("");

  const [produtos, setProdutos]         = useState<Produto[]>([]);
  const [contagens, setContagens]       = useState<ContagemMap>({});
  const [loading, setLoading]           = useState(false);
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());
  const debounce = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const contagensRef = useRef<ContagemMap>({});

  // Keep ref in sync so debounce timers read fresh values
  useEffect(() => { contagensRef.current = contagens; }, [contagens]);

  // Check localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("contagem_responsavel");
    if (saved) setResponsavel(saved);
    setNameChecked(true);
  }, []);

  const load = useCallback(async () => {
    if (!responsavel) return;
    setLoading(true);
    const [prodRes, contRes] = await Promise.all([
      fetch("/api/compras/estoque").then((r) => r.json()),
      fetch(`/api/compras/contagem?semana=${semana}&restaurante=${encodeURIComponent(restaurante)}`).then((r) => r.json()),
    ]);

    let prods: Produto[] = Array.isArray(prodRes) ? prodRes : [];
    if (restaurante) prods = prods.filter((p) => p.restaurante === restaurante);
    if (setor) prods = prods.filter((p) => p.setor === setor);

    const map: ContagemMap = {};
    if (Array.isArray(contRes)) {
      contRes.forEach((c: { produtoId: string; qtdContada: number; qtdDeposito: number }) => {
        map[c.produtoId] = { qtdContada: c.qtdContada, qtdDeposito: c.qtdDeposito };
      });
    }

    setProdutos(prods);
    setContagens(map);
    setLoading(false);
  }, [responsavel, restaurante, setor, semana]);

  useEffect(() => { load(); }, [load]);

  const confirmarNome = () => {
    const nome = nomeInput.trim();
    if (!nome) return;
    localStorage.setItem("contagem_responsavel", nome);
    setResponsavel(nome);
  };

  const handleChange = (produtoId: string, field: "qtdContada" | "qtdDeposito", val: number) => {
    setContagens((prev) => ({
      ...prev,
      [produtoId]: { ...prev[produtoId] ?? { qtdContada: 0, qtdDeposito: 0 }, [field]: val, saved: false, saving: false },
    }));

    clearTimeout(debounce.current[produtoId]);
    debounce.current[produtoId] = setTimeout(async () => {
      setContagens((prev) => ({ ...prev, [produtoId]: { ...prev[produtoId], saving: true } }));

      const cur = contagensRef.current[produtoId] ?? { qtdContada: 0, qtdDeposito: 0 };
      await fetch("/api/compras/contagem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          produtoId, semanaRef: semana, restaurante,
          qtdContada: cur.qtdContada, qtdDeposito: cur.qtdDeposito,
          responsavel,
        }),
      });

      setContagens((prev) => ({ ...prev, [produtoId]: { ...prev[produtoId], saving: false, saved: true } }));
      setTimeout(() => setContagens((prev) => ({ ...prev, [produtoId]: { ...prev[produtoId], saved: false } })), 2000);
    }, 700);
  };

  const toggleCat = (cat: string) => {
    setCollapsedCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  const categorias = [...new Set(produtos.map((p) => p.categoria))].sort();
  const totalContados = produtos.filter((p) => p.id in contagens).length;

  // Still loading localStorage
  if (!nameChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 size={28} className="animate-spin text-blue-600" />
      </div>
    );
  }

  // Name entry screen
  if (!responsavel) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div
          className="px-4 py-5 text-white"
          style={{ background: "linear-gradient(135deg, #1e40af 0%, #1e3a8a 60%, #0f172a 100%)" }}
        >
          <div className="max-w-lg mx-auto">
            <Image
              src="/logo-ykedin-transparent.png"
              alt="Grupo Ykedin"
              width={100}
              height={36}
              className="object-contain"
              style={{ filter: "brightness(0) invert(1)" }}
            />
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 w-full max-w-sm p-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <User size={28} className="text-blue-600" />
              </div>
              <h1 className="text-xl font-bold text-gray-900 mb-2">Identificação</h1>
              <p className="text-sm text-gray-500">Quem está fazendo a contagem?</p>
              {(restaurante || setor) && (
                <div className="mt-3 inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 text-xs font-medium px-3 py-1.5 rounded-full">
                  {restaurante && <span>{restaurante}</span>}
                  {restaurante && setor && <span className="text-blue-400">·</span>}
                  {setor && <span>{setor}</span>}
                </div>
              )}
            </div>
            <div className="space-y-4">
              <input
                type="text"
                autoFocus
                placeholder="Seu nome..."
                value={nomeInput}
                onChange={(e) => setNomeInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && confirmarNome()}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-4 text-base focus:outline-none focus:border-blue-500 transition-colors"
              />
              <button
                onClick={confirmarNome}
                disabled={!nomeInput.trim()}
                className="w-full py-4 rounded-xl bg-blue-600 text-white font-bold text-base disabled:opacity-40 hover:bg-blue-700 active:bg-blue-800 transition-colors"
              >
                Começar contagem
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Counting screen
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div
        className="px-4 py-5 text-white"
        style={{ background: "linear-gradient(135deg, #1e40af 0%, #1e3a8a 60%, #0f172a 100%)" }}
      >
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-3">
            <Image
              src="/logo-ykedin-transparent.png"
              alt="Grupo Ykedin"
              width={100}
              height={36}
              className="object-contain"
              style={{ filter: "brightness(0) invert(1)" }}
            />
            <button
              onClick={() => { localStorage.removeItem("contagem_responsavel"); setResponsavel(""); setNomeInput(""); }}
              className="text-blue-300 text-xs hover:text-white transition-colors underline"
            >
              Trocar usuário
            </button>
          </div>
          <h1 className="text-xl font-bold">Contagem de Estoque</h1>
          {(restaurante || setor) && (
            <p className="text-blue-200 text-sm font-medium mt-0.5">
              {restaurante}{restaurante && setor && " · "}{setor}
            </p>
          )}
          <div className="flex items-center justify-between mt-1">
            <p className="text-blue-300 text-xs">{formatarSemana(semana)}</p>
            <p className="text-blue-300 text-xs font-medium">{responsavel}</p>
          </div>
        </div>
      </div>

      {/* Sticky progress bar */}
      {!loading && produtos.length > 0 && (
        <div className="bg-white border-b border-gray-100 px-4 py-3 sticky top-0 z-10 shadow-sm">
          <div className="max-w-lg mx-auto flex items-center justify-between text-xs text-gray-500 mb-1.5">
            <span>{totalContados} de {produtos.length} contados</span>
            <span className="font-semibold text-gray-700">{Math.round((totalContados / produtos.length) * 100)}%</span>
          </div>
          <div className="max-w-lg mx-auto bg-gray-100 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${(totalContados / produtos.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 py-5 space-y-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-3">
            <Loader2 size={28} className="animate-spin text-blue-600" />
            <p className="text-sm">Carregando produtos...</p>
          </div>
        ) : produtos.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
            <Package size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">Nenhum produto encontrado</p>
            <p className="text-gray-400 text-sm mt-1">Verifique o link ou contate o administrador.</p>
          </div>
        ) : (
          <>
            {categorias.map((cat) => {
              const isCollapsed = collapsedCats.has(cat);
              const catProds = produtos.filter((p) => p.categoria === cat);
              const catContados = catProds.filter((p) => p.id in contagens).length;
              const catDone = catContados === catProds.length;

              return (
                <div key={cat} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                  <button
                    onClick={() => toggleCat(cat)}
                    className={`w-full px-4 py-3.5 flex items-center justify-between transition-colors ${
                      catDone ? "bg-green-50 border-b border-green-100" : "bg-blue-50 border-b border-blue-100"
                    }`}
                  >
                    <p className={`text-xs font-bold uppercase tracking-wider ${catDone ? "text-green-700" : "text-blue-700"}`}>
                      {cat}
                    </p>
                    <div className="flex items-center gap-2">
                      {catDone && <CheckCircle2 size={14} className="text-green-600" />}
                      <span className={`text-xs font-medium ${catDone ? "text-green-600" : "text-blue-500"}`}>
                        {catContados}/{catProds.length}
                      </span>
                      {isCollapsed
                        ? <ChevronDown size={15} className="text-gray-400" />
                        : <ChevronUp size={15} className="text-gray-400" />
                      }
                    </div>
                  </button>

                  {!isCollapsed && (
                    <div className="divide-y divide-gray-50">
                      {catProds.map((p) => {
                        const c = contagens[p.id] ?? { qtdContada: 0, qtdDeposito: 0 };
                        const { qtd } = calcularPedido(p, c.qtdContada, c.qtdDeposito, p.unidade);
                        const contado = p.id in contagens;
                        return (
                          <div key={p.id} className="px-4 py-4">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2 min-w-0">
                                <p className="font-semibold text-gray-900 truncate">{p.nome}</p>
                                {c.saving && <Loader2 size={13} className="animate-spin text-blue-400 flex-shrink-0" />}
                                {c.saved && <CheckCircle2 size={13} className="text-green-500 flex-shrink-0" />}
                              </div>
                              {!p.ilimitado && contado && (
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ml-2 ${
                                  qtd === 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                                }`}>
                                  {qtd === 0 ? "OK ✓" : `pedir ${qtd} ${p.unidade}`}
                                </span>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                                  Contagem <span className="text-gray-400">({p.unidade})</span>
                                </label>
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  min={0}
                                  step="any"
                                  className="w-full border-2 border-gray-200 rounded-xl px-3 py-3.5 text-xl font-bold text-center text-gray-900 focus:outline-none focus:border-blue-500 transition-colors"
                                  value={c.qtdContada || ""}
                                  onChange={(e) => handleChange(p.id, "qtdContada", Number(e.target.value) || 0)}
                                  placeholder="0"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1.5">
                                  Depósito <span className="text-gray-400">({p.unidade})</span>
                                </label>
                                <input
                                  type="number"
                                  inputMode="decimal"
                                  min={0}
                                  step="any"
                                  className="w-full border-2 border-gray-200 rounded-xl px-3 py-3.5 text-xl font-bold text-center text-gray-900 focus:outline-none focus:border-blue-400 transition-colors"
                                  value={c.qtdDeposito || ""}
                                  onChange={(e) => handleChange(p.id, "qtdDeposito", Number(e.target.value) || 0)}
                                  placeholder="0"
                                />
                              </div>
                            </div>
                            {p.metaSemanal > 0 && (
                              <p className="text-xs text-gray-400 mt-2 text-right">
                                meta: {p.metaSemanal} {p.unidade}/semana
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {totalContados === produtos.length && totalContados > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-4 flex items-center gap-3">
                <CheckCircle2 size={24} className="text-green-600 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-green-800">Contagem completa!</p>
                  <p className="text-sm text-green-600">Todos os {produtos.length} produtos foram contados.</p>
                </div>
              </div>
            )}

            <p className="text-center text-xs text-gray-400 pb-8">
              Os dados são salvos automaticamente. Pode fechar a página a qualquer momento.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function ContagemPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 size={28} className="animate-spin text-blue-600" />
      </div>
    }>
      <ContagemPublica />
    </Suspense>
  );
}
