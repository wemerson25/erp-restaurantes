"use client";
import { useEffect, useState } from "react";
import { Plus, ShoppingCart, Clock, CheckCircle2, XCircle, Loader2, ChevronDown, Trash2 } from "lucide-react";

type Item = { id?: string; nome: string; quantidade: number; unidade: string; precoEstimado?: number };
type Requisicao = {
  id: string; titulo: string; descricao: string; categoria: string; urgencia: string;
  status: string; solicitante: string; restaurante: string; observacoes: string;
  itens: Item[]; createdAt: string;
};

const CATEGORIAS = ["ALIMENTOS", "BEBIDAS", "MATERIAL_LIMPEZA", "UTENSÍLIOS", "EMBALAGENS", "EQUIPAMENTOS", "OUTROS"];
const URGENCIAS  = ["BAIXA", "MEDIA", "ALTA", "URGENTE"];
const STATUSES   = ["PENDENTE", "APROVADA", "EM_COMPRA", "CONCLUIDA", "RECUSADA"];

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  PENDENTE:  { label: "Pendente",  cls: "bg-amber-100 text-amber-700" },
  APROVADA:  { label: "Aprovada",  cls: "bg-green-100 text-green-700" },
  EM_COMPRA: { label: "Em compra", cls: "bg-blue-100 text-blue-700" },
  CONCLUIDA: { label: "Concluída", cls: "bg-gray-100 text-gray-600" },
  RECUSADA:  { label: "Recusada",  cls: "bg-red-100 text-red-700" },
};

const URGENCIA_COLOR: Record<string, string> = {
  URGENTE: "bg-red-100 text-red-700",
  ALTA:    "bg-orange-100 text-orange-700",
  MEDIA:   "bg-yellow-100 text-yellow-700",
  BAIXA:   "bg-green-100 text-green-700",
};

const empty = (): Omit<Requisicao, "id" | "createdAt"> & { itens: Item[] } => ({
  titulo: "", descricao: "", categoria: "OUTROS", urgencia: "MEDIA",
  status: "PENDENTE", solicitante: "", restaurante: "", observacoes: "",
  itens: [{ nome: "", quantidade: 1, unidade: "un" }],
});

export default function RequisicoesPage() {
  const [data, setData]           = useState<Requisicao[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState(empty());
  const [saving, setSaving]       = useState(false);
  const [expandedId, setExpanded] = useState<string | null>(null);
  const [filterStatus, setFilter] = useState("TODOS");

  const load = () => {
    setLoading(true);
    fetch("/api/compras/requisicoes")
      .then((r) => r.json())
      .then((d) => setData(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const save = async () => {
    if (!form.titulo || !form.solicitante) return alert("Título e solicitante são obrigatórios.");
    setSaving(true);
    const itensValidos = form.itens.filter((i) => i.nome.trim());
    await fetch("/api/compras/requisicoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, itens: itensValidos }),
    });
    setSaving(false);
    setShowForm(false);
    setForm(empty());
    load();
  };

  const updateStatus = async (id: string, status: string) => {
    await fetch(`/api/compras/requisicoes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir esta requisição?")) return;
    await fetch(`/api/compras/requisicoes/${id}`, { method: "DELETE" });
    load();
  };

  const addItem = () => setForm((f) => ({ ...f, itens: [...f.itens, { nome: "", quantidade: 1, unidade: "un" }] }));
  const updItem = (i: number, k: keyof Item, v: string | number) =>
    setForm((f) => { const itens = [...f.itens]; itens[i] = { ...itens[i], [k]: v }; return { ...f, itens }; });
  const rmItem  = (i: number) => setForm((f) => ({ ...f, itens: f.itens.filter((_, j) => j !== i) }));

  const filtered = filterStatus === "TODOS" ? data : data.filter((r) => r.status === filterStatus);

  return (
    <main className="flex-1 p-4 sm:p-6 bg-gray-50">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Requisições de Compra</h1>
          <p className="text-gray-500 text-sm mt-0.5">{data.length} requisições no total</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} /> Nova Requisição
        </button>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {["TODOS", ...STATUSES].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              filterStatus === s ? "bg-blue-600 text-white border-blue-600" : "bg-white text-gray-600 border-gray-200 hover:border-blue-300"
            }`}
          >
            {s === "TODOS" ? "Todos" : (STATUS_MAP[s]?.label ?? s)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-gray-400">
          <Loader2 size={24} className="animate-spin mr-2" /> Carregando...
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
          <ShoppingCart size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">Nenhuma requisição encontrada.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const expanded = expandedId === r.id;
            const sm = STATUS_MAP[r.status] ?? { label: r.status, cls: "bg-gray-100 text-gray-600" };
            return (
              <div key={r.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div
                  className="px-5 py-4 flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpanded(expanded ? null : r.id)}
                >
                  <ChevronDown size={16} className={`text-gray-400 flex-shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{r.titulo}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {r.solicitante} · {r.restaurante || "—"} · {new Date(r.createdAt).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${URGENCIA_COLOR[r.urgencia] ?? ""}`}>
                    {r.urgencia}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${sm.cls}`}>
                    {sm.label}
                  </span>
                </div>

                {expanded && (
                  <div className="px-5 pb-5 border-t border-gray-50">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 text-sm">
                      <div><p className="text-xs text-gray-400">Categoria</p><p className="font-medium">{r.categoria}</p></div>
                      <div><p className="text-xs text-gray-400">Restaurante</p><p className="font-medium">{r.restaurante || "—"}</p></div>
                      {r.descricao && <div className="col-span-2 sm:col-span-1"><p className="text-xs text-gray-400">Descrição</p><p className="font-medium">{r.descricao}</p></div>}
                      {r.observacoes && <div className="col-span-2"><p className="text-xs text-gray-400">Obs.</p><p className="font-medium">{r.observacoes}</p></div>}
                    </div>

                    {r.itens.length > 0 && (
                      <div className="mt-4">
                        <p className="text-xs text-gray-400 mb-2">Itens solicitados</p>
                        <div className="space-y-1">
                          {r.itens.map((it, i) => (
                            <div key={i} className="flex gap-3 text-sm bg-gray-50 rounded-lg px-3 py-2">
                              <span className="flex-1 font-medium">{it.nome}</span>
                              <span className="text-gray-500">{it.quantidade} {it.unidade}</span>
                              {it.precoEstimado ? <span className="text-gray-500">R$ {Number(it.precoEstimado).toFixed(2)}</span> : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2 mt-4 flex-wrap">
                      {STATUSES.filter((s) => s !== r.status).map((s) => (
                        <button
                          key={s}
                          onClick={() => updateStatus(r.id, s)}
                          className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${STATUS_MAP[s]?.cls ?? ""} border-current`}
                        >
                          → {STATUS_MAP[s]?.label ?? s}
                        </button>
                      ))}
                      <button
                        onClick={() => remove(r.id)}
                        className="ml-auto text-xs px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 flex items-center gap-1"
                      >
                        <Trash2 size={12} /> Excluir
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Nova Requisição de Compra</h2>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Título *</label>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.titulo} onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))} placeholder="Ex: Compra de óleo de soja" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Solicitante *</label>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.solicitante} onChange={(e) => setForm((f) => ({ ...f, solicitante: e.target.value }))} placeholder="Seu nome" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Restaurante</label>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.restaurante} onChange={(e) => setForm((f) => ({ ...f, restaurante: e.target.value }))} placeholder="Nome da unidade" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Categoria</label>
                  <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.categoria} onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))}>
                    {CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Urgência</label>
                  <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={form.urgencia} onChange={(e) => setForm((f) => ({ ...f, urgencia: e.target.value }))}>
                    {URGENCIAS.map((u) => <option key={u}>{u}</option>)}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Descrição / Justificativa</label>
                  <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    rows={2} value={form.descricao} onChange={(e) => setForm((f) => ({ ...f, descricao: e.target.value }))} />
                </div>
              </div>

              {/* Itens */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-600">Itens</label>
                  <button onClick={addItem} className="text-xs text-blue-600 hover:underline flex items-center gap-1"><Plus size={12} /> Adicionar item</button>
                </div>
                <div className="space-y-2">
                  {form.itens.map((item, i) => (
                    <div key={i} className="flex gap-2 items-start">
                      <input className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Nome do item" value={item.nome} onChange={(e) => updItem(i, "nome", e.target.value)} />
                      <input type="number" className="w-20 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Qtd" value={item.quantidade} onChange={(e) => updItem(i, "quantidade", Number(e.target.value))} />
                      <input className="w-16 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Un" value={item.unidade} onChange={(e) => updItem(i, "unidade", e.target.value)} />
                      <input type="number" className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="R$ est." value={item.precoEstimado ?? ""} onChange={(e) => updItem(i, "precoEstimado", Number(e.target.value))} />
                      {form.itens.length > 1 && (
                        <button onClick={() => rmItem(i)} className="mt-2 text-red-400 hover:text-red-600"><XCircle size={16} /></button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Observações</label>
                <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={2} value={form.observacoes} onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))} />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
              <button onClick={() => { setShowForm(false); setForm(empty()); }} className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors">
                Cancelar
              </button>
              <button onClick={save} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {saving ? <><Loader2 size={14} className="animate-spin" /> Salvando...</> : <><CheckCircle2 size={14} /> Criar Requisição</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
