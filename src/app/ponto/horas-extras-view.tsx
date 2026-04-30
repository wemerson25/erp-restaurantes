"use client";
import { useEffect, useState, useCallback } from "react";
import { TrendingUp, Clock, Users, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface EmployeeOT {
  funcionario: { id: string; nome: string; matricula: string; cargo: { nome: string }; restaurante: { nome: string } };
  diasTrabalhados: number;
  horasTrabalhadas: number;
  horasPrevistas: number;
  horasExtras: number;
}

function fmtH(h: number) {
  const hrs = Math.floor(h);
  const mins = Math.round((h - hrs) * 60);
  return mins > 0 ? `${hrs}h${String(mins).padStart(2, "0")}` : `${hrs}h`;
}

export function HorasExtrasView({ filterMonth }: { filterMonth: string }) {
  const [data, setData] = useState<EmployeeOT[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/ponto/horas-extras?month=${filterMonth}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [filterMonth]);

  useEffect(() => { load(); }, [load]);

  const totalExtras = data.reduce((s, e) => s + e.horasExtras, 0);
  const totalTrabalhado = data.reduce((s, e) => s + e.horasTrabalhadas, 0);
  const comExtras = data.filter(e => e.horasExtras > 0).length;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card>
          <div className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
              <TrendingUp size={18} className="text-orange-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Total H. Extras</p>
              <p className="text-2xl font-bold text-orange-600">{fmtH(totalExtras)}</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <Clock size={18} className="text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">H. Trabalhadas</p>
              <p className="text-2xl font-bold text-blue-600">{fmtH(totalTrabalhado)}</p>
            </div>
          </div>
        </Card>
        <Card className="col-span-2 sm:col-span-1">
          <div className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
              <Users size={18} className="text-gray-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Colaboradores c/ Extra</p>
              <p className="text-2xl font-bold text-gray-900">{comExtras}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 size={24} className="animate-spin text-orange-500" />
          </div>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <TrendingUp size={36} className="mb-2 opacity-30" />
            <p className="font-medium">Nenhum dado para este período</p>
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-gray-100">
              {data.map((e) => (
                <div key={e.funcionario.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{e.funcionario.nome}</p>
                      <p className="text-xs text-gray-400">{e.funcionario.cargo.nome} · {e.funcionario.restaurante.nome}</p>
                    </div>
                    <span className={cn(
                      "text-sm font-bold shrink-0",
                      e.horasExtras > 0 ? "text-orange-600" : "text-gray-400"
                    )}>
                      {e.horasExtras > 0 ? `+${fmtH(e.horasExtras)}` : "—"}
                    </span>
                  </div>
                  <div className="flex gap-4 text-xs text-gray-500">
                    <span>{e.diasTrabalhados} dias</span>
                    <span>{fmtH(e.horasTrabalhadas)} trabalhadas</span>
                    <span>{fmtH(e.horasPrevistas)} previstas</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Funcionário</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Restaurante</th>
                    <th className="px-4 py-3 text-center font-semibold text-gray-600">Dias</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600">H. Trabalhadas</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600">H. Previstas</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600">H. Extras</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.map((e) => (
                    <tr key={e.funcionario.id} className={cn(
                      "hover:bg-gray-50",
                      e.horasExtras > 0 && "bg-orange-50/40 hover:bg-orange-50"
                    )}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{e.funcionario.nome}</p>
                        <p className="text-xs text-gray-400">{e.funcionario.matricula} · {e.funcionario.cargo.nome}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{e.funcionario.restaurante.nome}</td>
                      <td className="px-4 py-3 text-center text-gray-700">{e.diasTrabalhados}</td>
                      <td className="px-4 py-3 text-right font-mono text-gray-700">{fmtH(e.horasTrabalhadas)}</td>
                      <td className="px-4 py-3 text-right font-mono text-gray-500">{fmtH(e.horasPrevistas)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={cn(
                          "font-bold font-mono",
                          e.horasExtras > 0 ? "text-orange-600" : "text-gray-300"
                        )}>
                          {e.horasExtras > 0 ? `+${fmtH(e.horasExtras)}` : "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 border-t-2 border-gray-200 font-semibold">
                    <td className="px-4 py-3 text-gray-700" colSpan={2}>Total</td>
                    <td className="px-4 py-3 text-center text-gray-700">
                      {data.reduce((s, e) => s + e.diasTrabalhados, 0)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-700">{fmtH(totalTrabalhado)}</td>
                    <td className="px-4 py-3 text-right font-mono text-gray-500">
                      {fmtH(data.reduce((s, e) => s + e.horasPrevistas, 0))}
                    </td>
                    <td className="px-4 py-3 text-right font-bold font-mono text-orange-600">
                      +{fmtH(totalExtras)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </Card>

      <p className="text-xs text-gray-400 text-center">
        Regra: dia positivo soma; dia negativo é ignorado. Carga: Ykedin seg–sex 8h / fim de semana 6h · Deck SteakHouse 7h20 todos os dias.
      </p>
    </div>
  );
}
