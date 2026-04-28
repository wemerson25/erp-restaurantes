"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, User, MapPin, Briefcase, Clock, Umbrella, DollarSign, AlertTriangle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatCurrency, formatCPF } from "@/lib/utils";

interface FuncionarioData {
  id: string;
  matricula: string;
  nome: string;
  cpf: string;
  rg?: string;
  dataNascimento: string;
  sexo: string;
  estadoCivil: string;
  email?: string;
  telefone: string;
  endereco: string;
  cidade: string;
  estado: string;
  cep: string;
  dataAdmissao: string;
  dataDemissao?: string;
  salario: number;
  tipoContrato: string;
  status: string;
  turno: string;
  ctps?: string;
  pisPassep?: string;
  observacoes?: string;
  cargo: { nome: string; departamento: string };
  restaurante: { nome: string; cidade: string };
  registrosPonto: Array<{ id: string; data: string; entrada?: string; saida?: string; horasTrabalhadas?: number; horasExtras?: number; ocorrencia?: string }>;
  ferias: Array<{ id: string; dataInicio: string; dataFim: string; diasCorridos: number; status: string }>;
  folhas: Array<{ id: string; competencia: string; salarioBruto: number; salarioLiquido: number; status: string }>;
  advertencias: Array<{ id: string; tipo: string; motivo: string; data: string }>;
}

const statusMap: Record<string, { label: string; variant: "success" | "warning" | "destructive" | "secondary" | "blue" }> = {
  ATIVO: { label: "Ativo", variant: "success" },
  FERIAS: { label: "Férias", variant: "blue" },
  AFASTADO: { label: "Afastado", variant: "warning" },
  DEMITIDO: { label: "Demitido", variant: "destructive" },
};

export function FuncionarioDetalhe({ id }: { id: string }) {
  const [data, setData] = useState<FuncionarioData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/funcionarios/${id}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-orange-500" />
      </div>
    );
  }

  if (!data) return <p className="text-gray-500">Funcionário não encontrado.</p>;

  const st = statusMap[data.status] ?? { label: data.status, variant: "secondary" as const };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/funcionarios">
          <Button variant="outline" size="sm"><ArrowLeft size={14} /> Voltar</Button>
        </Link>
      </div>

      {/* Header card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-5">
            <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center flex-shrink-0">
              <User size={28} className="text-orange-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{data.nome}</h2>
                  <p className="text-gray-500">{data.cargo.nome} · {data.restaurante.nome}</p>
                  <p className="text-sm text-gray-400 mt-0.5">Matrícula: {data.matricula}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={st.variant as never}>{st.label}</Badge>
                  <Badge variant="outline">{data.tipoContrato}</Badge>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5">
                {[
                  { label: "CPF", value: formatCPF(data.cpf) },
                  { label: "Admissão", value: formatDate(data.dataAdmissao) },
                  { label: "Salário", value: formatCurrency(data.salario) },
                  { label: "Turno", value: { MANHA: "Manhã", TARDE: "Tarde", NOITE: "Noite", MISTO: "Misto" }[data.turno] ?? data.turno },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-xs text-gray-400">{label}</p>
                    <p className="font-semibold text-gray-800">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Dados pessoais */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><User size={16} /> Dados Pessoais</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {[
              ["Data de Nascimento", formatDate(data.dataNascimento)],
              ["Sexo", { M: "Masculino", F: "Feminino", O: "Outro" }[data.sexo] ?? data.sexo],
              ["Estado Civil", data.estadoCivil],
              ["E-mail", data.email || "—"],
              ["Telefone", data.telefone],
              ["RG", data.rg || "—"],
              ["CTPS", data.ctps || "—"],
              ["PIS/PASEP", data.pisPassep || "—"],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between py-1 border-b border-gray-50 last:border-0">
                <span className="text-gray-500">{label}</span>
                <span className="font-medium text-gray-800">{value}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Endereço */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><MapPin size={16} /> Endereço</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {[
              ["Logradouro", data.endereco],
              ["Cidade", data.cidade],
              ["Estado", data.estado],
              ["CEP", data.cep],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between py-1 border-b border-gray-50 last:border-0">
                <span className="text-gray-500">{label}</span>
                <span className="font-medium text-gray-800">{value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Registros de ponto recentes */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Clock size={16} /> Registros de Ponto Recentes</CardTitle></CardHeader>
        <CardContent>
          {data.registrosPonto.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhum registro de ponto.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="py-2 text-left text-xs font-semibold text-gray-500">Data</th>
                    <th className="py-2 text-left text-xs font-semibold text-gray-500">Entrada</th>
                    <th className="py-2 text-left text-xs font-semibold text-gray-500">Saída</th>
                    <th className="py-2 text-left text-xs font-semibold text-gray-500">H. Trabalhadas</th>
                    <th className="py-2 text-left text-xs font-semibold text-gray-500">H. Extras</th>
                    <th className="py-2 text-left text-xs font-semibold text-gray-500">Ocorrência</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.registrosPonto.slice(0, 10).map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="py-2 text-gray-700">{formatDate(r.data)}</td>
                      <td className="py-2 text-gray-600">{r.entrada ? new Date(r.entrada).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                      <td className="py-2 text-gray-600">{r.saida ? new Date(r.saida).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                      <td className="py-2 text-gray-700">{r.horasTrabalhadas ? `${r.horasTrabalhadas}h` : "—"}</td>
                      <td className="py-2">{r.horasExtras ? <span className="text-orange-600 font-medium">{r.horasExtras}h</span> : "—"}</td>
                      <td className="py-2"><Badge variant={r.ocorrencia === "NORMAL" ? "success" : "warning"} className="text-xs">{r.ocorrencia ?? "—"}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Férias */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Umbrella size={16} /> Histórico de Férias</CardTitle></CardHeader>
          <CardContent>
            {data.ferias.length === 0 ? (
              <p className="text-sm text-gray-400">Nenhum registro de férias.</p>
            ) : (
              <div className="space-y-2">
                {data.ferias.map((f) => (
                  <div key={f.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{formatDate(f.dataInicio)} → {formatDate(f.dataFim)}</p>
                      <p className="text-xs text-gray-400">{f.diasCorridos} dias corridos</p>
                    </div>
                    <Badge variant={f.status === "CONCLUIDA" ? "success" : f.status === "AGENDADA" ? "blue" as never : "secondary"}>{f.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Advertências */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2 text-red-600"><AlertTriangle size={16} /> Advertências</CardTitle></CardHeader>
          <CardContent>
            {data.advertencias.length === 0 ? (
              <p className="text-sm text-gray-400">Nenhuma advertência registrada.</p>
            ) : (
              <div className="space-y-2">
                {data.advertencias.map((a) => (
                  <div key={a.id} className="py-2 border-b border-gray-50 last:border-0">
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant="destructive">{a.tipo}</Badge>
                      <span className="text-xs text-gray-400">{formatDate(a.data)}</span>
                    </div>
                    <p className="text-sm text-gray-700">{a.motivo}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Folhas */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><DollarSign size={16} /> Folhas de Pagamento</CardTitle></CardHeader>
        <CardContent>
          {data.folhas.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhuma folha gerada.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="py-2 text-left text-xs font-semibold text-gray-500">Competência</th>
                    <th className="py-2 text-left text-xs font-semibold text-gray-500">Bruto</th>
                    <th className="py-2 text-left text-xs font-semibold text-gray-500">Líquido</th>
                    <th className="py-2 text-left text-xs font-semibold text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.folhas.map((f) => (
                    <tr key={f.id} className="hover:bg-gray-50">
                      <td className="py-2 font-medium text-gray-800">{f.competencia}</td>
                      <td className="py-2 text-gray-600">{formatCurrency(f.salarioBruto)}</td>
                      <td className="py-2 font-semibold text-gray-900">{formatCurrency(f.salarioLiquido)}</td>
                      <td className="py-2"><Badge variant={f.status === "PAGA" ? "success" : f.status === "APROVADA" ? "blue" as never : "secondary"}>{f.status}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {data.observacoes && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Briefcase size={16} /> Observações</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-gray-700">{data.observacoes}</p></CardContent>
        </Card>
      )}
    </div>
  );
}
