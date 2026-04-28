"use client";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface Funcionario {
  id: string;
  nome: string;
  matricula: string;
  cargo: { nome: string };
  restaurante: { nome: string };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Props {
  ausencia?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

const TIPOS = [
  { value: "ATESTADO_MEDICO",       label: "Atestado Médico" },
  { value: "ATESTADO_ACOMPANHANTE", label: "Atestado Acompanhante" },
  { value: "LICENCA_MEDICA",        label: "Licença Médica" },
  { value: "LICENCA_MATERNIDADE",   label: "Licença Maternidade" },
  { value: "LICENCA_PATERNIDADE",   label: "Licença Paternidade" },
  { value: "FALTA_JUSTIFICADA",     label: "Falta Justificada" },
  { value: "FALTA_INJUSTIFICADA",   label: "Falta Injustificada" },
  { value: "OUTROS",                label: "Outros" },
];

export function AusenciaForm({ ausencia, onSuccess, onCancel }: Props) {
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [diasCalculados, setDiasCalculados] = useState(0);

  const [form, setForm] = useState({
    funcionarioId: "",
    tipo: "ATESTADO_MEDICO",
    dataInicio: "",
    dataFim: "",
    motivo: "",
    descricao: "",
    status: "PENDENTE",
    observacoes: "",
  });

  useEffect(() => {
    fetch("/api/funcionarios")
      .then(r => r.json())
      .then(data => setFuncionarios(data.filter((f: any) => f.status === "ATIVO" || f.status === "AFASTADO")));
  }, []);

  useEffect(() => {
    if (ausencia) {
      setForm({
        funcionarioId: ausencia.funcionarioId ?? ausencia.funcionario?.id ?? "",
        tipo: ausencia.tipo ?? "ATESTADO_MEDICO",
        dataInicio: ausencia.dataInicio ? String(ausencia.dataInicio).slice(0, 10) : "",
        dataFim: ausencia.dataFim ? String(ausencia.dataFim).slice(0, 10) : "",
        motivo: ausencia.motivo ?? "",
        descricao: ausencia.descricao ?? "",
        status: ausencia.status ?? "PENDENTE",
        observacoes: ausencia.observacoes ?? "",
      });
    }
  }, [ausencia]);

  useEffect(() => {
    if (form.dataInicio && form.dataFim) {
      const d1 = new Date(form.dataInicio);
      const d2 = new Date(form.dataFim);
      if (d2 >= d1) {
        setDiasCalculados(Math.ceil((d2.getTime() - d1.getTime()) / 86400000) + 1);
      } else {
        setDiasCalculados(0);
      }
    }
  }, [form.dataInicio, form.dataFim]);

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.funcionarioId) { setError("Selecione um funcionário"); return; }
    if (new Date(form.dataFim) < new Date(form.dataInicio)) {
      setError("Data fim deve ser após a data início");
      return;
    }
    setLoading(true);
    try {
      const url = ausencia ? `/api/ausencias/${ausencia.id}` : "/api/ausencias";
      const method = ausencia ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json();
        setError((d.detail ? `${d.error}: ${d.detail}` : d.error) ?? "Erro ao salvar");
        return;
      }
      onSuccess();
    } catch {
      setError("Erro de conexão");
    } finally {
      setLoading(false);
    }
  }

  const Label = ({ children }: { children: React.ReactNode }) => (
    <label className="block text-xs font-medium text-gray-600 mb-1">{children}</label>
  );

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4">
      <div>
        <Label>Funcionário *</Label>
        <Select value={form.funcionarioId} onChange={e => set("funcionarioId", e.target.value)} required>
          <option value="">Selecione...</option>
          {funcionarios.map(f => (
            <option key={f.id} value={f.id}>
              {f.nome} — {f.cargo.nome} ({f.restaurante.nome})
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label>Tipo de Ausência *</Label>
        <Select value={form.tipo} onChange={e => set("tipo", e.target.value)} required>
          {TIPOS.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Data Início *</Label>
          <Input type="date" value={form.dataInicio} onChange={e => set("dataInicio", e.target.value)} required />
        </div>
        <div>
          <Label>Data Fim *</Label>
          <Input type="date" value={form.dataFim} onChange={e => set("dataFim", e.target.value)} required />
        </div>
      </div>

      {diasCalculados > 0 && (
        <p className="text-sm text-blue-600 font-medium">
          {diasCalculados} dia{diasCalculados !== 1 ? "s" : ""} de afastamento
        </p>
      )}

      <div>
        <Label>Motivo</Label>
        <Input
          value={form.motivo}
          onChange={e => set("motivo", e.target.value)}
          placeholder="Ex: Gripe, Consulta médica..."
        />
      </div>

      <div>
        <Label>Descrição</Label>
        <Textarea
          value={form.descricao}
          onChange={e => set("descricao", e.target.value)}
          rows={2}
          placeholder="Detalhes adicionais..."
        />
      </div>

      <div>
        <Label>Status</Label>
        <Select value={form.status} onChange={e => set("status", e.target.value)}>
          <option value="PENDENTE">Pendente</option>
          <option value="APROVADO">Aprovado</option>
          <option value="REPROVADO">Reprovado</option>
        </Select>
      </div>

      <div>
        <Label>Observações internas</Label>
        <Textarea
          value={form.observacoes}
          onChange={e => set("observacoes", e.target.value)}
          rows={2}
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="flex justify-end gap-3 pt-2 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 size={14} className="animate-spin" />}
          {ausencia ? "Salvar Alterações" : "Registrar"}
        </Button>
      </div>
    </form>
  );
}
