"use client";
import { useEffect, useState, useCallback } from "react";
import { Loader2, Gift, CalendarDays, AlertCircle, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

function fmtDate(iso: string) {
  const d = new Date(iso);
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
  const [beneficios, setBeneficios] = useState<BeneficioEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [usarModal, setUsarModal] = useState(false);
  const [selected, setSelected] = useState<BeneficioEmployee | null>(null);
  const [folgaDate, setFolgaDate] = useState("");
  const [folgaError, setFolgaError] = useState("");
  const [folgaSaving, setFolgaSaving] = useState(false);

  const fetchBeneficios = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/beneficios/folgas-aniversario");
    setBeneficios(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchBeneficios(); }, [fetchBeneficios]);

  async function handleUsarFolga() {
    if (!selected?.folgaAtual || !folgaDate) return;
    setFolgaError("");
    setFolgaSaving(true);
    try {
      const res = await fetch("/api/beneficios/folgas-aniversario/usar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ funcionarioId: selected.funcionarioId, anoReferencia: selected.folgaAtual.anoReferencia, data: folgaDate }),
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
          <h1 className="text-2xl font-bold text-gray-900">Folgas de Aniversário</h1>
          <p className="text-sm text-gray-500">2 folgas por ano completo · válidas de segunda a quinta, sem feriados</p>
        </div>
      </div>

      <Card className="overflow-hidden">
        {loading ? (
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

      {/* MODAL: REGISTRAR FOLGA */}
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
