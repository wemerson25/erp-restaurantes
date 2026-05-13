"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import {
  Loader2, CalendarRange, ChevronLeft, ChevronRight, Plus,
  AlertTriangle, Copy, Printer, Settings2, Users, X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";

// ── constants ────────────────────────────────────────────────────────────────

const SETORES = ["BAR", "ATENDIMENTO", "CAIXA", "COZINHA", "SUSHIBAR", "DELIVERY"];
const TURNOS_AUSENCIA = new Set(["FOLGA", "FOLGA_B", "FERIAS", "ATESTADO", "AUSENTE"]);
const TURNOS_OPCOES = [
  { value: "ALMOCO",   label: "🌅 Almoço",      group: "work" },
  { value: "JANTAR",   label: "🌙 Jantar",       group: "work" },
  { value: "INTEGRAL", label: "☀️ Dia inteiro",  group: "work" },
  { value: "FOLGA",    label: "🏠 Folga",         group: "aus" },
  { value: "FOLGA_B",  label: "🎁 Folga Benef.",  group: "aus" },
  { value: "FERIAS",   label: "🏖️ Férias",        group: "aus" },
  { value: "ATESTADO", label: "🏥 Atestado",      group: "aus" },
  { value: "AUSENTE",  label: "❌ Ausente",        group: "aus" },
];

const AUSENCIA_STYLE: Record<string, string> = {
  FOLGA:    "bg-gray-100    text-gray-600  border-gray-200",
  FOLGA_B:  "bg-amber-100   text-amber-700 border-amber-200",
  FERIAS:   "bg-teal-100    text-teal-700  border-teal-200",
  ATESTADO: "bg-orange-100  text-orange-700 border-orange-200",
  AUSENTE:  "bg-red-100     text-red-700   border-red-200",
};

const AUSENCIA_LABEL: Record<string, string> = {
  FOLGA: "Folga", FOLGA_B: "F.Ben.", FERIAS: "Férias", ATESTADO: "Atest.", AUSENTE: "Ausente",
};

const DOW_SHORT  = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const DOW_FULL   = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

const ALERTA_STYLE: Record<string, string> = {
  SETOR_DESCOBERTO:   "bg-yellow-50 border-yellow-300 text-yellow-800",
  FUNCIONARIO_EM_FERIAS: "bg-teal-50 border-teal-300 text-teal-800",
  FUNCIONARIO_AUSENTE:  "bg-orange-50 border-orange-300 text-orange-800",
  CONFLITO_HORARIO:    "bg-red-50 border-red-300 text-red-800",
  FUNCIONARIO_DEMITIDO:"bg-red-50 border-red-300 text-red-800",
};

// ── types ────────────────────────────────────────────────────────────────────

interface ScheduleEntry {
  id: string;
  funcionarioId: string;
  funcionarioNome: string;
  data: string;
  setor: string;
  turno: string;
}
interface Alerta { tipo: string; mensagem: string }
interface Funcionario { id: string; nome: string; cargo: { nome: string } | null }
interface Restaurante { id: string; nome: string; ativo?: boolean }
interface EscalaData {
  schedules: ScheduleEntry[];
  alertas: Alerta[];
  funcionarios: Funcionario[];
  funcionarioSetores: { funcionarioId: string; setor: string }[];
  semanaInicio: string;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function getMondayOfWeek(date: Date) {
  const d = new Date(date);
  const dow = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (dow === 0 ? -6 : 1 - dow));
  return d.toISOString().slice(0, 10);
}
function addDays(s: string, n: number) {
  const d = new Date(`${s}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function fmtShort(s: string) { const [,m,d] = s.split("-"); return `${d}/${m}`; }
function weekDays(s: string) { return Array.from({ length: 7 }, (_, i) => addDays(s, i)); }
function firstName(nome: string) { return nome.split(" ")[0]; }
function fmtPrint(s: string) { const [y, m, d] = s.split("-"); return `${d}/${m}/${y}`; }

// ── main component ────────────────────────────────────────────────────────────

export function EscalaContent() {
  const [restaurantes, setRestaurantes] = useState<Restaurante[]>([]);
  const [restauranteId, setRestauranteId] = useState("");
  const [semanaInicio, setSemanaInicio] = useState(() => getMondayOfWeek(new Date()));
  const [data, setData] = useState<EscalaData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");

  // Add modal
  const [addModal, setAddModal]       = useState(false);
  const [addSetor, setAddSetor]       = useState("ATENDIMENTO");
  const [addDate, setAddDate]         = useState("");
  const [addFuncId, setAddFuncId]     = useState("");
  const [addTurno, setAddTurno]       = useState("ALMOCO");
  const [addTambemJantar, setAddTambemJantar] = useState(true);
  const [addSaving, setAddSaving]     = useState(false);
  const [addError, setAddError]       = useState("");

  // Duplicate modal
  const [dupModal, setDupModal]   = useState(false);
  const [dupTarget, setDupTarget] = useState("");
  const [dupSaving, setDupSaving] = useState(false);
  const [dupError, setDupError]   = useState("");

  // Sector visibility (localStorage)
  const [setoresAtivos, setSetoresAtivos] = useState<Set<string>>(new Set(SETORES));
  const setoresPanelRef = useRef<HTMLDivElement>(null);
  const [setoresPanel, setSetoresPanel] = useState(false);

  // Employee–sector config panel
  const [configOpen, setConfigOpen]       = useState(false);
  const [savingKey, setSavingKey]         = useState<string | null>(null);

  // Mobile
  const [mobileDay, setMobileDay] = useState(0);

  // Print
  const [printModal, setPrintModal]     = useState(false);
  const [printIncluded, setPrintIncluded] = useState<Set<string>>(new Set());
  // printBreaks[i] = true → page break AFTER visibleSetores[i]
  const [printBreaks, setPrintBreaks]   = useState<boolean[]>([]);
  const [printGroups, setPrintGroups]   = useState<string[][]>([]); // computed on confirm

  // Close sector dropdown on outside click
  useEffect(() => {
    function h(e: MouseEvent) {
      if (setoresPanelRef.current && !setoresPanelRef.current.contains(e.target as Node))
        setSetoresPanel(false);
    }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // Load restaurants
  useEffect(() => {
    fetch("/api/restaurantes")
      .then((r) => r.json())
      .then((list: Restaurante[]) => {
        const ativos = list.filter((r) => r.ativo !== false);
        setRestaurantes(ativos);
        if (ativos.length > 0) setRestauranteId(ativos[0].id);
      });
  }, []);

  // Sector visibility from localStorage
  useEffect(() => {
    if (!restauranteId) return;
    const saved = localStorage.getItem(`escala_setores_${restauranteId}`);
    if (saved) { try { setSetoresAtivos(new Set(JSON.parse(saved))); } catch { /**/ } }
    else setSetoresAtivos(new Set(SETORES));
  }, [restauranteId]);

  function toggleSetor(s: string) {
    setSetoresAtivos((prev) => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      localStorage.setItem(`escala_setores_${restauranteId}`, JSON.stringify([...next]));
      return next;
    });
  }

  // Fetch escala
  const fetchEscala = useCallback(async () => {
    if (!restauranteId) return;
    setLoading(true); setLoadError("");
    try {
      const res = await fetch(`/api/escala?semanaInicio=${semanaInicio}&restauranteId=${restauranteId}`);
      const json = await res.json();
      if (!res.ok) { setLoadError(json.error ?? `Erro ${res.status}`); return; }
      setData(json);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Erro ao carregar");
    } finally { setLoading(false); }
  }, [restauranteId, semanaInicio]);

  useEffect(() => { fetchEscala(); }, [fetchEscala]);

  // Derived maps
  const funcSetoresMap = new Map<string, Set<string>>();  // funcionarioId → Set<setor>
  const setorFuncsMap  = new Map<string, string[]>();     // setor → funcionarioId[]
  if (data?.funcionarioSetores) {
    for (const fs of data.funcionarioSetores) {
      if (!funcSetoresMap.has(fs.funcionarioId)) funcSetoresMap.set(fs.funcionarioId, new Set());
      funcSetoresMap.get(fs.funcionarioId)!.add(fs.setor);
      if (!setorFuncsMap.has(fs.setor)) setorFuncsMap.set(fs.setor, []);
      setorFuncsMap.get(fs.setor)!.push(fs.funcionarioId);
    }
  }

  function funcsForSetor(setor: string): Funcionario[] {
    if (!data) return [];
    const ids = setorFuncsMap.get(setor);
    if (!ids || ids.length === 0) return data.funcionarios;
    return data.funcionarios.filter((f) => ids.includes(f.id));
  }

  // Cell map: setor|date → entries[]
  const cellMap = new Map<string, ScheduleEntry[]>();
  if (data) {
    for (const s of data.schedules) {
      const key = `${s.setor}|${s.data}`;
      const arr = cellMap.get(key); if (!arr) cellMap.set(key, [s]); else arr.push(s);
    }
  }

  function openAdd(setor: string, date: string, turno = "ALMOCO") {
    const funcs = funcsForSetor(setor);
    setAddSetor(setor);
    setAddDate(date);
    setAddTurno(turno);
    setAddTambemJantar(turno === "ALMOCO");
    setAddFuncId(funcs[0]?.id ?? data?.funcionarios[0]?.id ?? "");
    setAddError("");
    setAddModal(true);
  }

  async function handleAdd() {
    if (!addFuncId || !addDate || !restauranteId) return;
    setAddSaving(true); setAddError("");
    try {
      const base = { funcionarioId: addFuncId, restauranteId, data: addDate };

      if (TURNOS_AUSENCIA.has(addTurno)) {
        // Register across all employee sectors (or all active sectors if none configured)
        const mySetores = funcSetoresMap.get(addFuncId);
        const targetSetores = mySetores && mySetores.size > 0
          ? [...mySetores].filter((s) => setoresAtivos.has(s))
          : [...setoresAtivos];
        await Promise.all(targetSetores.map((s) =>
          fetch("/api/escala", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...base, setor: s, turno: addTurno }),
          })
        ));
      } else {
        const r1 = await fetch("/api/escala", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...base, setor: addSetor, turno: addTurno }),
        });
        const j1 = await r1.json();
        if (!r1.ok) { setAddError(j1.error ?? "Erro ao salvar"); return; }

        if (addTurno === "ALMOCO" && addTambemJantar) {
          await fetch("/api/escala", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...base, setor: addSetor, turno: "JANTAR" }),
          });
        }
      }
      setAddModal(false);
      fetchEscala();
    } finally { setAddSaving(false); }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/escala/${id}`, { method: "DELETE" });
    fetchEscala();
  }

  async function toggleFuncSetor(funcionarioId: string, setor: string, ativo: boolean) {
    const key = `${funcionarioId}|${setor}`;
    setSavingKey(key);
    await fetch("/api/escala/funcionario-setores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ funcionarioId, setor, ativo }),
    });
    setSavingKey(null);
    fetchEscala();
  }

  function openDup() { setDupTarget(addDays(semanaInicio, 7)); setDupError(""); setDupModal(true); }

  async function handleDuplicate() {
    if (!dupTarget || !restauranteId) return;
    setDupSaving(true); setDupError("");
    try {
      const res = await fetch("/api/escala/duplicar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restauranteId, sourceSemana: semanaInicio, targetSemana: dupTarget }),
      });
      const json = await res.json();
      if (!res.ok) { setDupError(json.error ?? "Erro ao duplicar"); return; }
      setDupModal(false);
      setSemanaInicio(dupTarget);
    } finally { setDupSaving(false); }
  }

  const days = weekDays(semanaInicio);
  const today = new Date().toISOString().slice(0, 10);
  const visibleSetores = SETORES.filter((s) => setoresAtivos.has(s));
  const restauranteNome = restaurantes.find((r) => r.id === restauranteId)?.nome ?? "";

  function openPrint() {
    setPrintIncluded(new Set(visibleSetores));
    setPrintBreaks(visibleSetores.map(() => true)); // default: page break after every sector
    setPrintModal(true);
  }

  function handlePrint() {
    // Build groups: sectors between page-breaks become one group
    const groups: string[][] = [];
    let cur: string[] = [];
    visibleSetores.forEach((s, i) => {
      if (!printIncluded.has(s)) return;
      cur.push(s);
      if (printBreaks[i] !== false) { groups.push([...cur]); cur = []; }
    });
    if (cur.length) groups.push(cur);
    setPrintGroups(groups);
    setPrintModal(false);
    setTimeout(() => window.print(), 80);
  }

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <>
    <div className="space-y-4 print:hidden">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center shrink-0">
          <CalendarRange size={20} className="text-indigo-600" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Escala Semanal</h1>
          <p className="text-xs sm:text-sm text-gray-500">Turnos e setores por restaurante</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        {restaurantes.length > 1 && (
          <Select value={restauranteId} onChange={(e) => setRestauranteId(e.target.value)} className="w-48">
            {restaurantes.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
          </Select>
        )}

        <div className="flex items-center gap-0.5 bg-white border border-gray-200 rounded-lg px-1">
          <button onClick={() => setSemanaInicio((s) => addDays(s, -7))} className="p-1.5 hover:bg-gray-100 rounded">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-medium px-2 min-w-[140px] text-center">
            {fmtShort(semanaInicio)} – {fmtShort(addDays(semanaInicio, 6))}
          </span>
          <button onClick={() => setSemanaInicio((s) => addDays(s, 7))} className="p-1.5 hover:bg-gray-100 rounded">
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="ml-auto flex flex-wrap gap-2">
          {/* Setores toggle */}
          <div className="relative" ref={setoresPanelRef}>
            <Button variant="outline" size="sm" onClick={() => setSetoresPanel((v) => !v)}>
              <Settings2 size={14} /> Setores
            </Button>
            {setoresPanel && (
              <div className="absolute right-0 top-full mt-1 z-30 bg-white border border-gray-200 rounded-xl shadow-lg p-3 min-w-[160px] space-y-2">
                <p className="text-xs font-semibold text-gray-500">Setores visíveis</p>
                {SETORES.map((s) => (
                  <label key={s} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={setoresAtivos.has(s)} onChange={() => toggleSetor(s)} className="w-4 h-4 accent-indigo-600" />
                    <span className="text-sm text-gray-700">{s}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <Button variant="outline" size="sm" onClick={() => setConfigOpen((v) => !v)}>
            <Users size={14} /> Colaboradores
          </Button>
          <Button variant="outline" size="sm" onClick={openDup}>
            <Copy size={14} /> Duplicar
          </Button>
          <Button variant="outline" size="sm" onClick={openPrint}>
            <Printer size={14} /> Imprimir
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {data && data.alertas.length > 0 && (
        <div className="space-y-1.5 print:hidden">
          {data.alertas.map((a, i) => (
            <div key={i} className={`flex items-start gap-2 border rounded-lg px-3 py-2 text-xs ${ALERTA_STYLE[a.tipo] ?? "bg-gray-50 border-gray-200 text-gray-700"}`}>
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              {a.mensagem}
            </div>
          ))}
        </div>
      )}

      {/* Grid card */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 size={24} className="animate-spin text-indigo-500" />
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2 text-sm text-red-500">
            <AlertTriangle size={20} /><span>{loadError}</span>
            <button onClick={fetchEscala} className="text-xs text-gray-500 underline">Tentar novamente</button>
          </div>
        ) : !data ? null : (
          <>
            {/* ── MOBILE ── */}
            <div className="sm:hidden">
              <div className="flex overflow-x-auto border-b border-gray-100">
                {days.map((d, i) => (
                  <button key={d} onClick={() => setMobileDay(i)}
                    className={`flex-shrink-0 px-3 py-2 text-xs font-medium border-b-2 transition-colors
                      ${mobileDay === i ? "border-indigo-500 text-indigo-700" : "border-transparent text-gray-500"}
                      ${d === today ? "font-bold" : ""}`}>
                    <div>{DOW_SHORT[i]}</div>
                    <div className="text-[10px] text-gray-400 font-normal">{fmtShort(d)}</div>
                  </button>
                ))}
              </div>
              <div className="divide-y divide-gray-100">
                {visibleSetores.map((setor) => (
                  <div key={setor} className="p-3 space-y-2">
                    <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">{setor}</p>
                    <GridCell setor={setor} date={days[mobileDay]} entries={cellMap.get(`${setor}|${days[mobileDay]}`) ?? []} onAdd={openAdd} onDelete={handleDelete} mobile />
                  </div>
                ))}
              </div>
            </div>

            {/* ── DESKTOP ── */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-3 py-3 text-left font-bold text-gray-600 w-[80px] text-[11px] uppercase tracking-wide">Setor</th>
                    {days.map((d, i) => (
                      <th key={d} className={`px-2 py-3 font-semibold min-w-[150px] text-center ${d === today ? "bg-indigo-50 text-indigo-700" : "text-gray-600"}`}>
                        <div className="text-sm">{DOW_FULL[i]}</div>
                        <div className="text-[11px] font-normal text-gray-400">{fmtShort(d)}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleSetores.map((setor) => (
                    <tr key={setor} className="border-b border-gray-100 align-top">
                      <td className="px-3 py-3">
                        <span className="font-bold text-[11px] text-gray-600 uppercase tracking-wide">{setor}</span>
                      </td>
                      {days.map((d) => (
                        <td key={d} className={`px-1.5 py-1.5 ${d === today ? "bg-indigo-50/30" : ""}`}>
                          <GridCell setor={setor} date={d} entries={cellMap.get(`${setor}|${d}`) ?? []} onAdd={openAdd} onDelete={handleDelete} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      {/* ── Employee-sector config ── */}
      {configOpen && data && (
        <Card className="overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-800 text-sm">Setores por Colaborador</p>
              <p className="text-xs text-gray-400">Marque em quais setores cada colaborador pode ser escalado</p>
            </div>
            <button onClick={() => setConfigOpen(false)} className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-700">
              <X size={16} />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-4 py-2.5 text-left font-semibold text-gray-600 min-w-[160px]">Colaborador</th>
                  {visibleSetores.map((s) => (
                    <th key={s} className="px-3 py-2.5 text-center font-semibold text-gray-600 min-w-[80px]">{s}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.funcionarios.map((f) => {
                  const mySetores = funcSetoresMap.get(f.id) ?? new Set<string>();
                  return (
                    <tr key={f.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-gray-900">{f.nome}</p>
                        {f.cargo && <p className="text-gray-400 text-[11px]">{f.cargo.nome}</p>}
                      </td>
                      {visibleSetores.map((s) => {
                        const checked = mySetores.has(s);
                        const key = `${f.id}|${s}`;
                        return (
                          <td key={s} className="px-3 py-2.5 text-center">
                            {savingKey === key
                              ? <Loader2 size={12} className="animate-spin text-indigo-400 inline" />
                              : <input type="checkbox" checked={checked} onChange={() => toggleFuncSetor(f.id, s, !checked)} className="w-4 h-4 accent-indigo-600 cursor-pointer" />
                            }
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── ADD MODAL ── */}
      <Modal open={addModal} onClose={() => setAddModal(false)} title="Adicionar à Escala" size="sm">
        <div className="p-4 sm:p-6 space-y-4">
          {!TURNOS_AUSENCIA.has(addTurno) && (
            <div className="flex items-center gap-3 bg-indigo-50 rounded-lg px-4 py-3">
              <div className="w-2 h-8 rounded-full bg-indigo-400" />
              <div>
                <p className="font-semibold text-indigo-900 text-sm">{addSetor}</p>
                <p className="text-indigo-500 text-xs">{addDate ? fmtShort(addDate) : "—"}</p>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Turno *</label>
              <Select value={addTurno} onChange={(e) => { setAddTurno(e.target.value); setAddTambemJantar(e.target.value === "ALMOCO"); }}>
                <optgroup label="Trabalho">
                  {TURNOS_OPCOES.filter(t => t.group === "work").map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </optgroup>
                <optgroup label="Ausências">
                  {TURNOS_OPCOES.filter(t => t.group === "aus").map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </optgroup>
              </Select>
            </div>

            {addTurno === "ALMOCO" && (
              <label className="flex items-center gap-2 cursor-pointer bg-purple-50 rounded-lg px-3 py-2 select-none">
                <input type="checkbox" checked={addTambemJantar} onChange={(e) => setAddTambemJantar(e.target.checked)} className="w-4 h-4 accent-purple-600" />
                <span className="text-sm text-purple-800">Também registrar no <strong>Jantar</strong></span>
              </label>
            )}

            {TURNOS_AUSENCIA.has(addTurno) && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                Será registrado em todos os setores do colaborador.
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Colaborador *</label>
              <Select value={addFuncId} onChange={(e) => setAddFuncId(e.target.value)}>
                {(TURNOS_AUSENCIA.has(addTurno) ? (data?.funcionarios ?? []) : funcsForSetor(addSetor)).map((f) => (
                  <option key={f.id} value={f.id}>{f.nome}{f.cargo ? ` · ${f.cargo.nome}` : ""}</option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Data</label>
              <input type="date" value={addDate} onChange={(e) => setAddDate(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
          </div>

          {addError && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{addError}</p>}

          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button variant="outline" onClick={() => setAddModal(false)}>Cancelar</Button>
            <Button onClick={handleAdd} disabled={addSaving || !addFuncId}>
              {addSaving && <Loader2 size={14} className="animate-spin" />}
              Adicionar
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── DUPLICATE MODAL ── */}
      <Modal open={dupModal} onClose={() => setDupModal(false)} title="Duplicar Semana" size="sm">
        <div className="p-4 sm:p-6 space-y-4">
          <p className="text-sm text-gray-600">
            Copiar <span className="font-semibold">{fmtShort(semanaInicio)}–{fmtShort(addDays(semanaInicio, 6))}</span> para:
          </p>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Semana destino (segunda-feira) *</label>
            <input type="date" value={dupTarget} onChange={(e) => setDupTarget(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>
          <p className="text-xs text-gray-400">Entradas na semana destino serão substituídas.</p>
          {dupError && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{dupError}</p>}
          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button variant="outline" onClick={() => setDupModal(false)}>Cancelar</Button>
            <Button onClick={handleDuplicate} disabled={dupSaving || !dupTarget}>
              {dupSaving && <Loader2 size={14} className="animate-spin" />}
              <Copy size={14} /> Duplicar
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── PRINT MODAL ── */}
      <Modal open={printModal} onClose={() => setPrintModal(false)} title="Configurar Impressão" size="sm">
        <div className="p-4 sm:p-6 space-y-4">
          <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm">
            <p className="font-semibold text-gray-900">{fmtPrint(semanaInicio)} – {fmtPrint(addDays(semanaInicio, 6))}</p>
            {restauranteNome && <p className="text-xs text-gray-500">{restauranteNome}</p>}
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Organizar setores por página
            </p>
            <p className="text-xs text-gray-400 mb-3">
              Ative <strong>Mesma página</strong> entre setores para imprimi-los na mesma tabela.
            </p>

            <div className="space-y-0">
              {visibleSetores.map((s, i) => (
                <div key={s}>
                  {/* Sector row */}
                  <label className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={printIncluded.has(s)}
                      onChange={(e) => {
                        const next = new Set(printIncluded);
                        e.target.checked ? next.add(s) : next.delete(s);
                        setPrintIncluded(next);
                      }}
                      className="w-4 h-4 accent-indigo-600 shrink-0"
                    />
                    <span className="text-sm font-semibold text-gray-800">{s}</span>
                  </label>

                  {/* Break toggle between this and next sector */}
                  {i < visibleSetores.length - 1 && printIncluded.has(s) && printIncluded.has(visibleSetores[i + 1]) && (
                    <button
                      onClick={() => {
                        const next = [...printBreaks];
                        next[i] = !next[i];
                        setPrintBreaks(next);
                      }}
                      className={`w-full flex items-center gap-2 py-1 px-2 rounded text-xs transition-colors ${
                        printBreaks[i] !== false
                          ? "text-gray-400 hover:text-gray-600"
                          : "text-indigo-600 bg-indigo-50 hover:bg-indigo-100 font-semibold"
                      }`}
                    >
                      <div className={`flex-1 border-t border-dashed ${printBreaks[i] !== false ? "border-gray-200" : "border-indigo-300"}`} />
                      <span className="shrink-0">
                        {printBreaks[i] !== false ? "— nova página —" : "✓ mesma página"}
                      </span>
                      <div className={`flex-1 border-t border-dashed ${printBreaks[i] !== false ? "border-gray-200" : "border-indigo-300"}`} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button variant="outline" onClick={() => setPrintModal(false)}>Cancelar</Button>
            <Button onClick={handlePrint} disabled={printIncluded.size === 0}>
              <Printer size={14} /> Imprimir
            </Button>
          </div>
        </div>
      </Modal>
    </div>

    {/* ── PRINT SECTION (screen hidden, visible only during print) ── */}
    <div className="hidden print:block font-sans text-gray-900">
      {printGroups.map((group, i) => (
        <div key={group.join("+")} className={i > 0 ? "break-before-page" : ""}>
          <PrintGroupPage
            setores={group}
            days={days}
            cellMap={cellMap}
            restauranteNome={restauranteNome}
            semanaInicio={semanaInicio}
          />
        </div>
      ))}
    </div>
    </>
  );
}

// ── GridCell ─────────────────────────────────────────────────────────────────

function GridCell({
  setor, date, entries, onAdd, onDelete, mobile = false,
}: {
  setor: string; date: string; entries: ScheduleEntry[];
  onAdd: (setor: string, date: string, turno: string) => void;
  onDelete: (id: string) => void;
  mobile?: boolean;
}) {
  const almoco   = entries.filter((e) => e.turno === "ALMOCO");
  const jantar   = entries.filter((e) => e.turno === "JANTAR");
  const integral = entries.filter((e) => e.turno === "INTEGRAL");
  const ausencias = entries.filter((e) => TURNOS_AUSENCIA.has(e.turno));

  if (mobile) {
    return (
      <div className="space-y-2">
        {ausencias.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {ausencias.map((e) => <AusenciaTag key={e.id} entry={e} onDelete={onDelete} />)}
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <TurnoSection label="Almoço" color="blue" entries={[...almoco, ...integral]} isIntegralShown={integral.length > 0}
            onAdd={() => onAdd(setor, date, "ALMOCO")} onDelete={onDelete} mobile />
          <TurnoSection label="Jantar" color="purple" entries={[...jantar, ...integral]} isIntegralShown={integral.length > 0}
            onAdd={() => onAdd(setor, date, "JANTAR")} onDelete={onDelete} mobile />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1 min-h-[80px]">
      {ausencias.map((e) => <AusenciaTag key={e.id} entry={e} onDelete={onDelete} />)}
      <TurnoSection label="Alm" color="blue" entries={[...almoco, ...integral]} isIntegralShown={integral.length > 0}
        onAdd={() => onAdd(setor, date, "ALMOCO")} onDelete={onDelete} />
      <TurnoSection label="Jan" color="purple" entries={[...jantar, ...integral]} isIntegralShown={integral.length > 0}
        onAdd={() => onAdd(setor, date, "JANTAR")} onDelete={onDelete} />
    </div>
  );
}

// ── TurnoSection ─────────────────────────────────────────────────────────────

const TURNO_SECTION_STYLE = {
  blue:   { bg: "bg-blue-50",   border: "border-blue-100",   label: "text-blue-500",   chip: "bg-white border-blue-200 text-blue-900",   btn: "text-blue-300 hover:text-blue-600" },
  purple: { bg: "bg-purple-50", border: "border-purple-100", label: "text-purple-500", chip: "bg-white border-purple-200 text-purple-900", btn: "text-purple-300 hover:text-purple-600" },
};

function TurnoSection({
  label, color, entries, isIntegralShown, onAdd, onDelete, mobile = false,
}: {
  label: string; color: "blue" | "purple";
  entries: ScheduleEntry[]; isIntegralShown: boolean;
  onAdd: () => void; onDelete: (id: string) => void; mobile?: boolean;
}) {
  const st = TURNO_SECTION_STYLE[color];
  return (
    <div className={`rounded-lg border px-1.5 py-1 space-y-0.5 ${st.bg} ${st.border}`}>
      <div className="flex items-center justify-between">
        <span className={`text-[10px] font-bold uppercase tracking-wide ${st.label}`}>{label}</span>
        <button onClick={onAdd} className={`p-0.5 rounded transition-colors print:hidden ${st.btn}`}>
          <Plus size={11} />
        </button>
      </div>
      {entries.length === 0
        ? <p className={`text-[10px] italic ${st.label} opacity-40`}>—</p>
        : entries.map((e) => {
            const isInt = e.turno === "INTEGRAL";
            return (
              <div key={e.id} className={`flex items-center justify-between gap-1 border rounded px-1.5 py-0.5 ${st.chip} ${mobile ? "" : ""}`}>
                <span className="text-[11px] font-medium truncate max-w-[90px]" title={e.funcionarioNome}>
                  {firstName(e.funcionarioNome)}
                  {isInt && <span className="ml-0.5 text-[9px] opacity-50">(int)</span>}
                </span>
                <button onClick={() => onDelete(e.id)} className="shrink-0 opacity-30 hover:opacity-90 transition-opacity print:hidden">
                  <X size={10} />
                </button>
              </div>
            );
          })
      }
    </div>
  );
}

// ── AusenciaTag ──────────────────────────────────────────────────────────────

function AusenciaTag({ entry, onDelete }: { entry: ScheduleEntry; onDelete: (id: string) => void }) {
  const cls = AUSENCIA_STYLE[entry.turno] ?? "bg-gray-100 text-gray-600 border-gray-200";
  return (
    <div className={`flex items-center gap-1 border rounded px-1.5 py-0.5 text-[11px] font-medium ${cls}`}>
      <span className="truncate max-w-[80px]">{firstName(entry.funcionarioNome)}</span>
      <span className="opacity-60 text-[9px]">{AUSENCIA_LABEL[entry.turno] ?? entry.turno}</span>
      <button onClick={() => onDelete(entry.id)} className="opacity-40 hover:opacity-100 transition-opacity print:hidden">
        <X size={9} />
      </button>
    </div>
  );
}

// ── PrintGroupPage ────────────────────────────────────────────────────────────

function PrintGroupPage({
  setores, days, cellMap, restauranteNome, semanaInicio,
}: {
  setores: string[];
  days: string[];
  cellMap: Map<string, ScheduleEntry[]>;
  restauranteNome: string;
  semanaInicio: string;
}) {
  const isMulti = setores.length > 1;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-5 pb-4 border-b-2 border-gray-900">
        {restauranteNome && (
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">{restauranteNome}</p>
        )}
        <h1 className="text-2xl font-bold text-gray-900 uppercase tracking-wide">
          {setores.join("  ·  ")}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Escala — {fmtPrint(semanaInicio)} a {fmtPrint(addDays(semanaInicio, 6))}
        </p>
      </div>

      {/* Table */}
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="border border-gray-300 bg-gray-100 px-3 py-2 text-left font-bold" style={{ width: isMulti ? 160 : 110 }}>
              {isMulti ? "Setor / Turno" : "Turno"}
            </th>
            {days.map((d, i) => (
              <th key={d} className="border border-gray-300 bg-gray-100 px-2 py-2 text-center font-semibold">
                <div className="text-xs font-bold">{DOW_SHORT[i]}</div>
                <div className="font-normal text-gray-500 text-[11px]">{fmtShort(d)}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {setores.map((setor, si) => {
            const hasAus = days.some(
              (d) => (cellMap.get(`${setor}|${d}`) ?? []).some((e) => TURNOS_AUSENCIA.has(e.turno)),
            );
            return (
              <PrintSetorRows
                key={setor}
                setor={setor}
                days={days}
                cellMap={cellMap}
                showSetorHeader={isMulti}
                isLast={si === setores.length - 1}
                hasAus={hasAus}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PrintSetorRows({
  setor, days, cellMap, showSetorHeader, isLast, hasAus,
}: {
  setor: string; days: string[];
  cellMap: Map<string, ScheduleEntry[]>;
  showSetorHeader: boolean; isLast: boolean; hasAus: boolean;
}) {
  function names(d: string, turnos: string[]) {
    return (cellMap.get(`${setor}|${d}`) ?? [])
      .filter((e) => turnos.includes(e.turno))
      .map((e) => e.funcionarioNome.split(" ").slice(0, 2).join(" "))
      .join(", ");
  }

  const bottomBorder = isLast ? "" : "border-b-2 border-b-gray-400";

  return (
    <>
      {showSetorHeader && (
        <tr>
          <td
            colSpan={days.length + 1}
            className="bg-gray-800 text-white px-3 py-1.5 text-xs font-bold uppercase tracking-wider"
          >
            {setor}
          </td>
        </tr>
      )}
      <tr>
        <td className={`border border-gray-300 px-3 py-2.5 font-semibold bg-gray-50 ${showSetorHeader ? "pl-5" : ""}`}>
          Almoço
        </td>
        {days.map((d) => (
          <td key={d} className="border border-gray-300 px-3 py-2.5">
            {names(d, ["ALMOCO", "INTEGRAL"]) || <span className="text-gray-300">—</span>}
          </td>
        ))}
      </tr>
      <tr className={bottomBorder}>
        <td className={`border border-gray-300 px-3 py-2.5 font-semibold bg-gray-50 ${showSetorHeader ? "pl-5" : ""}`}>
          Jantar
        </td>
        {days.map((d) => (
          <td key={d} className="border border-gray-300 px-3 py-2.5">
            {names(d, ["JANTAR", "INTEGRAL"]) || <span className="text-gray-300">—</span>}
          </td>
        ))}
      </tr>
      {hasAus && (
        <tr className={bottomBorder}>
          <td className={`border border-gray-300 px-3 py-2 font-semibold bg-gray-50 text-gray-500 text-xs ${showSetorHeader ? "pl-5" : ""}`}>
            Ausências
          </td>
          {days.map((d) => {
            const aus = (cellMap.get(`${setor}|${d}`) ?? []).filter((e) => TURNOS_AUSENCIA.has(e.turno));
            return (
              <td key={d} className="border border-gray-300 px-3 py-2 text-xs text-gray-500">
                {aus.length > 0
                  ? aus.map((e) => `${firstName(e.funcionarioNome)} (${AUSENCIA_LABEL[e.turno] ?? e.turno})`).join(", ")
                  : <span className="text-gray-300">—</span>}
              </td>
            );
          })}
        </tr>
      )}
    </>
  );
}
