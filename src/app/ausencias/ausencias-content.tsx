"use client";
import { useEffect, useState } from "react";
import { Plus, Search, FileText, X, Pencil, Trash2, CheckCircle, Clock, XCircle, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { AusenciaForm } from "./ausencia-form";

interface Ausencia {
  id: string;
  tipo: string;
  dataInicio: string;
  dataFim: string;
  diasAfastamento: number;
  motivo: string | null;
  descricao: string | null;
  status: string;
  observacoes: string | null;
  funcionario: {
    nome: string;
    matricula: string;
    cargo: { nome: string };
    restaurante: { nome: string };
  };
}

const TIPOS: Record<string, { label: string; color: string }> = {
  ATESTADO_MEDICO:       { label: "Atestado Médico",        color: "bg-blue-100 text-blue-700" },
  ATESTADO_ACOMPANHANTE: { label: "Atestado Acompanhante",  color: "bg-purple-100 text-purple-700" },
  LICENCA_MEDICA:        { label: "Licença Médica",         color: "bg-indigo-100 text-indigo-700" },
  LICENCA_MATERNIDADE:   { label: "Licença Maternidade",    color: "bg-pink-100 text-pink-700" },
  LICENCA_PATERNIDADE:   { label: "Licença Paternidade",    color: "bg-cyan-100 text-cyan-700" },
  FALTA_JUSTIFICADA:     { label: "Falta Justificada",      color: "bg-yellow-100 text-yellow-700" },
  FALTA_INJUSTIFICADA:   { label: "Falta Injustificada",    color: "bg-red-100 text-red-700" },
  OUTROS:                { label: "Outros",                 color: "bg-gray-100 text-gray-700" },
};

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  PENDENTE:  { label: "Pendente",  icon: Clock,         color: "text-yellow-600 bg-yellow-50 border-yellow-200" },
  APROVADO:  { label: "Aprovado",  icon: CheckCircle,   color: "text-green-600 bg-green-50 border-green-200" },
  REPROVADO: { label: "Reprovado", icon: XCircle,       color: "text-red-600 bg-red-50 border-red-200" },
};

function fmt(d: string) {
  return new Date(d).toLocaleDateString("pt-BR");
}

export function AusenciasContent() {
  const [ausencias, setAusencias] = useState<Ausencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterTipo, setFilterTipo] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Ausencia | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterStatus) params.set("status", filterStatus);
    if (filterTipo) params.set("tipo", filterTipo);
    const res = await fetch(`/api/ausencias?${params}`);
    if (res.ok) setAusencias(await res.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, [filterStatus, filterTipo]);

  async function handleDelete(id: string) {
    if (!confirm("Excluir este registro?")) return;
    await fetch(`/api/ausencias/${id}`, { method: "DELETE" });
    load();
  }

  async function handleStatus(id: string, status: string) {
    await fetch(`/api/ausencias/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...ausencias.find(a => a.id === id), status }),
    });
    load();
  }

  const filtered = ausencias.filter(a =>
    a.funcionario.nome.toLowerCase().includes(search.toLowerCase()) ||
    a.funcionario.matricula.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: ausencias.length,
    pendentes: ausencias.filter(a => a.status === "PENDENTE").length,
    aprovados: ausencias.filter(a => a.status === "APROVADO").length,
    diasTotal: ausencias.filter(a => a.status === "APROVADO").reduce((s, a) => s + a.diasAfastamento, 0),
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total de Registros", value: stats.total, color: "text-gray-900" },
          { label: "Pendentes",          value: stats.pendentes, color: "text-yellow-600" },
          { label: "Aprovados",          value: stats.aprovados, color: "text-green-600" },
          { label: "Dias Aprovados",     value: stats.diasTotal, color: "text-blue-600" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className="text-xs text-gray-500 mb-1">{s.label}</p>
            <p className={cn("text-2xl font-bold", s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            className="pl-8"
            placeholder="Buscar funcionário..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterTipo} onChange={e => setFilterTipo(e.target.value)} className="sm:w-52">
          <option value="">Todos os tipos</option>
          {Object.entries(TIPOS).map(([v, { label }]) => (
            <option key={v} value={v}>{label}</option>
          ))}
        </Select>
        <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="sm:w-40">
          <option value="">Todos os status</option>
          <option value="PENDENTE">Pendente</option>
          <option value="APROVADO">Aprovado</option>
          <option value="REPROVADO">Reprovado</option>
        </Select>
        <Button onClick={() => { setEditing(null); setShowForm(true); }}>
          <Plus size={16} /> Registrar
        </Button>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <FileText size={40} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500">Nenhum registro encontrado</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map(a => {
              const tipo = TIPOS[a.tipo] ?? { label: a.tipo, color: "bg-gray-100 text-gray-700" };
              const statusCfg = STATUS_CONFIG[a.status] ?? STATUS_CONFIG.PENDENTE;
              const StatusIcon = statusCfg.icon;
              const expanded = expandedId === a.id;

              return (
                <div key={a.id} className="hover:bg-gray-50 transition-colors">
                  <div
                    className="px-5 py-4 flex items-center gap-4 cursor-pointer"
                    onClick={() => setExpandedId(expanded ? null : a.id)}
                  >
                    {/* Funcionário */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{a.funcionario.nome}</p>
                      <p className="text-xs text-gray-500">
                        {a.funcionario.matricula} · {a.funcionario.cargo.nome} · {a.funcionario.restaurante.nome}
                      </p>
                    </div>

                    {/* Tipo + datas (empilhado no mobile) */}
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={cn("inline-flex text-xs px-2 py-0.5 rounded-full font-medium", tipo.color)}>
                        {tipo.label}
                      </span>
                      <span className="text-xs text-gray-400 whitespace-nowrap">
                        {fmt(a.dataInicio)}{a.dataInicio !== a.dataFim ? ` → ${fmt(a.dataFim)}` : ""} · {a.diasAfastamento}d
                      </span>
                    </div>

                    {/* Status */}
                    <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border font-medium shrink-0", statusCfg.color)}>
                      <StatusIcon size={12} />
                      <span className="hidden sm:inline">{statusCfg.label}</span>
                    </span>

                    <ChevronDown size={14} className={cn("text-gray-400 transition-transform flex-shrink-0", expanded && "rotate-180")} />
                  </div>

                  {expanded && (
                    <div className="px-5 pb-4 bg-gray-50 border-t border-gray-100">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-3 text-sm">
                        <div>
                          <p className="text-xs text-gray-500 mb-0.5">Tipo</p>
                          <span className={cn("inline-flex text-xs px-2 py-1 rounded-full font-medium", tipo.color)}>{tipo.label}</span>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-0.5">Período</p>
                          <p className="text-gray-800">{fmt(a.dataInicio)} até {fmt(a.dataFim)} ({a.diasAfastamento} dias)</p>
                        </div>
                        {a.motivo && (
                          <div>
                            <p className="text-xs text-gray-500 mb-0.5">Motivo</p>
                            <p className="text-gray-800">{a.motivo}</p>
                          </div>
                        )}
                        {a.descricao && (
                          <div className="sm:col-span-2">
                            <p className="text-xs text-gray-500 mb-0.5">Descrição</p>
                            <p className="text-gray-800">{a.descricao}</p>
                          </div>
                        )}
                        {a.observacoes && (
                          <div className="sm:col-span-3">
                            <p className="text-xs text-gray-500 mb-0.5">Observações</p>
                            <p className="text-gray-800">{a.observacoes}</p>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 pt-3 border-t border-gray-200 flex-wrap">
                        {a.status === "PENDENTE" && (
                          <>
                            <Button
                              className="bg-green-600 hover:bg-green-700 text-white"
                              onClick={e => { e.stopPropagation(); handleStatus(a.id, "APROVADO"); }}
                            >
                              <CheckCircle size={14} /> Aprovar
                            </Button>
                            <Button
                              variant="outline"
                              className="text-red-600 border-red-200 hover:bg-red-50"
                              onClick={e => { e.stopPropagation(); handleStatus(a.id, "REPROVADO"); }}
                            >
                              <X size={14} /> Reprovar
                            </Button>
                          </>
                        )}
                        {a.status !== "PENDENTE" && (
                          <Button
                            variant="outline"
                            className="text-yellow-600 border-yellow-200 hover:bg-yellow-50"
                            onClick={e => { e.stopPropagation(); handleStatus(a.id, "PENDENTE"); }}
                          >
                            <Clock size={14} /> Reabrir
                          </Button>
                        )}
                        <div className="flex-1" />
                        <button
                          className="p-2.5 rounded-lg hover:bg-white text-gray-400 hover:text-orange-500 transition-colors"
                          onClick={e => { e.stopPropagation(); setEditing(a); setShowForm(true); }}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="p-2.5 rounded-lg hover:bg-white text-gray-400 hover:text-red-500 transition-colors"
                          onClick={e => { e.stopPropagation(); handleDelete(a.id); }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h2 className="font-semibold text-gray-900">
                {editing ? "Editar Registro" : "Registrar Ausência"}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-2 -mr-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>
            <AusenciaForm
              ausencia={editing}
              onSuccess={() => { setShowForm(false); load(); }}
              onCancel={() => setShowForm(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
