"use client";
import { useEffect, useRef, useState } from "react";
import {
  Bell, User, X, Calendar, Gift, Star, PartyPopper, Briefcase, AlertTriangle, Loader2,
  Send, CheckCircle, AlertCircle,
} from "lucide-react";
import Image from "next/image";

interface Notificacao {
  id: string;
  tipo: string;
  titulo: string;
  descricao: string;
  prioridade: "alta" | "media" | "baixa";
  data?: string;
  funcionarioNome?: string;
}

function tipoIcon(tipo: string) {
  const cls = "shrink-0";
  switch (tipo) {
    case "FERIAS_INICIANDO":            return <Calendar size={13} className={cls} />;
    case "FERIAS_VENCENDO":             return <AlertTriangle size={13} className={cls} />;
    case "FOLGA_ANIVERSARIO_EXPIRANDO": return <Gift size={13} className={cls} />;
    case "FOLGA_EXTRA_EXPIRANDO":       return <Star size={13} className={cls} />;
    case "ANIVERSARIO_HOJE":            return <PartyPopper size={13} className={cls} />;
    case "ANIVERSARIO_SEMANA":          return <Gift size={13} className={cls} />;
    case "ANIVERSARIO_ADMISSAO":        return <Briefcase size={13} className={cls} />;
    default:                            return <Bell size={13} className={cls} />;
  }
}

const ICON_COLOR = {
  alta:  "bg-red-100 text-red-600",
  media: "bg-amber-100 text-amber-600",
  baixa: "bg-blue-100 text-blue-600",
};

const BORDER_COLOR = {
  alta:  "#ef4444",
  media: "#f59e0b",
  baixa: "#3b82f6",
};

const ROW_BG = {
  alta:  "hover:bg-red-50/60",
  media: "hover:bg-amber-50/60",
  baixa: "hover:bg-blue-50/60",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit" });
}

interface HeaderProps {
  title: string;
  subtitle?: string;
  user?: { name: string; role: string } | null;
}

interface Gestor { id: string; nome: string; telefone: string; ativo: boolean }

export function Header({ title, subtitle, user }: HeaderProps) {
  const [open, setOpen] = useState(false);
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [loading, setLoading] = useState(true);
  // Gestores
  const [gestores, setGestores] = useState<Gestor[]>([]);
  const [gestoresSel, setGestoresSel] = useState<Set<string>>(new Set());
  const [gestorEscalaSel, setGestorEscalaSel] = useState<string>("");
  // Tipos de notificação
  const ALL_TIPOS = ["ferias", "aniversarios", "folgas", "admissoes", "demissoes", "vagas"] as const;
  const [tiposSel, setTiposSel] = useState<Set<string>>(new Set(ALL_TIPOS));
  // Alertas RH
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; msg: string } | null>(null);
  // Escala
  const [sendingEscala, setSendingEscala] = useState(false);
  const [sendResultEscala, setSendResultEscala] = useState<{ ok: boolean; msg: string } | null>(null);
  const [semanaEscala, setSemanaEscala] = useState(() => {
    const d = new Date(); const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d.toISOString().slice(0, 10);
  });
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/notificacoes")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setNotificacoes(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
    fetch("/api/gestores")
      .then((r) => r.json())
      .then((data: Gestor[]) => {
        if (Array.isArray(data)) {
          const ativos = data.filter(g => g.ativo);
          setGestores(ativos);
          setGestoresSel(new Set(ativos.map(g => g.telefone)));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const altasCount = notificacoes.filter((n) => n.prioridade === "alta").length;
  const badgeCount = altasCount > 0 ? altasCount : notificacoes.length;

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit" });
  }

  async function handleEnviarWhatsApp() {
    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch("/api/alertas/enviar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gestorTelefones: Array.from(gestoresSel), grupos: Array.from(tiposSel) }),
      });
      const data = await res.json() as { enviados?: number; erros?: string[]; message?: string; error?: string; detail?: string };
      if (!res.ok) {
        setSendResult({ ok: false, msg: data.detail ?? data.error ?? "Erro ao enviar" });
      } else if (data.message) {
        setSendResult({ ok: true, msg: data.message });
      } else {
        const nErros = data.erros?.length ?? 0;
        setSendResult({
          ok: nErros === 0,
          msg: nErros === 0
            ? `${data.enviados} mensagem(ns) enviada(s) ✓`
            : `Erro: ${data.erros?.[0] ?? "falha ao enviar"}`,
        });
      }
    } catch {
      setSendResult({ ok: false, msg: "Erro de conexão" });
    } finally {
      setSending(false);
    }
  }

  async function handleEnviarEscala() {
    setSendingEscala(true);
    setSendResultEscala(null);
    try {
      const res = await fetch("/api/alertas/escala", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ semanaInicio: semanaEscala, gestorTelefone: gestorEscalaSel || undefined }),
      });
      const data = await res.json() as { enviados?: number; semTelefone?: number; total?: number; erros?: string[]; message?: string; error?: string; detail?: string };
      if (!res.ok) {
        setSendResultEscala({ ok: false, msg: data.detail ?? data.error ?? "Erro ao enviar" });
      } else if (data.message) {
        setSendResultEscala({ ok: true, msg: data.message });
      } else {
        const nErros = data.erros?.length ?? 0;
        setSendResultEscala({
          ok: nErros === 0,
          msg: nErros === 0
            ? `Escala enviada com ${data.total ?? "?"} funcionário(s) ✓`
            : `Erro: ${data.erros?.[0] ?? "falha ao enviar"}`,
        });
      }
    } catch {
      setSendResultEscala({ ok: false, msg: "Erro de conexão" });
    } finally {
      setSendingEscala(false);
    }
  }

  return (
    <header className="bg-white border-b-2 border-red-600 px-4 sm:px-6 py-3 pl-16 lg:pl-6 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-3 min-w-0">
        <div className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0" style={{ backgroundColor: "var(--brand-red)" }}>
          <Image src="/logo-ykedin.png" alt="" width={24} height={24} className="object-contain brightness-0 invert" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">{title}</h1>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5 hidden sm:block">{subtitle}</p>}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Bell + Dropdown */}
        <div ref={dropdownRef} className="relative">
          <button
            onClick={() => setOpen((v) => !v)}
            className={`relative p-2 rounded-lg transition-colors ${open ? "text-red-600 bg-red-50" : "text-gray-400 hover:text-red-600 hover:bg-red-50"}`}
            aria-label="Notificações"
          >
            <Bell size={18} />
            {!loading && badgeCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] px-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                {badgeCount > 99 ? "99+" : badgeCount}
              </span>
            )}
            {loading && (
              <span className="absolute -top-0.5 -right-0.5 w-[17px] h-[17px] flex items-center justify-center">
                <Loader2 size={10} className="animate-spin text-gray-400" />
              </span>
            )}
          </button>

          {open && (
            <div className="absolute right-0 top-full mt-2 w-80 sm:w-[22rem] bg-white rounded-xl shadow-2xl border border-gray-200 z-50 flex flex-col max-h-[500px]">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900 text-sm">Notificações</h3>
                  {badgeCount > 0 && (
                    <span className="bg-red-100 text-red-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                      {badgeCount}
                    </span>
                  )}
                </div>
                <button onClick={() => setOpen(false)} className="p-1 text-gray-400 hover:text-gray-600 transition-colors rounded">
                  <X size={14} />
                </button>
              </div>

              {/* Legend */}
              {!loading && notificacoes.length > 0 && (
                <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-50 bg-gray-50/50 text-[10px] text-gray-400">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />Urgente</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />Atenção</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />Informativo</span>
                </div>
              )}

              {/* List */}
              <div className="overflow-y-auto flex-1">
                {loading ? (
                  <div className="flex items-center justify-center gap-2 py-10 text-gray-400 text-sm">
                    <Loader2 size={16} className="animate-spin" /> Carregando...
                  </div>
                ) : notificacoes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-2 text-gray-400">
                    <Bell size={28} className="opacity-20" />
                    <p className="text-sm font-medium">Nenhuma notificação</p>
                    <p className="text-xs text-gray-300">Tudo em dia!</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {notificacoes.map((n) => (
                      <div
                        key={n.id}
                        className={`flex gap-3 px-4 py-3 transition-colors ${ROW_BG[n.prioridade]}`}
                        style={{ borderLeft: `3px solid ${BORDER_COLOR[n.prioridade]}` }}
                      >
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${ICON_COLOR[n.prioridade]}`}>
                          {tipoIcon(n.tipo)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-gray-900 leading-tight">{n.titulo}</p>
                          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{n.descricao}</p>
                          {n.data && (
                            <p className="text-[10px] text-gray-400 mt-1 font-mono">{fmtDate(n.data)}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer: enviar via WhatsApp */}
              <div className="border-t border-gray-100 px-4 py-3 shrink-0 bg-gray-50/50 rounded-b-xl space-y-3">
                {/* Alertas RH */}
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Alertas RH</p>

                  {/* Tipos */}
                  <div className="flex flex-wrap gap-1">
                    {([
                      { key: "ferias",       label: "Férias"       },
                      { key: "aniversarios", label: "Aniversários" },
                      { key: "folgas",       label: "Folgas"       },
                      { key: "admissoes",    label: "Admissões"    },
                      { key: "demissoes",    label: "Demissões"    },
                      { key: "vagas",        label: "Vagas"        },
                    ] as const).map(({ key, label }) => {
                      const sel = tiposSel.has(key);
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setTiposSel(prev => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n; })}
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border transition-colors ${sel ? "bg-indigo-100 text-indigo-700 border-indigo-300" : "bg-gray-100 text-gray-400 border-gray-200"}`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Destinatários */}
                  {gestores.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {gestores.map(g => {
                        const sel = gestoresSel.has(g.telefone);
                        return (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() => setGestoresSel(prev => {
                              const next = new Set(prev);
                              if (next.has(g.telefone)) next.delete(g.telefone); else next.add(g.telefone);
                              return next;
                            })}
                            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border transition-colors ${sel ? "bg-green-100 text-green-700 border-green-300" : "bg-gray-100 text-gray-400 border-gray-200"}`}
                          >
                            {g.nome}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <button
                    onClick={handleEnviarWhatsApp}
                    disabled={sending || tiposSel.size === 0 || gestoresSel.size === 0}
                    className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-200 disabled:text-gray-400 text-white text-xs font-semibold rounded-lg px-3 py-2 transition-colors"
                  >
                    {sending
                      ? <><Loader2 size={13} className="animate-spin" /> Enviando...</>
                      : <><Send size={13} /> Enviar alertas via WhatsApp</>}
                  </button>
                  {sendResult && (
                    <div className={`flex items-center gap-1.5 text-[11px] font-medium rounded-md px-2 py-1.5 ${sendResult.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                      {sendResult.ok
                        ? <CheckCircle size={12} className="shrink-0" />
                        : <AlertCircle size={12} className="shrink-0" />}
                      {sendResult.msg}
                    </div>
                  )}
                </div>

                {/* Escala semanal */}
                <div className="space-y-1.5 border-t border-gray-100 pt-3">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Escala semanal</p>
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] text-gray-500 shrink-0">Semana:</label>
                    <input
                      type="date"
                      value={semanaEscala}
                      onChange={(e) => setSemanaEscala(e.target.value)}
                      className="flex-1 text-[11px] border border-gray-200 rounded-md px-2 py-1 text-gray-700 focus:outline-none focus:ring-1 focus:ring-green-400"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] text-gray-500 shrink-0">Enviar para:</label>
                    <select
                      value={gestorEscalaSel}
                      onChange={e => setGestorEscalaSel(e.target.value)}
                      className="flex-1 text-[11px] border border-gray-200 rounded-md px-2 py-1 text-gray-700 focus:outline-none focus:ring-1 focus:ring-green-400"
                    >
                      <option value="">— selecione —</option>
                      {gestores.map(g => (
                        <option key={g.id} value={g.telefone}>{g.nome}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={handleEnviarEscala}
                    disabled={sendingEscala || !gestorEscalaSel}
                    className="w-full flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-200 disabled:text-gray-400 text-white text-xs font-semibold rounded-lg px-3 py-2 transition-colors"
                  >
                    {sendingEscala
                      ? <><Loader2 size={13} className="animate-spin" /> Enviando...</>
                      : <><Send size={13} /> Enviar escala via WhatsApp</>}
                  </button>
                  {sendResultEscala && (
                    <div className={`flex items-center gap-1.5 text-[11px] font-medium rounded-md px-2 py-1.5 ${sendResultEscala.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
                      {sendResultEscala.ok
                        ? <CheckCircle size={12} className="shrink-0" />
                        : <AlertCircle size={12} className="shrink-0" />}
                      {sendResultEscala.msg}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* User pill */}
        <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-200">
          <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "var(--brand-red)" }}>
            <User size={14} className="text-white" />
          </div>
          <div className="text-xs hidden sm:block">
            <p className="font-semibold text-gray-800 leading-tight">{user?.name ?? "Usuário"}</p>
            <p className="text-gray-400">{user?.role ?? "RH"}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
