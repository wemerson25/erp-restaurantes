"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, Search, Filter, Eye, Edit2, UserX, Loader2 } from "lucide-react";
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
  ATIVO: "Ativo",
  FERIAS: "Férias",
  AFASTADO: "Afastado",
  DEMITIDO: "Demitido",
};

const turnoLabel: Record<string, string> = {
  MANHA: "Manhã",
  TARDE: "Tarde",
  NOITE: "Noite",
  MISTO: "Misto",
};

export function FuncionariosContent() {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Funcionario | null>(null);

  const fetchFuncionarios = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (filterStatus) params.set("status", filterStatus);
    const res = await fetch(`/api/funcionarios?${params}`);
    const data = await res.json();
    setFuncionarios(data);
    setLoading(false);
  }, [search, filterStatus]);

  useEffect(() => {
    fetchFuncionarios();
  }, [fetchFuncionarios]);

  async function handleDemitir(id: string, nome: string) {
    if (!confirm(`Confirmar demissão de ${nome}?`)) return;
    await fetch(`/api/funcionarios/${id}`, { method: "DELETE" });
    fetchFuncionarios();
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-1 gap-2 max-w-xl">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Buscar por nome..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="w-36">
            <option value="">Todos</option>
            <option value="ATIVO">Ativos</option>
            <option value="FERIAS">Férias</option>
            <option value="AFASTADO">Afastados</option>
            <option value="DEMITIDO">Demitidos</option>
          </Select>
        </div>
        <Button onClick={() => { setEditTarget(null); setModalOpen(true); }}>
          <Plus size={16} /> Novo Funcionário
        </Button>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 size={24} className="animate-spin text-orange-500" />
          </div>
        ) : funcionarios.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <p className="font-medium">Nenhum funcionário encontrado</p>
            <p className="text-sm">Cadastre o primeiro funcionário clicando em &quot;Novo Funcionário&quot;</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Matricula / Nome</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Cargo</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Restaurante</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Turno</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Admissão</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Salário</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Status</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {funcionarios.map((f) => (
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
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant[f.status] ?? "secondary"}>
                        {statusLabel[f.status] ?? f.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/funcionarios/${f.id}`}>
                          <Button size="icon" variant="ghost" title="Ver detalhes">
                            <Eye size={15} />
                          </Button>
                        </Link>
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Editar"
                          onClick={() => { setEditTarget(f); setModalOpen(true); }}
                        >
                          <Edit2 size={15} />
                        </Button>
                        {f.status !== "DEMITIDO" && (
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Demitir"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDemitir(f.id, f.nome)}
                          >
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
        )}
        {!loading && funcionarios.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-500">
            {funcionarios.length} registro(s) encontrado(s)
          </div>
        )}
      </Card>

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
    </div>
  );
}
