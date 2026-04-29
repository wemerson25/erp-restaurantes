"use client";
import { useEffect, useState } from "react";
import { Loader2, UserCircle2, Trash2, Download } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Funcionario { id: string; nome: string; matricula: string }

interface Registro {
  id: string;
  data: string;
  entrada?: string;
  saidaAlmoco?: string;
  retornoAlmoco?: string;
  saida?: string;
  horasTrabalhadas?: number;
  horasExtras?: number;
  ocorrencia?: string;
  justificativa?: string;
}

interface Ausencia {
  id: string;
  tipo: string;
  dataInicio: string;
  dataFim: string;
  diasAfastamento: number;
  motivo?: string;
  status: string;
}

interface Ferias {
  id: string;
  dataInicio: string;
  dataFim: string;
  diasCorridos: number;
  status: string;
}

interface ColabData {
  funcionario: { id: string; nome: string; matricula: string; cargo: { nome: string }; restaurante: { nome: string } };
  registros: Registro[];
  ausencias: Ausencia[];
  ferias: Ferias[];
}

const DAYS_PT = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"];

const ausenciaTipoLabel: Record<string, string> = {
  ATESTADO_MEDICO: "Atestado Médico",
  LICENCA_MATERNIDADE: "Lic. Maternidade",
  LICENCA_PATERNIDADE: "Lic. Paternidade",
  ACIDENTE_TRABALHO: "Acidente Trab.",
  LICENCA_MEDICA: "Licença Médica",
  DECLARACAO_COMPARECIMENTO: "Dec. Comparecimento",
  FALTA_JUSTIFICADA: "Falta Justificada",
  FALTA_NAO_JUSTIFICADA: "Falta Injustificada",
  OUTROS: "Outros",
};

function getDaysInMonth(month: string): string[] {
  const [year, mon] = month.split("-").map(Number);
  const total = new Date(year, mon, 0).getDate();
  const days: string[] = [];
  for (let d = 1; d <= total; d++) {
    days.push(`${year}-${String(mon).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  return days;
}

function dateStr(iso: string): string {
  return iso.slice(0, 10);
}

type DayKind =
  | { kind: "ponto"; registro: Registro }
  | { kind: "ferias"; ferias: Ferias }
  | { kind: "ausencia"; ausencia: Ausencia }
  | { kind: "vazio" };

function classifyDay(day: string, registros: Registro[], ausencias: Ausencia[], ferias: Ferias[]): DayKind {
  const reg = registros.find((r) => dateStr(r.data) === day);
  if (reg) return { kind: "ponto", registro: reg };

  const fer = ferias.find((f) => day >= dateStr(f.dataInicio) && day <= dateStr(f.dataFim));
  if (fer) return { kind: "ferias", ferias: fer };

  const aus = ausencias.find((a) => day >= dateStr(a.dataInicio) && day <= dateStr(a.dataFim));
  if (aus) return { kind: "ausencia", ausencia: aus };

  return { kind: "vazio" };
}

const pontoRowClass: Record<string, string> = {
  NORMAL: "",
  ATRASO: "bg-red-50",
  FALTA: "bg-red-100",
  SAIDA_ANTECIPADA: "bg-amber-50",
};

const pontoOcorrLabel: Record<string, string> = {
  NORMAL: "Normal",
  ATRASO: "Atraso",
  FALTA: "Falta",
  SAIDA_ANTECIPADA: "Saída Antec.",
};

const pontoVariant: Record<string, "success" | "destructive" | "warning" | "secondary"> = {
  NORMAL: "success",
  ATRASO: "destructive",
  FALTA: "destructive",
  SAIDA_ANTECIPADA: "warning",
};

interface Props {
  funcionarios: Funcionario[];
  filterMonth: string;
}

export function ColaboradorView({ funcionarios, filterMonth }: Props) {
  const [funcionarioId, setFuncionarioId] = useState("");
  const [data, setData] = useState<ColabData | null>(null);
  const [loading, setLoading] = useState(false);

  function refetch() {
    if (!funcionarioId) return;
    setLoading(true);
    fetch(`/api/ponto/colaborador?funcionarioId=${funcionarioId}&month=${filterMonth}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!funcionarioId) { setData(null); return; }
    refetch();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [funcionarioId, filterMonth]);

  async function handleDeleteRegistro(id: string) {
    if (!confirm("Excluir este registro de ponto?")) return;
    await fetch(`/api/ponto/${id}`, { method: "DELETE" });
    refetch();
  }

  const days = getDaysInMonth(filterMonth);

  const fmt = (iso?: string) =>
    iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) : "—";

  // Summary calculations
  const pontoDias = data?.registros.filter((r) => r.ocorrencia !== "FALTA").length ?? 0;
  const faltasPonto = data?.registros.filter((r) => r.ocorrencia === "FALTA").length ?? 0;
  const atrasos = data?.registros.filter((r) => r.ocorrencia === "ATRASO").length ?? 0;
  const totalHoras = data?.registros.reduce((s, r) => s + (r.horasTrabalhadas ?? 0), 0) ?? 0;
  const totalExtras = data?.registros.reduce((s, r) => s + (r.horasExtras ?? 0), 0) ?? 0;
  const diasAusencia = data?.ausencias.reduce((s, a) => s + a.diasAfastamento, 0) ?? 0;
  const diasFerias = data?.ferias.reduce((s, f) => s + f.diasCorridos, 0) ?? 0;
  const semRegistro = days.filter((d) => {
    if (!data) return false;
    const k = classifyDay(d, data.registros, data.ausencias, data.ferias);
    return k.kind === "vazio";
  }).length;

  const monthLabel = new Date(filterMonth + "-02").toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div className="space-y-4">
      {/* Employee selector */}
      <Card>
        <div className="p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <UserCircle2 size={20} className="text-red-600 shrink-0 mt-0.5 sm:mt-0" />
          <div className="flex-1 max-w-xs">
            <Select
              value={funcionarioId}
              onChange={(e) => setFuncionarioId(e.target.value)}
            >
              <option value="">Selecione um colaborador...</option>
              {funcionarios.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome} ({f.matricula})
                </option>
              ))}
            </Select>
          </div>
          {data && (
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-500">
                <span className="font-medium text-gray-800">{data.funcionario.cargo.nome}</span>
                {" · "}
                {data.funcionario.restaurante.nome}
                {" · "}
                <span className="capitalize">{monthLabel}</span>
              </div>
              <a
                href={`/api/ponto/cartao?funcionarioId=${funcionarioId}&month=${filterMonth}`}
                download
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-lg transition-colors"
              >
                <Download size={13} /> Cartão Ponto
              </a>
            </div>
          )}
        </div>
      </Card>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center h-48">
          <Loader2 size={24} className="animate-spin text-red-500" />
        </div>
      )}

      {/* No employee selected */}
      {!loading && !funcionarioId && (
        <div className="flex flex-col items-center justify-center h-48 text-gray-400">
          <UserCircle2 size={36} className="mb-2 opacity-30" />
          <p className="font-medium">Selecione um colaborador para ver o ponto mensal</p>
        </div>
      )}

      {/* Summary cards */}
      {!loading && data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              { label: "Dias Trabalhados", value: pontoDias, color: "text-gray-900" },
              { label: "Horas Totais", value: `${totalHoras.toFixed(1)}h`, color: "text-gray-900" },
              { label: "Horas Extras", value: `${totalExtras.toFixed(1)}h`, color: "text-blue-600" },
              { label: "Atrasos", value: atrasos, color: atrasos > 0 ? "text-red-600" : "text-gray-900" },
              { label: "Faltas", value: faltasPonto, color: faltasPonto > 0 ? "text-red-600" : "text-gray-900" },
              { label: "Ausências", value: `${diasAusencia}d`, color: diasAusencia > 0 ? "text-orange-600" : "text-gray-900" },
              { label: "Férias", value: `${diasFerias}d`, color: diasFerias > 0 ? "text-indigo-600" : "text-gray-900" },
            ].map(({ label, value, color }) => (
              <Card key={label}>
                <div className="p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">{label}</p>
                  <p className={`text-xl font-bold ${color}`}>{value}</p>
                </div>
              </Card>
            ))}
          </div>

          {/* Day table */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-3 py-3 text-left font-semibold text-gray-600 w-24">Data</th>
                    <th className="px-3 py-3 text-left font-semibold text-gray-600 w-12">Dia</th>
                    <th className="px-3 py-3 text-left font-semibold text-gray-600">Entrada</th>
                    <th className="px-3 py-3 text-left font-semibold text-gray-600">S. Almoço</th>
                    <th className="px-3 py-3 text-left font-semibold text-gray-600">Retorno</th>
                    <th className="px-3 py-3 text-left font-semibold text-gray-600">Saída</th>
                    <th className="px-3 py-3 text-left font-semibold text-gray-600">Horas</th>
                    <th className="px-3 py-3 text-left font-semibold text-gray-600">Status</th>
                    <th className="px-3 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {days.map((day) => {
                    const info = classifyDay(day, data.registros, data.ausencias, data.ferias);
                    const date = new Date(day + "T12:00:00");
                    const dayOfWeek = DAYS_PT[date.getDay()];
                    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                    const dateFormatted = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" });

                    if (info.kind === "ponto") {
                      const r = info.registro;
                      const oc = r.ocorrencia ?? "NORMAL";
                      return (
                        <tr key={day} className={`${pontoRowClass[oc] ?? ""} hover:brightness-95 transition-all`}>
                          <td className="px-3 py-2.5 font-mono text-xs text-gray-600">{dateFormatted}</td>
                          <td className={`px-3 py-2.5 text-xs font-semibold ${isWeekend ? "text-blue-500" : "text-gray-500"}`}>{dayOfWeek}</td>
                          <td className="px-3 py-2.5 font-mono text-gray-700">{fmt(r.entrada)}</td>
                          <td className="px-3 py-2.5 font-mono text-gray-500">{fmt(r.saidaAlmoco)}</td>
                          <td className="px-3 py-2.5 font-mono text-gray-500">{fmt(r.retornoAlmoco)}</td>
                          <td className="px-3 py-2.5 font-mono text-gray-700">{fmt(r.saida)}</td>
                          <td className="px-3 py-2.5 font-semibold text-gray-900">
                            {r.horasTrabalhadas ? `${r.horasTrabalhadas.toFixed(1)}h` : "—"}
                            {(r.horasExtras ?? 0) > 0 && (
                              <span className="text-blue-500 text-xs ml-1">(+{r.horasExtras?.toFixed(1)}h)</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            <Badge variant={pontoVariant[oc] ?? "secondary"} className="text-xs">
                              {pontoOcorrLabel[oc] ?? oc}
                            </Badge>
                          </td>
                          <td className="px-3 py-2.5">
                            <button
                              onClick={() => handleDeleteRegistro(r.id)}
                              className="p-1 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Excluir registro"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    }

                    if (info.kind === "ferias") {
                      return (
                        <tr key={day} className="bg-indigo-50 hover:bg-indigo-100 transition-all">
                          <td className="px-3 py-2.5 font-mono text-xs text-gray-600">{dateFormatted}</td>
                          <td className={`px-3 py-2.5 text-xs font-semibold ${isWeekend ? "text-blue-500" : "text-gray-500"}`}>{dayOfWeek}</td>
                          <td colSpan={5} className="px-3 py-2.5 text-indigo-700 text-sm">
                            Férias — {info.ferias.diasCorridos} dias corridos
                          </td>
                          <td className="px-3 py-2.5">
                            <Badge variant="secondary" className="text-xs bg-indigo-100 text-indigo-700 border-0">Férias</Badge>
                          </td>
                          <td className="px-3 py-2.5" />
                        </tr>
                      );
                    }

                    if (info.kind === "ausencia") {
                      const a = info.ausencia;
                      return (
                        <tr key={day} className="bg-orange-50 hover:bg-orange-100 transition-all">
                          <td className="px-3 py-2.5 font-mono text-xs text-gray-600">{dateFormatted}</td>
                          <td className={`px-3 py-2.5 text-xs font-semibold ${isWeekend ? "text-blue-500" : "text-gray-500"}`}>{dayOfWeek}</td>
                          <td colSpan={5} className="px-3 py-2.5 text-orange-800 text-sm">
                            {ausenciaTipoLabel[a.tipo] ?? a.tipo}
                            {a.motivo && <span className="text-orange-600 text-xs ml-2">— {a.motivo}</span>}
                          </td>
                          <td className="px-3 py-2.5">
                            <Badge variant="warning" className="text-xs">Ausência</Badge>
                          </td>
                          <td className="px-3 py-2.5" />
                        </tr>
                      );
                    }

                    // vazio
                    return (
                      <tr key={day} className={`${isWeekend ? "bg-gray-50/50" : ""} hover:bg-gray-50 transition-all`}>
                        <td className="px-3 py-2.5 font-mono text-xs text-gray-400">{dateFormatted}</td>
                        <td className={`px-3 py-2.5 text-xs font-semibold ${isWeekend ? "text-blue-400" : "text-gray-400"}`}>{dayOfWeek}</td>
                        <td colSpan={6} className="px-3 py-2.5 text-gray-300 text-xs italic">Sem registro</td>
                        <td className="px-3 py-2.5" />
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {semRegistro > 0 && (
              <div className="px-4 py-2.5 border-t border-gray-100 text-xs text-gray-400 flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-gray-200 inline-block" />
                {semRegistro} dia(s) sem registro no período
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
