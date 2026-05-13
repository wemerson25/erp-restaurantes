"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Users, Clock, CheckCircle, XCircle, Loader2,
  Phone, Mail, CreditCard, MessageSquare, Briefcase, Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

interface Vaga {
  id: string; titulo: string; tipoContrato: string; status: string;
  restaurante: { nome: string };
}
interface Candidatura {
  id: string; nome: string; email: string; telefone: string;
  cpf: string; observacoes?: string; status: string; createdAt: string;
}

const STATUS_OPTIONS = [
  { value: "PENDENTE",    label: "Pendente",    variant: "warning" },
  { value: "APROVADO",    label: "Aprovado",    variant: "success" },
  { value: "REPROVADO",   label: "Reprovado",   variant: "destructive" },
  { value: "CONTRATADO",  label: "Contratado",  variant: "default" },
];

function formatCpf(cpf: string) {
  return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function formatPhone(tel: string) {
  const d = tel.replace(/\D/g, "");
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return tel;
}

export function CandidaturasContent({ vagaId }: { vagaId: string }) {
  const router = useRouter();
  const [vaga, setVaga] = useState<Vaga | null>(null);
  const [candidaturas, setCandidaturas] = useState<Candidatura[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/vagas/${vagaId}/candidaturas`);
    if (res.ok) {
      const data = await res.json();
      setVaga(data.vaga);
      setCandidaturas(data.candidaturas);
    }
    setLoading(false);
  }, [vagaId]);

  useEffect(() => { load(); }, [load]);

  async function updateStatus(id: string, status: string) {
    setUpdatingId(id);
    await fetch(`/api/candidaturas/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setCandidaturas(prev => prev.map(c => c.id === id ? { ...c, status } : c));
    setUpdatingId(null);
  }

  async function deleteCandidatura(id: string) {
    if (!confirm("Remover esta candidatura?")) return;
    await fetch(`/api/candidaturas/${id}`, { method: "DELETE" });
    setCandidaturas(prev => prev.filter(c => c.id !== id));
  }

  const filtered = filterStatus ? candidaturas.filter(c => c.status === filterStatus) : candidaturas;

  const counts = {
    total:      candidaturas.length,
    pendente:   candidaturas.filter(c => c.status === "PENDENTE").length,
    aprovado:   candidaturas.filter(c => c.status === "APROVADO").length,
    contratado: candidaturas.filter(c => c.status === "CONTRATADO").length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={28} className="animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Back + vaga info */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => router.push("/vagas")}
          className="mt-1 p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 className="text-xl font-bold text-gray-900">{vaga?.titulo}</h2>
          <p className="text-sm text-gray-500">
            {vaga?.restaurante.nome} · {vaga?.tipoContrato}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total", value: counts.total,      icon: Users,       color: "blue" },
          { label: "Pendentes", value: counts.pendente,  icon: Clock,       color: "amber" },
          { label: "Aprovados", value: counts.aprovado,  icon: CheckCircle, color: "green" },
          { label: "Contratados", value: counts.contratado, icon: Briefcase, color: "orange" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center bg-${color}-100`}>
              <Icon size={16} className={`text-${color}-600`} />
            </div>
            <div>
              <p className="text-xs text-gray-500">{label}</p>
              <p className={`text-xl font-bold text-${color}-600`}>{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter + count */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilterStatus("")}
            className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${filterStatus === "" ? "bg-gray-800 text-white" : "bg-white border text-gray-600 hover:bg-gray-50"}`}
          >
            Todos ({candidaturas.length})
          </button>
          {STATUS_OPTIONS.map(s => {
            const count = candidaturas.filter(c => c.status === s.value).length;
            if (count === 0) return null;
            return (
              <button
                key={s.value}
                onClick={() => setFilterStatus(s.value)}
                className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${filterStatus === s.value ? "bg-gray-800 text-white" : "bg-white border text-gray-600 hover:bg-gray-50"}`}
              >
                {s.label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Candidaturas list */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border p-12 text-center text-gray-400">
          <Users size={32} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">Nenhuma candidatura encontrada</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(c => {
            const statusOpt = STATUS_OPTIONS.find(s => s.value === c.status);
            return (
              <div key={c.id} className="bg-white rounded-xl border p-5 space-y-4">
                {/* Top row: name + status selector */}
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <h3 className="text-base font-bold text-gray-900">{c.nome}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">{formatDate(c.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {updatingId === c.id ? (
                      <Loader2 size={16} className="animate-spin text-gray-400" />
                    ) : (
                      <select
                        value={c.status}
                        onChange={e => updateStatus(c.id, e.target.value)}
                        className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                      >
                        {STATUS_OPTIONS.map(s => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    )}
                    <Badge variant={statusOpt?.variant as never ?? "default"}>
                      {statusOpt?.label ?? c.status}
                    </Badge>
                    <button
                      onClick={() => deleteCandidatura(c.id)}
                      className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Contact info */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                  <a
                    href={`mailto:${c.email}`}
                    className="flex items-center gap-2 text-gray-600 hover:text-orange-600 transition-colors"
                  >
                    <Mail size={14} className="text-gray-400 shrink-0" />
                    <span className="truncate">{c.email}</span>
                  </a>
                  <a
                    href={`https://wa.me/55${c.telefone.replace(/\D/g,"")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 text-gray-600 hover:text-green-600 transition-colors"
                  >
                    <Phone size={14} className="text-gray-400 shrink-0" />
                    {formatPhone(c.telefone)}
                  </a>
                  <div className="flex items-center gap-2 text-gray-600">
                    <CreditCard size={14} className="text-gray-400 shrink-0" />
                    {formatCpf(c.cpf)}
                  </div>
                </div>

                {/* Observações */}
                {c.observacoes && (
                  <div className="flex gap-2 bg-gray-50 rounded-lg px-4 py-3">
                    <MessageSquare size={14} className="text-gray-400 mt-0.5 shrink-0" />
                    <p className="text-sm text-gray-600 leading-relaxed">{c.observacoes}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
