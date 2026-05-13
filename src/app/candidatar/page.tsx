"use client";
import { useEffect, useState, useCallback } from "react";
import { Briefcase, MapPin, DollarSign, Clock, ChevronDown, ChevronUp, CheckCircle, Loader2 } from "lucide-react";

interface Vaga {
  id: string;
  titulo: string;
  descricao: string;
  requisitos: string;
  salario?: number;
  tipoContrato: string;
  createdAt: string;
  restaurante: { nome: string };
}

const tipoLabel: Record<string, string> = {
  CLT: "CLT", PJ: "PJ", TEMPORARIO: "Temporário", ESTAGIO: "Estágio",
};

function formatCurrency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function CandidatarPage() {
  const [vagas, setVagas] = useState<Vaga[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedVaga, setSelectedVaga] = useState<string>("");
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [erro, setErro] = useState("");
  const [form, setForm] = useState({ nome: "", email: "", telefone: "", cpf: "", observacoes: "" });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const vagaParam = params.get("vaga");
    if (vagaParam) setSelectedVaga(vagaParam);
  }, []);

  const fetchVagas = useCallback(async () => {
    const res = await fetch("/api/public/vagas");
    const data = await res.json();
    setVagas(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchVagas(); }, [fetchVagas]);

  function formatCpf(v: string) {
    return v.replace(/\D/g, "").slice(0, 11)
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  }

  function formatPhone(v: string) {
    return v.replace(/\D/g, "").slice(0, 11)
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{5})(\d{1,4})$/, "$1-$2");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    if (!selectedVaga) { setErro("Selecione uma vaga"); return; }
    setSending(true);
    try {
      const res = await fetch("/api/public/candidaturas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, vagaId: selectedVaga }),
      });
      const data = await res.json();
      if (!res.ok) { setErro(data.error ?? "Erro ao enviar"); return; }
      setSubmitted(true);
    } catch { setErro("Erro de conexão. Tente novamente."); }
    finally { setSending(false); }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle size={40} className="text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Candidatura Enviada!</h2>
          <p className="text-gray-500 mb-6">Recebemos sua candidatura. Entraremos em contato em breve.</p>
          <button
            onClick={() => { setSubmitted(false); setForm({ nome: "", email: "", telefone: "", cpf: "", observacoes: "" }); }}
            className="text-orange-600 font-medium hover:underline"
          >
            Candidatar-se a outra vaga
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-5 flex items-center gap-4">
          <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
            <Briefcase size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Trabalhe Conosco</h1>
            <p className="text-sm text-gray-500">Grupo Ykedin — Vagas disponíveis</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Vagas */}
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Vagas Abertas</h2>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 size={28} className="animate-spin text-orange-500" />
            </div>
          ) : vagas.length === 0 ? (
            <div className="bg-white rounded-xl border p-8 text-center text-gray-400">
              <Briefcase size={32} className="mx-auto mb-3 opacity-40" />
              <p>Nenhuma vaga disponível no momento.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {vagas.map((v) => (
                <div
                  key={v.id}
                  className={`bg-white rounded-xl border-2 transition-all ${selectedVaga === v.id ? "border-orange-400 shadow-md" : "border-transparent shadow-sm hover:shadow-md"}`}
                >
                  <button
                    className="w-full text-left p-5"
                    onClick={() => setExpandedId(expandedId === v.id ? null : v.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900">{v.titulo}</h3>
                        <div className="flex flex-wrap gap-3 mt-1 text-sm text-gray-500">
                          <span className="flex items-center gap-1"><MapPin size={13} />{v.restaurante.nome}</span>
                          <span className="flex items-center gap-1"><Clock size={13} />{tipoLabel[v.tipoContrato] ?? v.tipoContrato}</span>
                          {v.salario && <span className="flex items-center gap-1"><DollarSign size={13} />{formatCurrency(v.salario)}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedVaga(v.id); document.getElementById("form-candidatura")?.scrollIntoView({ behavior: "smooth" }); }}
                          className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${selectedVaga === v.id ? "bg-orange-500 text-white" : "bg-orange-100 text-orange-700 hover:bg-orange-200"}`}
                        >
                          {selectedVaga === v.id ? "Selecionada" : "Candidatar-se"}
                        </button>
                        {expandedId === v.id ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                      </div>
                    </div>
                  </button>

                  {expandedId === v.id && (
                    <div className="px-5 pb-5 space-y-3 border-t border-gray-100 pt-4">
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Descrição</p>
                        <p className="text-sm text-gray-700 whitespace-pre-line">{v.descricao}</p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Requisitos</p>
                        <p className="text-sm text-gray-700 whitespace-pre-line">{v.requisitos}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Formulário */}
        <div id="form-candidatura" className="bg-white rounded-2xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-1">Enviar Candidatura</h2>
          <p className="text-sm text-gray-500 mb-6">Preencha seus dados e selecione a vaga desejada.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Seleção de vaga */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vaga *</label>
              <select
                value={selectedVaga}
                onChange={(e) => setSelectedVaga(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              >
                <option value="">Selecione uma vaga...</option>
                {vagas.map((v) => (
                  <option key={v.id} value={v.id}>{v.titulo} — {v.restaurante.nome}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome completo *</label>
                <input
                  type="text"
                  value={form.nome}
                  onChange={(e) => setForm(p => ({ ...p, nome: e.target.value }))}
                  required
                  placeholder="Seu nome"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-mail *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))}
                  required
                  placeholder="seu@email.com"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefone / WhatsApp *</label>
                <input
                  type="tel"
                  value={form.telefone}
                  onChange={(e) => setForm(p => ({ ...p, telefone: formatPhone(e.target.value) }))}
                  required
                  placeholder="(74) 99999-9999"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CPF *</label>
                <input
                  type="text"
                  value={form.cpf}
                  onChange={(e) => setForm(p => ({ ...p, cpf: formatCpf(e.target.value) }))}
                  required
                  placeholder="000.000.000-00"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mensagem / Apresentação</label>
              <textarea
                value={form.observacoes}
                onChange={(e) => setForm(p => ({ ...p, observacoes: e.target.value }))}
                rows={3}
                placeholder="Fale um pouco sobre você, experiências, disponibilidade..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
              />
            </div>

            {erro && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{erro}</div>
            )}

            <button
              type="submit"
              disabled={sending}
              className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {sending && <Loader2 size={16} className="animate-spin" />}
              {sending ? "Enviando..." : "Enviar Candidatura"}
            </button>
          </form>
        </div>
      </div>

      <div className="text-center py-8 text-xs text-gray-400">
        Grupo Ykedin · Sistema de Recrutamento
      </div>
    </div>
  );
}
