"use client";
import { useEffect, useState, useCallback } from "react";
import { Loader2, Gift, CalendarDays, Plus, Trash2, CheckCircle2, AlertCircle, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";

interface Uso { id: string; data: string }

interface FolgaAtual {
  id: string;
  anoReferencia: number;
  dataConcessao: string;
  dataValidade: string;
  folgasUsadas: number;
  folgasDisponiveis: number;
  usos: Uso[];
}

interface BeneficioEmployee {
  funcionarioId: string;
  nome: string;
  matricula: string;
  cargo: string;
  restaurante: string;
  dataAdmissao: string;
  anosCompletos: number;
  proximoAniversario: string;
  folgaAtual: FolgaAtual | null;
}

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

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function fmtDateShort(iso: string, recorrente: boolean) {
  const d = new Date(iso);
  if (recorrente) {
    return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function benefitBadge(f: FolgaAtual | null) {
  if (!f) return <Badge variant="secondary">Sem benefício</Badge>;
  const today = new Date();
  if (new Date(f.dataValidade) <= today) return <Badge variant="secondary">Expirado</Badge>;
  if (f.folgasDisponiveis === 2) return <Badge variant="success">2 disponíveis</Badge>;
  if (f.folgasDisponiveis === 1) return <Badge variant="warning">1 disponível</Badge>;
  return <Badge variant="secondary">Esgotado</Badge>;
}

export function BeneficiosContent() {
  const [tab, setTab] = useState<"folgas" | "feriados">("folgas");

  // ── Folgas ──
  const [beneficios, setBeneficios] = useState<BeneficioEmployee[]>([]);
  const [loadingBeneficios, setLoadingBeneficios] = useState(true);
  const [usarModal, setUsarModal] = useState(false);
  const [selected, setSelected] = useState<BeneficioEmployee | null>(null);
  const [folgaDate, setFolgaDate] = useState("");
  const [folgaError, setFolgaError] = useState("");
  const [folgaSaving, setFolgaSaving] = useState(false);

  // ── Feriados ──
  const [feriados, setFeriados] = useState<Feriado[]>([]);
  const [loadingFeriados, setLoadingFeriados] = useState(true);
  const [feriadoForm, setFeriadoForm] = useState({ nome: "", data: "", tipo: "NACIONAL", recorrente: true });
  const [feriadoSaving, setFeriadoSaving] = useState(false);
  const [feriadoError, setFeriadoError] = useState("");

  const fetchBeneficios = useCallback(async () => {
    setLoadingBeneficios(true);
    const res = await fetch("/api/beneficios/folgas-aniversario");
    setBeneficios(await res.json());
    setLoadingBeneficios(false);
  }, []);

  const fetchFeriados = useCallback(async () => {
    setLoadingFeriados(true);
    const res = await fetch("/api/feriados");
    setFeriados(await res.json());
    setLoadingFeriados(false);
  }, []);

  useEffect(() => { fetchBeneficios(); }, [fetchBeneficios]);
  useEffect(() => { fetchFeriados(); }, [fetchFeriados]);

  async function handleUsarFolga() {
    if (!selected?.folgaAtual || !folgaDate) return;
    setFolgaError("");
    setFolgaSaving(true);
    try {
      const res = await fetch("/api/beneficios/folgas-aniversario/usar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folgaAniversarioId: selected.folgaAtual.id, data: folgaDate }),
      });
      const data = await res.json();
      if (!res.ok) { setFolgaError(data.error ?? "Erro ao registrar"); return; }
      setUsarModal(false);
      setFolgaDate("");
      fetchBeneficios();
    } finally {
      setFolgaSaving(false);
    }
  }

  async function handleCancelarUso(usoId: string) {
    if (!confirm("Cancelar o uso dessa folga?")) return;
    await fetch(`/api/beneficios/folgas-aniversario/uso/${usoId}`, { method: "DELETE" });
    fetchBeneficios();
  }

  async function handleAddFeriado(e: React.FormEvent) {
    e.preventDefault();
    setFeriadoError("");
    setFeriadoSaving(true);
    try {
      const res = await fetch("/api/feriados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(feriadoForm),
      });
      const data = await res.json();
      if (!res.ok) { setFeriadoError(data.error ?? "Erro ao salvar"); return; }
      setFeriadoForm({ nome: "", data: "", tipo: "NACIONAL", recorrente: true });
      fetchFeriados();
    } finally {
      setFeriadoSaving(false);
    }
  }

  async function handleDeleteFeriado(id: string) {
    if (!confirm("Excluir este feriado?")) return;
    await fetch(`/api/feriados/${id}`, { method: "DELETE" });
    fetchFeriados();
  }

  const canUse = (b: BeneficioEmployee) => {
    const f = b.folgaAtual;
    if (!f) return false;
    if (new Date(f.dataValidade) <= new Date()) return false;
    return f.folgasDisponiveis > 0;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
          <Gift size={20} className="text-purple-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Benefícios</h1>
          <p className="text-sm text-gray-500">Folgas de aniversário e calendário de feriados</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {(["folgas", "feriados"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              tab === t ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "folgas" ? "Folgas de Aniversário" : "Feriados & Datas Importantes"}
          </button>
        ))}
      </div>

      {/* ── TAB: FOLGAS ── */}
      {tab === "folgas" && (
        <Card className="overflow-hidden">
          {loadingBeneficios ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 size={24} className="animate-spin text-purple-500" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Colaborador</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Restaurante</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Anos</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Status</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Validade</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Folgas usadas</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {beneficios.map((b) => (
                    <tr key={b.funcionarioId} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{b.nome}</p>
                        <p className="text-xs text-gray-400">{b.matricula} · {b.cargo}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{b.restaurante}</td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-gray-800">{b.anosCompletos}</span>
                        {b.anosCompletos < 1 && (
                          <p className="text-xs text-gray-400">
                            Próx. {fmtDate(b.proximoAniversario)}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">{benefitBadge(b.folgaAtual)}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {b.folgaAtual ? (
                          <>
                            <span>Até {fmtDate(b.folgaAtual.dataValidade)}</span>
                            <p className="text-gray-400">Ano {b.folgaAtual.anoReferencia}º</p>
                          </>
                        ) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {b.folgaAtual?.usos.length ? (
                          <div className="space-y-1">
                            {b.folgaAtual.usos.map((u) => (
                              <div key={u.id} className="flex items-center gap-1">
                                <span className="text-xs font-mono text-gray-700">{fmtDate(u.data)}</span>
                                <button
                                  onClick={() => handleCancelarUso(u.id)}
                                  className="p-0.5 text-gray-300 hover:text-red-500 transition-colors"
                                  title="Cancelar uso"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">Nenhuma usada</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {canUse(b) && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setSelected(b); setFolgaDate(""); setFolgaError(""); setUsarModal(true); }}
                          >
                            <CalendarDays size={14} /> Registrar
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {beneficios.length === 0 && (
                <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
                  Nenhum colaborador ativo encontrado
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* ── TAB: FERIADOS ── */}
      {tab === "feriados" && (
        <div className="space-y-4">
          {/* Add form */}
          <Card>
            <form onSubmit={handleAddFeriado} className="p-4 flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-40">
                <label className="block text-xs font-medium text-gray-600 mb-1">Nome *</label>
                <Input
                  placeholder="Ex: Dia da Independência"
                  value={feriadoForm.nome}
                  onChange={(e) => setFeriadoForm((p) => ({ ...p, nome: e.target.value }))}
                  required
                />
              </div>
              <div className="w-36">
                <label className="block text-xs font-medium text-gray-600 mb-1">Data *</label>
                <Input
                  type="date"
                  value={feriadoForm.data}
                  onChange={(e) => setFeriadoForm((p) => ({ ...p, data: e.target.value }))}
                  required
                />
              </div>
              <div className="w-36">
                <label className="block text-xs font-medium text-gray-600 mb-1">Tipo</label>
                <Select value={feriadoForm.tipo} onChange={(e) => setFeriadoForm((p) => ({ ...p, tipo: e.target.value }))}>
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
                  checked={feriadoForm.recorrente}
                  onChange={(e) => setFeriadoForm((p) => ({ ...p, recorrente: e.target.checked }))}
                  className="w-4 h-4 accent-red-600"
                />
                <label htmlFor="recorrente" className="text-sm text-gray-600">Recorrente</label>
              </div>
              <Button type="submit" size="sm" disabled={feriadoSaving}>
                {feriadoSaving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Adicionar
              </Button>
              {feriadoError && (
                <p className="w-full text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle size={14} /> {feriadoError}
                </p>
              )}
            </form>
          </Card>

          {/* List */}
          <Card className="overflow-hidden">
            {loadingFeriados ? (
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
                          onClick={() => handleDeleteFeriado(f.id)}
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
      )}

      {/* ── MODAL: REGISTRAR FOLGA ── */}
      <Modal open={usarModal} onClose={() => setUsarModal(false)} title="Registrar Folga de Benefício" size="sm">
        <div className="p-6 space-y-4">
          {selected && (
            <div className="bg-purple-50 rounded-lg px-4 py-3 text-sm">
              <p className="font-semibold text-purple-900">{selected.nome}</p>
              <p className="text-purple-600 text-xs mt-0.5">
                {selected.folgaAtual?.folgasDisponiveis} folga(s) disponível(is) · válido até {selected.folgaAtual ? fmtDate(selected.folgaAtual.dataValidade) : "—"}
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Data da folga *</label>
            <Input
              type="date"
              value={folgaDate}
              onChange={(e) => setFolgaDate(e.target.value)}
            />
            <p className="text-xs text-gray-400 mt-1">Permitido: segunda a quinta, sem feriados ou vésperas.</p>
          </div>

          {folgaError && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
              <AlertCircle size={15} className="mt-0.5 shrink-0" />
              {folgaError}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button variant="outline" onClick={() => setUsarModal(false)}>Cancelar</Button>
            <Button onClick={handleUsarFolga} disabled={folgaSaving || !folgaDate}>
              {folgaSaving && <Loader2 size={14} className="animate-spin" />}
              Registrar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
