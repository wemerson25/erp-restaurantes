"use client";
import { useEffect, useState, useCallback } from "react";
import { Play, Loader2, DollarSign, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

interface Folha {
  id: string;
  competencia: string;
  salarioBruto: number;
  horasExtras: number;
  valorHorasExtras: number;
  descontoINSS: number;
  descontoIRRF: number;
  valorFGTS: number;
  salarioLiquido: number;
  status: string;
  funcionario: { nome: string; matricula: string; cargo: { nome: string }; restaurante: { nome: string } };
}

const statusVariant: Record<string, string> = {
  PENDENTE: "secondary",
  APROVADA: "blue",
  PAGA: "success",
};

function getMeses() {
  const meses = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    meses.push(d.toISOString().slice(0, 7));
  }
  return meses;
}

export function FolhaContent() {
  const [folhas, setFolhas] = useState<Folha[]>([]);
  const [loading, setLoading] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [competencia, setCompetencia] = useState(() => new Date().toISOString().slice(0, 7));

  const fetchFolhas = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ competencia });
    const res = await fetch(`/api/folha?${params}`);
    setFolhas(await res.json());
    setLoading(false);
  }, [competencia]);

  useEffect(() => { fetchFolhas(); }, [fetchFolhas]);

  async function gerarFolha() {
    if (!confirm(`Gerar folha de pagamento para ${competencia}?`)) return;
    setGerando(true);
    try {
      const res = await fetch("/api/folha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competencia }),
      });
      const data = await res.json();
      alert(`${data.geradas} folhas geradas com sucesso!`);
      fetchFolhas();
    } catch {
      alert("Erro ao gerar folhas");
    } finally {
      setGerando(false);
    }
  }

  async function atualizarStatus(id: string, status: string) {
    await fetch(`/api/folha/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchFolhas();
  }

  const totalBruto = folhas.reduce((acc, f) => acc + f.salarioBruto, 0);
  const totalLiquido = folhas.reduce((acc, f) => acc + f.salarioLiquido, 0);
  const totalINSS = folhas.reduce((acc, f) => acc + f.descontoINSS, 0);
  const totalFGTS = folhas.reduce((acc, f) => acc + f.valorFGTS, 0);

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <Select value={competencia} onChange={(e) => setCompetencia(e.target.value)} className="w-44">
          {getMeses().map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </Select>
        <Button onClick={gerarFolha} disabled={gerando}>
          {gerando ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
          Gerar Folha
        </Button>
      </div>

      {/* Resumo financeiro */}
      {folhas.length > 0 && (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            { label: "Total Bruto", value: formatCurrency(totalBruto), color: "bg-blue-100", text: "text-blue-700" },
            { label: "Total INSS", value: formatCurrency(totalINSS), color: "bg-orange-100", text: "text-orange-700" },
            { label: "Total FGTS", value: formatCurrency(totalFGTS), color: "bg-purple-100", text: "text-purple-700" },
            { label: "Total Líquido", value: formatCurrency(totalLiquido), color: "bg-green-100", text: "text-green-700" },
          ].map(({ label, value, color, text }) => (
            <Card key={label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center`}>
                  <DollarSign size={18} className={text} />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className={`text-lg font-bold ${text}`}>{value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Table */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 size={24} className="animate-spin text-orange-500" />
          </div>
        ) : folhas.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <DollarSign size={32} className="mb-2 text-gray-300" />
            <p className="font-medium">Nenhuma folha para {competencia}</p>
            <p className="text-sm">Clique em &ldquo;Gerar Folha&rdquo; para calcular os salários</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Funcionário</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Restaurante</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">Bruto</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">H. Extras</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">INSS</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">IRRF</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">FGTS</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600 text-green-700">Líquido</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">Status</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {folhas.map((f) => (
                  <tr key={f.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{f.funcionario.nome}</p>
                      <p className="text-xs text-gray-400">{f.funcionario.matricula} · {f.funcionario.cargo.nome}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{f.funcionario.restaurante.nome}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(f.salarioBruto)}</td>
                    <td className="px-4 py-3 text-right text-orange-600">{f.valorHorasExtras > 0 ? formatCurrency(f.valorHorasExtras) : "—"}</td>
                    <td className="px-4 py-3 text-right text-red-600">-{formatCurrency(f.descontoINSS)}</td>
                    <td className="px-4 py-3 text-right text-red-600">-{formatCurrency(f.descontoIRRF)}</td>
                    <td className="px-4 py-3 text-right text-purple-600">{formatCurrency(f.valorFGTS)}</td>
                    <td className="px-4 py-3 text-right font-bold text-green-700">{formatCurrency(f.salarioLiquido)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={statusVariant[f.status] as never}>{f.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {f.status === "PENDENTE" && (
                        <Button size="sm" variant="outline" onClick={() => atualizarStatus(f.id, "APROVADA")}>
                          Aprovar
                        </Button>
                      )}
                      {f.status === "APROVADA" && (
                        <Button size="sm" variant="success" onClick={() => atualizarStatus(f.id, "PAGA")}>
                          <CheckCircle size={13} /> Pagar
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && folhas.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-500">{folhas.length} colaborador(es)</span>
            <span className="text-sm font-semibold text-green-700">Total a pagar: {formatCurrency(totalLiquido)}</span>
          </div>
        )}
      </Card>
    </div>
  );
}
