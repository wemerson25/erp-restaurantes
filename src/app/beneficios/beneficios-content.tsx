"use client";
import { useEffect, useState, useCallback } from "react";
import { Loader2, Gift, CalendarDays, AlertCircle, X, Plus, Star, MessageCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";

/* ─── Types ───────────────────────────────────────────────────── */

interface Uso { id: string; data: string }

interface FolgaAtual {
  id: string | null;
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

interface FolgaExtra {
  id: string;
  funcionarioId: string;
  nome: string;
  cargo: string;
  restaurante: string;
  motivo: string;
  dataConcessao: string;
  dataValidade: string | null;
  dataUso: string | null;
  status: string;
  observacoes: string | null;
}

interface FuncionarioSimples { id: string; nome: string; restaurante: { nome: string }; cargo: { nome: string } }

/* ─── Helpers ─────────────────────────────────────────────────── */

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

function extraStatusBadge(status: string) {
  if (status === "DISPONIVEL") return <Badge variant="success">Disponível</Badge>;
  if (status === "UTILIZADA") return <Badge variant="secondary">Utilizada</Badge>;
  return <Badge variant="secondary">{status}</Badge>;
}

/* ─── Main component ──────────────────────────────────────────── */

export function BeneficiosContent() {
  /* Folgas Aniversário */
  const [beneficios, setBeneficios] = useState<BeneficioEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [usarModal, setUsarModal] = useState(false);
  const [selected, setSelected] = useState<BeneficioEmployee | null>(null);
  const [folgaDate1, setFolgaDate1] = useState("");
  const [folgaDate2, setFolgaDate2] = useState("");
  const [folgaError, setFolgaError] = useState("");
  const [folgaSaving, setFolgaSaving] = useState(false);

  /* Folgas Benefício Extra */
  const [extras, setExtras] = useState<FolgaExtra[]>([]);
  const [extrasLoading, setExtrasLoading] = useState(true);
  const [addExtraModal, setAddExtraModal] = useState(false);
  const [usarExtraModal, setUsarExtraModal] = useState(false);
  const [selectedExtra, setSelectedExtra] = useState<FolgaExtra | null>(null);
  const [funcionarios, setFuncionarios] = useState<FuncionarioSimples[]>([]);
  const [extraForm, setExtraForm] = useState({ funcionarioId: "", motivo: "", dataConcessao: "", dataValidade: "", observacoes: "" });
  const [extraUsoDate, setExtraUsoDate] = useState("");
  const [extraError, setExtraError] = useState("");
  const [extraSaving, setExtraSaving] = useState(false);

  /* ── Fetchers ── */
  const fetchBeneficios = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/beneficios/folgas-aniversario");
    setBeneficios(await res.json());
    setLoading(false);
  }, []);

  const fetchExtras = useCallback(async () => {
    setExtrasLoading(true);
    const res = await fetch("/api/beneficios/folgas-extra");
    setExtras(await res.json());
    setExtrasLoading(false);
  }, []);

  const fetchFuncionarios = useCallback(async () => {
    const res = await fetch("/api/funcionarios?status=ATIVO");
    const data = await res.json();
    setFuncionarios(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    fetchBeneficios();
    fetchExtras();
    fetchFuncionarios();
  }, [fetchBeneficios, fetchExtras, fetchFuncionarios]);

  /* ── Folga Aniversário handlers ── */
  async function handleUsarFolga() {
    if (!selected?.folgaAtual || !folgaDate1) return;
    setFolgaError("");
    setFolgaSaving(true);
    try {
      const payload = { funcionarioId: selected.funcionarioId, anoReferencia: selected.folgaAtual.anoReferencia };

      const res1 = await fetch("/api/beneficios/folgas-aniversario/usar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, data: folgaDate1 }),
      });
      const data1 = await res1.json();
      if (!res1.ok) { setFolgaError(data1.error ?? "Erro ao registrar 1ª folga"); return; }

      if (folgaDate2) {
        const res2 = await fetch("/api/beneficios/folgas-aniversario/usar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, data: folgaDate2 }),
        });
        const data2 = await res2.json();
        if (!res2.ok) { setFolgaError(data2.error ?? "Erro ao registrar 2ª folga"); fetchBeneficios(); return; }
      }

      setUsarModal(false);
      setFolgaDate1("");
      setFolgaDate2("");
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

  /* ── WhatsApp send state ── */
  const [whatsappSending, setWhatsappSending] = useState<Record<string, boolean>>({});
  const [whatsappResult, setWhatsappResult] = useState<Record<string, { ok: boolean; msg: string }>>({});

  async function sendBeneficioWhatsApp(key: string, tipo: "ANIVERSARIO" | "EXTRA", payload: object) {
    setWhatsappSending(p => ({ ...p, [key]: true }));
    setWhatsappResult(p => { const n = { ...p }; delete n[key]; return n; });
    try {
      const res = await fetch("/api/alertas/beneficio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, ...payload }),
      });
      const data = await res.json() as { error?: string };
      setWhatsappResult(p => ({ ...p, [key]: res.ok ? { ok: true, msg: "Enviado!" } : { ok: false, msg: data.error ?? "Erro" } }));
    } catch {
      setWhatsappResult(p => ({ ...p, [key]: { ok: false, msg: "Erro de conexão" } }));
    } finally {
      setWhatsappSending(p => ({ ...p, [key]: false }));
    }
  }

  const canUse = (b: BeneficioEmployee) => {
    const f = b.folgaAtual;
    if (!f) return false;
    if (new Date(f.dataValidade) <= new Date()) return false;
    return f.folgasDisponiveis > 0;
  };

  function openModal(b: BeneficioEmployee) {
    setSelected(b);
    setFolgaDate1("");
    setFolgaDate2("");
    setFolgaError("");
    setUsarModal(true);
  }

  /* ── Folga Extra handlers ── */
  function openAddExtra() {
    setExtraForm({ funcionarioId: "", motivo: "", dataConcessao: "", dataValidade: "", observacoes: "" });
    setExtraError("");
    setAddExtraModal(true);
  }

  async function handleAddExtra() {
    if (!extraForm.funcionarioId || !extraForm.motivo || !extraForm.dataConcessao) {
      setExtraError("Colaborador, motivo e data de concessão são obrigatórios");
      return;
    }
    setExtraError("");
    setExtraSaving(true);
    try {
      const res = await fetch("/api/beneficios/folgas-extra", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(extraForm),
      });
      const data = await res.json();
      if (!res.ok) { setExtraError(data.error ?? "Erro ao criar folga"); return; }
      setAddExtraModal(false);
      fetchExtras();
    } finally {
      setExtraSaving(false);
    }
  }

  function openUsarExtra(extra: FolgaExtra) {
    setSelectedExtra(extra);
    setExtraUsoDate("");
    setExtraError("");
    setUsarExtraModal(true);
  }

  async function handleUsarExtra() {
    if (!selectedExtra || !extraUsoDate) return;
    setExtraError("");
    setExtraSaving(true);
    try {
      const res = await fetch(`/api/beneficios/folgas-extra/${selectedExtra.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUso: extraUsoDate }),
      });
      const data = await res.json();
      if (!res.ok) { setExtraError(data.error ?? "Erro ao registrar uso"); return; }
      setUsarExtraModal(false);
      fetchExtras();
    } finally {
      setExtraSaving(false);
    }
  }

  async function handleDeleteExtra(id: string) {
    if (!confirm("Excluir esta folga benefício?")) return;
    await fetch(`/api/beneficios/folgas-extra/${id}`, { method: "DELETE" });
    fetchExtras();
  }

  /* ── Render ── */
  return (
    <div className="space-y-8">

      {/* ── Section 1: Folgas Aniversário ── */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center shrink-0">
            <Gift size={20} className="text-purple-600" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Folgas Benefício Anual</h1>
            <p className="text-xs sm:text-sm text-gray-500">2 folgas por ano completo de empresa · seg–qui, sem feriados</p>
          </div>
        </div>

        <Card className="overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 size={24} className="animate-spin text-purple-500" />
            </div>
          ) : beneficios.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
              Nenhum colaborador ativo encontrado
            </div>
          ) : (
            <>
              {/* Mobile: cards */}
              <div className="divide-y divide-gray-100 sm:hidden">
                {beneficios.map((b) => {
                  const wKey = `aniv-${b.funcionarioId}`;
                  const wRes = whatsappResult[wKey];
                  return (
                  <div key={b.funcionarioId} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{b.nome}</p>
                        <p className="text-xs text-gray-400">{b.cargo} · {b.restaurante}</p>
                      </div>
                      {benefitBadge(b.folgaAtual)}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                      <span><span className="font-semibold text-gray-800">{b.anosCompletos}</span> anos</span>
                      {b.folgaAtual && <span>Válido até {fmtDate(b.folgaAtual.dataValidade)}</span>}
                    </div>
                    {b.folgaAtual?.usos.length ? (
                      <div className="space-y-1">
                        {b.folgaAtual.usos.map((u) => (
                          <div key={u.id} className="flex items-center gap-1">
                            <span className="text-xs font-mono text-gray-600">{fmtDate(u.data)}</span>
                            <button onClick={() => handleCancelarUso(u.id)} className="p-0.5 text-gray-300 hover:text-red-500 transition-colors" title="Cancelar uso">
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    <div className="flex gap-2">
                      {canUse(b) && (
                        <Button size="sm" variant="outline" onClick={() => openModal(b)} className="flex-1">
                          <CalendarDays size={14} /> Registrar folga
                        </Button>
                      )}
                      {b.folgaAtual && (
                        <button
                          onClick={() => sendBeneficioWhatsApp(wKey, "ANIVERSARIO", { funcionarioId: b.funcionarioId })}
                          disabled={whatsappSending[wKey]}
                          className={`flex items-center gap-1 text-[11px] font-semibold border rounded-md px-2 py-1 transition-colors disabled:opacity-50 ${wRes ? (wRes.ok ? "text-green-600 border-green-300" : "text-red-500 border-red-300") : "text-green-600 border-green-200"}`}
                        >
                          {whatsappSending[wKey] ? <Loader2 size={11} className="animate-spin" /> : <MessageCircle size={11} />}
                          {wRes ? (wRes.ok ? "Enviado" : "Erro") : "WhatsApp"}
                        </button>
                      )}
                    </div>
                  </div>
                  );
                })}
              </div>

              {/* Desktop: table */}
              <div className="hidden sm:block overflow-x-auto">
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
                    {beneficios.map((b) => {
                      const wKey = `aniv-${b.funcionarioId}`;
                      const wRes = whatsappResult[wKey];
                      return (
                      <tr key={b.funcionarioId} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{b.nome}</p>
                          <p className="text-xs text-gray-400">{b.matricula} · {b.cargo}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{b.restaurante}</td>
                        <td className="px-4 py-3">
                          <span className="font-semibold text-gray-800">{b.anosCompletos}</span>
                          {b.anosCompletos < 1 && (
                            <p className="text-xs text-gray-400">Próx. {fmtDate(b.proximoAniversario)}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">{benefitBadge(b.folgaAtual)}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {b.folgaAtual ? (
                            <>
                              <span>Até {fmtDate(b.folgaAtual.dataValidade)}</span>
                              <p className="text-gray-400">{b.folgaAtual.anoReferencia}º ano de empresa</p>
                            </>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3">
                          {b.folgaAtual?.usos.length ? (
                            <div className="space-y-1">
                              {b.folgaAtual.usos.map((u) => (
                                <div key={u.id} className="flex items-center gap-1">
                                  <span className="text-xs font-mono text-gray-700">{fmtDate(u.data)}</span>
                                  <button onClick={() => handleCancelarUso(u.id)} className="p-0.5 text-gray-300 hover:text-red-500 transition-colors" title="Cancelar uso">
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
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {canUse(b) && (
                              <Button size="sm" variant="outline" onClick={() => openModal(b)}>
                                <CalendarDays size={14} /> Registrar
                              </Button>
                            )}
                            {b.folgaAtual && (
                              <div className="flex flex-col gap-0.5">
                                <button
                                  onClick={() => sendBeneficioWhatsApp(wKey, "ANIVERSARIO", { funcionarioId: b.funcionarioId })}
                                  disabled={whatsappSending[wKey]}
                                  title="Enviar informações de folga via WhatsApp"
                                  className="flex items-center gap-1 text-[11px] font-semibold text-green-600 hover:text-green-700 disabled:opacity-50 border border-green-200 hover:border-green-400 rounded-md px-2 py-1 transition-colors"
                                >
                                  {whatsappSending[wKey] ? <Loader2 size={11} className="animate-spin" /> : <MessageCircle size={11} />}
                                  WhatsApp
                                </button>
                                {wRes && (
                                  <span className={`text-[10px] font-medium ${wRes.ok ? "text-green-600" : "text-red-500"}`}>
                                    {wRes.msg}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      </div>

      {/* ── Section 2: Folgas Benefício Extra ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
              <Star size={20} className="text-amber-600" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Folgas Benefício</h2>
              <p className="text-xs sm:text-sm text-gray-500">Folgas concedidas por ocasiões especiais (ex: Dia das Mães)</p>
            </div>
          </div>
          <Button onClick={openAddExtra} size="sm">
            <Plus size={14} /> Adicionar folga
          </Button>
        </div>

        <Card className="overflow-hidden">
          {extrasLoading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 size={24} className="animate-spin text-amber-500" />
            </div>
          ) : extras.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
              Nenhuma folga benefício registrada
            </div>
          ) : (
            <>
              {/* Mobile: cards */}
              <div className="divide-y divide-gray-100 sm:hidden">
                {extras.map((e) => {
                  const wKey = `extra-${e.id}`;
                  const wRes = whatsappResult[wKey];
                  return (
                  <div key={e.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{e.nome}</p>
                        <p className="text-xs text-gray-400">{e.cargo} · {e.restaurante}</p>
                      </div>
                      {extraStatusBadge(e.status)}
                    </div>
                    <p className="text-xs font-medium text-gray-700">{e.motivo}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                      <span>Concessão: {fmtDate(e.dataConcessao)}</span>
                      {e.dataValidade && <span>Validade: {fmtDate(e.dataValidade)}</span>}
                      {e.dataUso && <span>Usado em: {fmtDate(e.dataUso)}</span>}
                    </div>
                    {e.observacoes && <p className="text-xs text-gray-400 italic">{e.observacoes}</p>}
                    <div className="flex gap-2 pt-1">
                      {e.status === "DISPONIVEL" && (
                        <Button size="sm" variant="outline" onClick={() => openUsarExtra(e)} className="flex-1">
                          <CalendarDays size={14} /> Registrar uso
                        </Button>
                      )}
                      <button
                        onClick={() => sendBeneficioWhatsApp(wKey, "EXTRA", { folgaExtraId: e.id })}
                        disabled={whatsappSending[wKey]}
                        className={`flex items-center gap-1 text-[11px] font-semibold border rounded-md px-2 py-1 transition-colors disabled:opacity-50 ${wRes ? (wRes.ok ? "text-green-600 border-green-300" : "text-red-500 border-red-300") : "text-green-600 border-green-200"}`}
                      >
                        {whatsappSending[wKey] ? <Loader2 size={11} className="animate-spin" /> : <MessageCircle size={11} />}
                        {wRes ? (wRes.ok ? "Enviado" : "Erro") : "WA"}
                      </button>
                      <Button size="sm" variant="outline" onClick={() => handleDeleteExtra(e.id)} className="text-red-500 hover:text-red-600">
                        <X size={14} />
                      </Button>
                    </div>
                  </div>
                  );
                })}
              </div>

              {/* Desktop: table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">Colaborador</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">Restaurante</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">Motivo</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">Concessão</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">Validade</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">Status</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">Uso</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {extras.map((e) => {
                      const wKey = `extra-${e.id}`;
                      const wRes = whatsappResult[wKey];
                      return (
                      <tr key={e.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{e.nome}</p>
                          <p className="text-xs text-gray-400">{e.cargo}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs">{e.restaurante}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{e.motivo}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(e.dataConcessao)}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{e.dataValidade ? fmtDate(e.dataValidade) : "—"}</td>
                        <td className="px-4 py-3">{extraStatusBadge(e.status)}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{e.dataUso ? fmtDate(e.dataUso) : "—"}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            {e.status === "DISPONIVEL" && (
                              <Button size="sm" variant="outline" onClick={() => openUsarExtra(e)}>
                                <CalendarDays size={14} /> Usar
                              </Button>
                            )}
                            <div className="flex flex-col gap-0.5">
                              <button
                                onClick={() => sendBeneficioWhatsApp(wKey, "EXTRA", { folgaExtraId: e.id })}
                                disabled={whatsappSending[wKey]}
                                title="Enviar informações via WhatsApp ao colaborador"
                                className="flex items-center gap-1 text-[11px] font-semibold text-green-600 hover:text-green-700 disabled:opacity-50 border border-green-200 hover:border-green-400 rounded-md px-2 py-1 transition-colors"
                              >
                                {whatsappSending[wKey] ? <Loader2 size={11} className="animate-spin" /> : <MessageCircle size={11} />}
                                WhatsApp
                              </button>
                              {wRes && (
                                <span className={`text-[10px] font-medium ${wRes.ok ? "text-green-600" : "text-red-500"}`}>
                                  {wRes.msg}
                                </span>
                              )}
                            </div>
                            <button onClick={() => handleDeleteExtra(e.id)} className="p-1.5 text-gray-300 hover:text-red-500 transition-colors" title="Excluir">
                              <X size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      </div>

      {/* ── MODAL: Registrar Folga Aniversário ── */}
      <Modal open={usarModal} onClose={() => setUsarModal(false)} title="Registrar Folga de Benefício" size="sm">
        <div className="p-4 sm:p-6 space-y-4">
          {selected && (
            <div className="bg-purple-50 rounded-lg px-4 py-3 text-sm">
              <p className="font-semibold text-purple-900">{selected.nome}</p>
              <p className="text-purple-600 text-xs mt-0.5">
                {selected.folgaAtual?.folgasDisponiveis} folga(s) disponível(is) · válido até {selected.folgaAtual ? fmtDate(selected.folgaAtual.dataValidade) : "—"}
              </p>
            </div>
          )}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">1ª folga *</label>
              <Input type="date" value={folgaDate1} onChange={(e) => setFolgaDate1(e.target.value)} />
            </div>
            {selected?.folgaAtual && selected.folgaAtual.folgasDisponiveis === 2 && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">2ª folga <span className="text-gray-400 font-normal">(opcional)</span></label>
                <Input type="date" value={folgaDate2} onChange={(e) => setFolgaDate2(e.target.value)} />
              </div>
            )}
            <p className="text-xs text-gray-400">Permitido: segunda a quinta, sem feriados ou vésperas.</p>
          </div>
          {folgaError && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
              <AlertCircle size={15} className="mt-0.5 shrink-0" />
              {folgaError}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button variant="outline" onClick={() => setUsarModal(false)}>Cancelar</Button>
            <Button onClick={handleUsarFolga} disabled={folgaSaving || !folgaDate1}>
              {folgaSaving && <Loader2 size={14} className="animate-spin" />}
              Registrar
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── MODAL: Adicionar Folga Extra ── */}
      <Modal open={addExtraModal} onClose={() => setAddExtraModal(false)} title="Adicionar Folga Benefício" size="sm">
        <div className="p-4 sm:p-6 space-y-4">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Colaborador *</label>
              <select
                value={extraForm.funcionarioId}
                onChange={(e) => setExtraForm((f) => ({ ...f, funcionarioId: e.target.value }))}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecione...</option>
                {funcionarios.map((f) => (
                  <option key={f.id} value={f.id}>{f.nome} — {f.restaurante?.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Motivo *</label>
              <Input
                placeholder="Ex: Dia das Mães, Dia dos Pais..."
                value={extraForm.motivo}
                onChange={(e) => setExtraForm((f) => ({ ...f, motivo: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Data de concessão *</label>
              <Input type="date" value={extraForm.dataConcessao} onChange={(e) => setExtraForm((f) => ({ ...f, dataConcessao: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Validade <span className="text-gray-400 font-normal">(opcional)</span></label>
              <Input type="date" value={extraForm.dataValidade} onChange={(e) => setExtraForm((f) => ({ ...f, dataValidade: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Observações <span className="text-gray-400 font-normal">(opcional)</span></label>
              <Input
                placeholder="Observações adicionais..."
                value={extraForm.observacoes}
                onChange={(e) => setExtraForm((f) => ({ ...f, observacoes: e.target.value }))}
              />
            </div>
          </div>
          {extraError && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
              <AlertCircle size={15} className="mt-0.5 shrink-0" />
              {extraError}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button variant="outline" onClick={() => setAddExtraModal(false)}>Cancelar</Button>
            <Button onClick={handleAddExtra} disabled={extraSaving}>
              {extraSaving && <Loader2 size={14} className="animate-spin" />}
              Adicionar
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── MODAL: Registrar Uso Folga Extra ── */}
      <Modal open={usarExtraModal} onClose={() => setUsarExtraModal(false)} title="Registrar Uso da Folga" size="sm">
        <div className="p-4 sm:p-6 space-y-4">
          {selectedExtra && (
            <div className="bg-amber-50 rounded-lg px-4 py-3 text-sm">
              <p className="font-semibold text-amber-900">{selectedExtra.nome}</p>
              <p className="text-amber-700 text-xs mt-0.5">{selectedExtra.motivo}</p>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Data de uso *</label>
            <Input type="date" value={extraUsoDate} onChange={(e) => setExtraUsoDate(e.target.value)} />
          </div>
          {extraError && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
              <AlertCircle size={15} className="mt-0.5 shrink-0" />
              {extraError}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button variant="outline" onClick={() => setUsarExtraModal(false)}>Cancelar</Button>
            <Button onClick={handleUsarExtra} disabled={extraSaving || !extraUsoDate}>
              {extraSaving && <Loader2 size={14} className="animate-spin" />}
              Registrar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
