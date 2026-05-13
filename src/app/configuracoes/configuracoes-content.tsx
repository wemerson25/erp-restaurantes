"use client";
import { useEffect, useState, useCallback } from "react";
import { Plus, Loader2, Trash2, Edit2, Phone, User, Check, X } from "lucide-react";

interface Gestor {
  id: string;
  nome: string;
  telefone: string;
  ativo: boolean;
}

function fmtPhone(t: string) {
  const d = t.replace(/\D/g, "");
  if (d.length === 13) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  return t;
}

export function ConfiguracoesContent() {
  const [gestores, setGestores] = useState<Gestor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Gestor | null>(null);
  const [form, setForm] = useState({ nome: "", telefone: "" });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState("");

  const fetchGestores = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/gestores");
    if (res.ok) setGestores(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchGestores(); }, [fetchGestores]);

  function openAdd() {
    setEditTarget(null);
    setForm({ nome: "", telefone: "" });
    setError("");
    setShowForm(true);
  }

  function openEdit(g: Gestor) {
    setEditTarget(g);
    setForm({ nome: g.nome, telefone: g.telefone });
    setError("");
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditTarget(null);
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim() || !form.telefone.trim()) { setError("Preencha nome e telefone"); return; }
    setSaving(true);
    setError("");
    try {
      const url = editTarget ? `/api/gestores/${editTarget.id}` : "/api/gestores";
      const method = editTarget ? "PUT" : "POST";
      const res = await fetch(url, {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        setError(d.error ?? "Erro ao salvar");
      } else {
        setShowForm(false);
        setEditTarget(null);
        await fetchGestores();
      }
    } catch {
      setError("Erro de conexão");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, nome: string) {
    if (!confirm(`Remover ${nome}?`)) return;
    setDeleting(id);
    await fetch(`/api/gestores/${id}`, { method: "DELETE" });
    setDeleting(null);
    await fetchGestores();
  }

  async function toggleAtivo(g: Gestor) {
    await fetch(`/api/gestores/${g.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ativo: !g.ativo }),
    });
    await fetchGestores();
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Gestores card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-900">Gestores & Responsáveis</h2>
            <p className="text-xs text-gray-400 mt-0.5">Números para envio de alertas via WhatsApp</p>
          </div>
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
          >
            <Plus size={14} /> Adicionar
          </button>
        </div>

        {/* Inline form */}
        {showForm && (
          <form onSubmit={handleSubmit} className="px-5 py-4 border-b border-gray-100 bg-gray-50">
            <p className="text-xs font-semibold text-gray-700 mb-3">
              {editTarget ? `Editar — ${editTarget.nome}` : "Novo gestor"}
            </p>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[11px] text-gray-500 mb-1 block">Nome</label>
                <input
                  type="text"
                  placeholder="Ex: Quecia"
                  value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-400"
                />
              </div>
              <div className="flex-1">
                <label className="text-[11px] text-gray-500 mb-1 block">Telefone (somente números)</label>
                <input
                  type="text"
                  placeholder="Ex: 74988585163"
                  value={form.telefone}
                  onChange={e => setForm(f => ({ ...f, telefone: e.target.value.replace(/\D/g, "") }))}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-400"
                />
              </div>
            </div>
            {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
            <div className="flex gap-2 mt-3">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                {editTarget ? "Salvar" : "Adicionar"}
              </button>
              <button
                type="button"
                onClick={cancelForm}
                className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
              >
                <X size={13} /> Cancelar
              </button>
            </div>
          </form>
        )}

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-gray-400 text-sm">
            <Loader2 size={16} className="animate-spin" /> Carregando...
          </div>
        ) : gestores.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-gray-400">
            <User size={32} className="opacity-20" />
            <p className="text-sm font-medium">Nenhum gestor cadastrado</p>
            <p className="text-xs text-gray-300">Adicione gestores para enviar alertas via WhatsApp</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-50">
            {gestores.map(g => (
              <li key={g.id} className={`flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-gray-50 ${!g.ativo ? "opacity-50" : ""}`}>
                <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                  <User size={16} className="text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{g.nome}</p>
                  <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                    <Phone size={11} /> {fmtPhone(g.telefone)}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => toggleAtivo(g)}
                    title={g.ativo ? "Desativar" : "Ativar"}
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full transition-colors ${g.ativo ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
                  >
                    {g.ativo ? "Ativo" : "Inativo"}
                  </button>
                  <button
                    onClick={() => openEdit(g)}
                    className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(g.id, g.nome)}
                    disabled={deleting === g.id}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    {deleting === g.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-gray-400 text-center">
        Os gestores ativos aparecem como opção de destinatário no envio de alertas e escalas via WhatsApp.
      </p>
    </div>
  );
}
