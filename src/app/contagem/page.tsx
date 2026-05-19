"use client";
import { useEffect, useState, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, CheckCircle2, Package } from "lucide-react";
import { getSemanaRef, formatarSemana, calcularPedido } from "@/lib/calculos-estoque";
import Image from "next/image";

type Produto = {
  id: string; nome: string; categoria: string; unidade: string;
  metaSemanal: number; qtdPorPacote: number; ilimitado: number;
  sacaThresholdCheia: number | null; sacaThresholdMeia: number | null;
  restaurante: string | null;
};

type ContagemMap = Record<string, { qtdContada: number; qtdDeposito: number; saving?: boolean; saved?: boolean }>;

function ContagemPublica() {
  const params = useSearchParams();
  const restaurante = params.get("restaurante") ?? "";
  const semana      = params.get("semana")      ?? getSemanaRef();

  const [produtos, setProdutos]   = useState<Produto[]>([]);
  const [contagens, setContagens] = useState<ContagemMap>({});
  const [loading, setLoading]     = useState(true);
  const debounce = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const [prodRes, contRes] = await Promise.all([
      fetch("/api/compras/estoque").then((r) => r.json()),
      fetch(`/api/compras/contagem?semana=${semana}&restaurante=${encodeURIComponent(restaurante)}`).then((r) => r.json()),
    ]);

    const prods: Produto[] = Array.isArray(prodRes)
      ? prodRes.filter((p: Produto) => !restaurante || !p.restaurante || p.restaurante === restaurante)
      : [];

    const map: ContagemMap = {};
    if (Array.isArray(contRes)) {
      contRes.forEach((c: { produtoId: string; qtdContada: number; qtdDeposito: number }) => {
        map[c.produtoId] = { qtdContada: c.qtdContada, qtdDeposito: c.qtdDeposito };
      });
    }

    setProdutos(prods);
    setContagens(map);
    setLoading(false);
  }, [restaurante, semana]);

  useEffect(() => { load(); }, [load]);

  const handleChange = (produtoId: string, field: "qtdContada" | "qtdDeposito", val: number) => {
    setContagens((prev) => ({
      ...prev,
      [produtoId]: { ...prev[produtoId] ?? { qtdContada: 0, qtdDeposito: 0 }, [field]: val, saved: false, saving: false },
    }));

    clearTimeout(debounce.current[produtoId]);
    debounce.current[produtoId] = setTimeout(async () => {
      setContagens((prev) => ({ ...prev, [produtoId]: { ...prev[produtoId], saving: true } }));

      const base = contagens[produtoId] ?? { qtdContada: 0, qtdDeposito: 0 };
      const cur = { ...base, [field]: val };
      await fetch("/api/compras/contagem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ produtoId, semanaRef: semana, restaurante, qtdContada: cur.qtdContada, qtdDeposito: cur.qtdDeposito }),
      });

      setContagens((prev) => ({ ...prev, [produtoId]: { ...prev[produtoId], saving: false, saved: true } }));
      setTimeout(() => setContagens((prev) => ({ ...prev, [produtoId]: { ...prev[produtoId], saved: false } })), 2000);
    }, 700);
  };

  const categorias = [...new Set(produtos.map((p) => p.categoria))].sort();
  const totalContados = Object.keys(contagens).length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div
        className="px-4 py-5 text-white"
        style={{ background: "linear-gradient(135deg, #1e40af 0%, #1e3a8a 60%, #0f172a 100%)" }}
      >
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <Image
              src="/logo-ykedin-transparent.png"
              alt="Grupo Ykedin"
              width={100}
              height={36}
              className="object-contain"
              style={{ filter: "brightness(0) invert(1)" }}
            />
          </div>
          <h1 className="text-xl font-bold">Contagem de Estoque</h1>
          {restaurante && <p className="text-blue-200 text-sm font-medium mt-0.5">{restaurante}</p>}
          <p className="text-blue-300 text-xs mt-1">{formatarSemana(semana)}</p>
        </div>
      </div>

      {/* Progress bar */}
      {!loading && produtos.length > 0 && (
        <div className="bg-white border-b border-gray-100 px-4 py-3">
          <div className="max-w-lg mx-auto flex items-center justify-between text-xs text-gray-500 mb-1.5">
            <span>{totalContados} de {produtos.length} contados</span>
            <span>{Math.round((totalContados / produtos.length) * 100)}%</span>
          </div>
          <div className="max-w-lg mx-auto bg-gray-100 rounded-full h-1.5">
            <div
              className="bg-blue-600 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${(totalContados / produtos.length) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">
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
            {categorias.map((cat) => (
              <div key={cat} className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                <div className="px-4 py-2.5 bg-blue-50 border-b border-blue-100">
                  <p className="text-xs font-bold text-blue-700 uppercase tracking-wider">{cat}</p>
                </div>
                <div className="divide-y divide-gray-50">
                  {produtos
                    .filter((p) => p.categoria === cat)
                    .map((p) => {
                      const c = contagens[p.id] ?? { qtdContada: 0, qtdDeposito: 0 };
                      const { qtd } = calcularPedido(p, c.qtdContada, c.qtdDeposito, p.unidade);
                      const contado = p.id in contagens;
                      return (
                        <div key={p.id} className="px-4 py-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-gray-900">{p.nome}</p>
                              {c.saving && <Loader2 size={13} className="animate-spin text-blue-400" />}
                              {c.saved && <CheckCircle2 size={13} className="text-green-500" />}
                            </div>
                            {!p.ilimitado && contado && (
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
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
                                className="w-full border-2 border-gray-200 rounded-xl px-3 py-3 text-lg font-bold text-center text-gray-900 focus:outline-none focus:border-blue-500 transition-colors"
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
                                className="w-full border-2 border-gray-200 rounded-xl px-3 py-3 text-lg font-bold text-center text-gray-900 focus:outline-none focus:border-blue-400 transition-colors"
                                value={c.qtdDeposito || ""}
                                onChange={(e) => handleChange(p.id, "qtdDeposito", Number(e.target.value) || 0)}
                                placeholder="0"
                              />
                            </div>
                          </div>
                          {p.metaSemanal > 0 && (
                            <p className="text-xs text-gray-400 mt-1.5 text-right">meta: {p.metaSemanal} {p.unidade}/semana</p>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}

            {totalContados === produtos.length && (
              <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-4 flex items-center gap-3">
                <CheckCircle2 size={24} className="text-green-600 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-green-800">Contagem completa!</p>
                  <p className="text-sm text-green-600">Todos os {produtos.length} produtos foram contados.</p>
                </div>
              </div>
            )}

            <p className="text-center text-xs text-gray-400 pb-6">
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
