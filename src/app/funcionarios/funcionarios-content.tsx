"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { Plus, Search, Eye, Edit2, UserX, Loader2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Card } from "@/components/ui/card";
import { FuncionarioForm } from "./funcionario-form";
import { formatDate, formatCurrency, formatCPF } from "@/lib/utils";

interface Funcionario {
  id: string;
  matricula: string;
  nome: string;
  cpf: string;
  telefone: string;
  dataAdmissao: string;
  dataDemissao?: string;
  tipoDemissao?: string;
  salario: number;
  status: string;
  turno: string;
  tipoContrato: string;
  cargo: { nome: string; departamento: string };
  restaurante: { nome: string };
}

const statusVariant: Record<string, "success" | "warning" | "destructive" | "secondary"> = {
  ATIVO: "success",
  FERIAS: "blue" as never,
  AFASTADO: "warning",
  DEMITIDO: "destructive",
};

const statusLabel: Record<string, string> = {
  ATIVO: "Ativo", FERIAS: "Férias", AFASTADO: "Afastado", DEMITIDO: "Demitido",
};

const turnoLabel: Record<string, string> = {
  MANHA: "Manhã", TARDE: "Tarde", NOITE: "Noite", MISTO: "Misto",
};

const TIPO_DEMISSAO_OPTIONS = [
  { value: "SEM_JUSTA_CAUSA", label: "Sem Justa Causa" },
  { value: "JUSTA_CAUSA",     label: "Justa Causa" },
  { value: "ACORDO",          label: "Acordo" },
  { value: "PEDIU_DEMISSAO",  label: "Pediu Demissão" },
];

const tipoLabel: Record<string, string> = {
  SEM_JUSTA_CAUSA: "Sem Justa Causa",
  JUSTA_CAUSA:     "Justa Causa",
  ACORDO:          "Acordo",
  PEDIU_DEMISSAO:  "Pediu Demissão",
};

const tipoVariant: Record<string, string> = {
  SEM_JUSTA_CAUSA: "warning",
  JUSTA_CAUSA:     "destructive",
  ACORDO:          "secondary",
  PEDIU_DEMISSAO:  "default",
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function FuncionariosContent() {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"ativos" | "inativos">("ativos");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterRestaurante, setFilterRestaurante] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Funcionario | null>(null);

  // Demissão modal
  const [demitirTarget, setDemitirTarget] = useState<Funcionario | null>(null);
  const [demitirMode, setDemitirMode] = useState<"demitir" | "editar">("demitir");
  const [demitirForm, setDemitirForm] = useState({ dataDemissao: todayISO(), tipoDemissao: "SEM_JUSTA_CAUSA" });
  const [demitirSaving, setDemitirSaving] = useState(false);

  const fetchFuncionarios = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    const res = await fetch(`/api/funcionarios?${params}`);
    setFuncionarios(await res.json());
    setLoading(false);
  }, [search]);

  useEffect(() => { fetchFuncionarios(); }, [fetchFuncionarios]);

  const restaurantesList = useMemo(() => {
    const names = new Set(funcionarios.map((f) => f.restaurante.nome));
    return Array.from(names).sort();
  }, [funcionarios]);

  const displayedFuncionarios = useMemo(() => {
    return funcionarios.filter((f) => {
      if (tab === "inativos") {
        if (f.status !== "DEMITIDO") return false;
      } else {
        if (f.status === "DEMITIDO") return false;
        if (filterStatus && f.status !== filterStatus) return false;
      }
      if (filterRestaurante && f.restaurante.nome !== filterRestaurante) return false;
      return true;
    });
  }, [funcionarios, tab, filterStatus, filterRestaurante]);

  function openDemitir(f: Funcionario) {
    setDemitirTarget(f);
    setDemitirMode("demitir");
    setDemitirForm({ dataDemissao: todayISO(), tipoDemissao: "SEM_JUSTA_CAUSA" });
  }

  function openEditarDemissao(f: Funcionario) {
    setDemitirTarget(f);
    setDemitirMode("editar");
    setDemitirForm({
      dataDemissao: f.dataDemissao ? f.dataDemissao.slice(0, 10) : todayISO(),
      tipoDemissao: f.tipoDemissao ?? "SEM_JUSTA_CAUSA",
    });
  }

  async function handleConfirmDemissao() {
    if (!demitirTarget) return;
    setDemitirSaving(true);
    const payload =
      demitirMode === "demitir"
        ? { status: "DEMITIDO", dataDemissao: demitirForm.dataDemissao, tipoDemissao: demitirForm.tipoDemissao }
        : { dataDemissao: demitirForm.dataDemissao, tipoDemissao: demitirForm.tipoDemissao };
    await fetch(`/api/funcionarios/${demitirTarget.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setDemitirTarget(null);
    setDemitirSaving(false);
    fetchFuncionarios();
  }

  return (
    <div className="space-y-4">
      {/* Tabs + New button */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {(["ativos", "inativos"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setFilterStatus(""); }}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                tab === t ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t === "ativos" ? "Ativos" : "Inativos"}
            </button>
          ))}
        </div>
        <Button onClick={() => { setEditTarget(null); setModalOpen(true); }}>
          <Plus size={16} /> Novo Funcionário
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Buscar por nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {tab === "ativos" && (
          <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-40">
            <option value="">Todos os status</option>
            <option value="ATIVO">Ativo</option>
            <option value="FERIAS">Férias</option>
            <option value="AFASTADO">Afastado</option>
          </Select>
        )}
        <Select value={filterRestaurante} onChange={(e) => setFilterRestaurante(e.target.value)} className="w-48">
          <option value="">Todos os restaurantes</option>
          {restaurantesList.map((r) => <option key={r} value={r}>{r}</option>)}
        </Select>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 size={24} className="animate-spin text-orange-500" />
          </div>
        ) : displayedFuncionarios.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <p className="font-medium">Nenhum funcionário encontrado</p>
            {tab === "ativos" && (
              <p className="text-sm">Cadastre o primeiro funcionário clicando em &quot;Novo Funcionário&quot;</p>
            )}
          </div>
        ) : (
          <>
            {/* Mobile: cards */}
            <div className="sm:hidden divide-y divide-gray-100">
              {displayedFuncionarios.map((f) => (
                <div key={f.id} className="p-4 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 text-sm">{f.nome}</p>
                      <Badge variant={statusVariant[f.status] ?? "secondary"}>
                        {statusLabel[f.status] ?? f.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{f.matricula} · {f.cargo.nome}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{f.restaurante.nome} · {turnoLabel[f.turno] ?? f.turno}</p>
                    <p className="text-xs font-medium text-gray-700 mt-1">{formatCurrency(f.salario)}</p>
                    {f.status === "DEMITIDO" && (
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {f.dataDemissao && <p className="text-xs text-red-500">Demitido em {formatDate(f.dataDemissao)}</p>}
                        {f.tipoDemissao && (
                          <Badge variant={tipoVariant[f.tipoDemissao] as never ?? "secondary"}>
                            {tipoLabel[f.tipoDemissao] ?? f.tipoDemissao}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Link href={`/funcionarios/${f.id}`}>
                      <Button size="icon" variant="ghost"><Eye size={15} /></Button>
                    </Link>
                    <Button size="icon" variant="ghost" onClick={() => { setEditTarget(f); setModalOpen(true); }}>
                      <Edit2 size={15} />
                    </Button>
                    {f.status === "DEMITIDO" ? (
                      <Button size="icon" variant="ghost" title="Editar demissão" className="text-orange-500 hover:text-orange-700 hover:bg-orange-50" onClick={() => openEditarDemissao(f)}>
                        <Pencil size={15} />
                      </Button>
                    ) : (
                      <Button size="icon" variant="ghost" title="Demitir" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => openDemitir(f)}>
                        <UserX size={15} />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop: table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Matricula / Nome</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Cargo</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Restaurante</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Turno</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Admissão</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Salário</th>
                    {tab === "inativos" ? (
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">Demissão</th>
                    ) : (
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">Status</th>
                    )}
                    <th className="px-4 py-3 text-right font-semibold text-gray-600">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {displayedFuncionarios.map((f) => (
                    <tr key={f.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-semibold text-gray-900">{f.nome}</p>
                          <p className="text-xs text-gray-400">{f.matricula} · {formatCPF(f.cpf)}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-gray-700">{f.cargo.nome}</p>
                          <p className="text-xs text-gray-400">{f.cargo.departamento}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{f.restaurante.nome}</td>
                      <td className="px-4 py-3 text-gray-600">{turnoLabel[f.turno] ?? f.turno}</td>
                      <td className="px-4 py-3 text-gray-600">{formatDate(f.dataAdmissao)}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{formatCurrency(f.salario)}</td>
                      {tab === "inativos" ? (
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            {f.dataDemissao && (
                              <p className="text-sm text-red-600 font-medium">{formatDate(f.dataDemissao)}</p>
                            )}
                            {f.tipoDemissao ? (
                              <Badge variant={tipoVariant[f.tipoDemissao] as never ?? "secondary"}>
                                {tipoLabel[f.tipoDemissao] ?? f.tipoDemissao}
                              </Badge>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </div>
                        </td>
                      ) : (
                        <td className="px-4 py-3">
                          <Badge variant={statusVariant[f.status] ?? "secondary"}>
                            {statusLabel[f.status] ?? f.status}
                          </Badge>
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/funcionarios/${f.id}`}>
                            <Button size="icon" variant="ghost" title="Ver detalhes"><Eye size={15} /></Button>
                          </Link>
                          <Button size="icon" variant="ghost" title="Editar" onClick={() => { setEditTarget(f); setModalOpen(true); }}>
                            <Edit2 size={15} />
                          </Button>
                          {f.status === "DEMITIDO" ? (
                            <Button size="icon" variant="ghost" title="Editar demissão" className="text-orange-500 hover:text-orange-700 hover:bg-orange-50" onClick={() => openEditarDemissao(f)}>
                              <Pencil size={15} />
                            </Button>
                          ) : (
                            <Button size="icon" variant="ghost" title="Demitir" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => openDemitir(f)}>
                              <UserX size={15} />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {!loading && displayedFuncionarios.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-500">
            {displayedFuncionarios.length} registro(s) encontrado(s)
          </div>
        )}
      </Card>

      {/* Funcionário create/edit modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editTarget ? "Editar Funcionário" : "Novo Funcionário"}
        size="xl"
      >
        <FuncionarioForm
          funcionario={editTarget}
          onSuccess={() => { setModalOpen(false); fetchFuncionarios(); }}
          onCancel={() => setModalOpen(false)}
        />
      </Modal>

      {/* Demissão modal */}
      <Modal
        open={!!demitirTarget}
        onClose={() => setDemitirTarget(null)}
        title={demitirMode === "demitir" ? "Registrar Demissão" : "Editar Demissão"}
        size="sm"
      >
        <div className="p-6 space-y-4">
          {demitirMode === "demitir" && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <p className="text-sm text-red-700 font-medium">
                Demitir: <span className="font-bold">{demitirTarget?.nome}</span>
              </p>
              <p className="text-xs text-red-500 mt-0.5">Esta ação moverá o colaborador para inativos.</p>
            </div>
          )}
          {demitirMode === "editar" && (
            <p className="text-sm text-gray-600">
              Editando demissão de <span className="font-bold text-gray-900">{demitirTarget?.nome}</span>
            </p>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Data da Demissão *</label>
            <input
              type="date"
              value={demitirForm.dataDemissao}
              onChange={(e) => setDemitirForm(p => ({ ...p, dataDemissao: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Formato da Demissão *</label>
            <Select
              value={demitirForm.tipoDemissao}
              onChange={(e) => setDemitirForm(p => ({ ...p, tipoDemissao: e.target.value }))}
            >
              {TIPO_DEMISSAO_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button variant="outline" onClick={() => setDemitirTarget(null)}>Cancelar</Button>
            <Button
              disabled={demitirSaving || !demitirForm.dataDemissao}
              onClick={handleConfirmDemissao}
              className={demitirMode === "demitir" ? "bg-red-600 hover:bg-red-700" : ""}
            >
              {demitirSaving && <Loader2 size={14} className="animate-spin" />}
              {demitirMode === "demitir" ? "Confirmar Demissão" : "Salvar"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
