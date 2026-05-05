"use client";
import { useEffect, useState, useCallback } from "react";
import { Loader2, CalendarDays, Plus, Trash2, CheckCircle2, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface Feriado {
  id: string;
  nome: string;
  data: string;
  tipo: string;
  recorrente: boolean;
}

const TIPO_LABEL: Record<string, string> = {
  NACIONAL: "Nacional",
  ESTADUAL: "Estadual",
  MUNICIPAL: "Municipal",
  EMPRESA: "Empresa",
};

function fmtDateShort(iso: string, recorrente: boolean) {
  const d = new Date(iso);
  if (recorrente) {
    return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export function FeriadosContent() {
  const [feriados, setFeriados] = useState<Feriado[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ nome: "", data: "", tipo: "NACIONAL", recorrente: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchFeriados = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/feriados");
    setFeriados(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchFeriados(); }, [fetchFeriados]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/feriados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Erro ao salvar"); return; }
      setForm({ nome: "", data: "", tipo: "NACIONAL", recorrente: true });
      fetchFeriados();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este feriado?")) return;
    await fetch(`/api/feriados/${id}`, { method: "DELETE" });
    fetchFeriados();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
          <CalendarDays size={20} className="text-red-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Feriados & Datas Importantes</h1>
          <p className="text-sm text-gray-500">Calendário usado para validar folgas e escalas</p>
        </div>
      </div>

      {/* Add form */}
      <Card>
        <form onSubmit={handleAdd} className="p-4 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-40">
            <label className="block text-xs font-medium text-gray-600 mb-1">Nome *</label>
            <Input
              placeholder="Ex: Dia da Independência"
              value={form.nome}
              onChange={(e) => setForm((p) => ({ ...p, nome: e.target.value }))}
              required
            />
          </div>
          <div className="w-36">
            <label className="block text-xs font-medium text-gray-600 mb-1">Data *</label>
            <Input
              type="date"
              value={form.data}
              onChange={(e) => setForm((p) => ({ ...p, data: e.target.value }))}
              required
            />
          </div>
          <div className="w-36">
            <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
            <Select value={form.tipo} onChange={(e) => setForm((p) => ({ ...p, tipo: e.target.value }))}>
              <option value="NACIONAL">Nacional</option>
              <option value="ESTADUAL">Estadual</option>
              <option value="MUNICIPAL">Municipal</option>
              <option value="EMPRESA">Empresa</option>
            </Select>
          </div>
          <div className="flex items-center gap-2 pb-1">
            <input
              type="checkbox"
              id="recorrente"
              checked={form.recorrente}
              onChange={(e) => setForm((p) => ({ ...p, recorrente: e.target.checked }))}
              className="w-4 h-4 accent-red-600"
            />
            <label htmlFor="recorrente" className="text-sm text-gray-600">Recorrente</label>
          </div>
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Adicionar
          </Button>
          {error && (
            <p className="w-full text-sm text-red-600 flex items-center gap-1">
              <AlertCircle size={14} /> {error}
            </p>
          )}
        </form>
      </Card>

      {/* List */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 size={24} className="animate-spin text-red-500" />
          </div>
        ) : feriados.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
            Nenhum feriado cadastrado
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Nome</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Data</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Tipo</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Recorrente</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {feriados.map((f) => (
                <tr key={f.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{f.nome}</td>
                  <td className="px-4 py-3 font-mono text-gray-700">{fmtDateShort(f.data, f.recorrente)}</td>
                  <td className="px-4 py-3">
                    <Badge variant={f.tipo === "NACIONAL" ? "destructive" : f.tipo === "EMPRESA" ? "warning" : "secondary"}>
                      {TIPO_LABEL[f.tipo] ?? f.tipo}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {f.recorrente
                      ? <span className="flex items-center gap-1 text-green-600 text-xs"><CheckCircle2 size={13} /> Todo ano</span>
                      : <span className="text-xs text-gray-400">Apenas {new Date(f.data).getUTCFullYear()}</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(f.id)}
                      className="p-1.5 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
