"use client";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface Cargo { id: string; nome: string; departamento: string; salarioBase: number }
interface Restaurante { id: string; nome: string }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Props {
  funcionario?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

export function FuncionarioForm({ funcionario, onSuccess, onCancel }: Props) {
  const [cargos, setCargos] = useState<Cargo[]>([]);
  const [restaurantes, setRestaurantes] = useState<Restaurante[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    nome: "",
    cpf: "",
    rg: "",
    dataNascimento: "",
    sexo: "M",
    estadoCivil: "SOLTEIRO",
    email: "",
    telefone: "",
    endereco: "",
    cidade: "",
    estado: "SP",
    cep: "",
    dataAdmissao: "",
    salario: "",
    tipoContrato: "CLT",
    status: "ATIVO",
    turno: "MANHA",
    ctps: "",
    pisPassep: "",
    observacoes: "",
    cargoId: "",
    restauranteId: "",
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/cargos").then((r) => r.json()),
      fetch("/api/restaurantes").then((r) => r.json()),
    ]).then(([c, r]) => { setCargos(c); setRestaurantes(r); });
  }, []);

  useEffect(() => {
    if (funcionario) {
      const toDate = (v: unknown) => v ? String(v).slice(0, 10) : "";
      setForm({
        nome: String(funcionario.nome ?? ""),
        cpf: String(funcionario.cpf ?? ""),
        rg: String(funcionario.rg ?? ""),
        dataNascimento: toDate(funcionario.dataNascimento),
        sexo: String(funcionario.sexo ?? "M"),
        estadoCivil: String(funcionario.estadoCivil ?? "SOLTEIRO"),
        email: String(funcionario.email ?? ""),
        telefone: String(funcionario.telefone ?? ""),
        endereco: String(funcionario.endereco ?? ""),
        cidade: String(funcionario.cidade ?? ""),
        estado: String(funcionario.estado ?? "SP"),
        cep: String(funcionario.cep ?? ""),
        dataAdmissao: toDate(funcionario.dataAdmissao),
        salario: String(funcionario.salario ?? ""),
        tipoContrato: String(funcionario.tipoContrato ?? "CLT"),
        status: String(funcionario.status ?? "ATIVO"),
        turno: String(funcionario.turno ?? "MANHA"),
        ctps: String(funcionario.ctps ?? ""),
        pisPassep: String(funcionario.pisPassep ?? ""),
        observacoes: String(funcionario.observacoes ?? ""),
        cargoId: String(funcionario.cargoId ?? ""),
        restauranteId: String(funcionario.restauranteId ?? ""),
      });
    }
  }, [funcionario]);

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const url = funcionario ? `/api/funcionarios/${funcionario.id}` : "/api/funcionarios";
      const method = funcionario ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Erro ao salvar");
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
    <form onSubmit={handleSubmit} className="p-6 space-y-6">
      {/* Dados Pessoais */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3 pb-2 border-b">Dados Pessoais</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>Nome Completo *</Label>
            <Input value={form.nome} onChange={(e) => set("nome", e.target.value)} required />
          </div>
          <div>
            <Label>CPF *</Label>
            <Input value={form.cpf} onChange={(e) => set("cpf", e.target.value)} placeholder="000.000.000-00" required />
          </div>
          <div>
            <Label>RG</Label>
            <Input value={form.rg} onChange={(e) => set("rg", e.target.value)} />
          </div>
          <div>
            <Label>Data de Nascimento *</Label>
            <Input type="date" value={form.dataNascimento} onChange={(e) => set("dataNascimento", e.target.value)} required />
          </div>
          <div>
            <Label>Sexo</Label>
            <Select value={form.sexo} onChange={(e) => set("sexo", e.target.value)}>
              <option value="M">Masculino</option>
              <option value="F">Feminino</option>
              <option value="O">Outro</option>
            </Select>
          </div>
          <div>
            <Label>Estado Civil</Label>
            <Select value={form.estadoCivil} onChange={(e) => set("estadoCivil", e.target.value)}>
              <option value="SOLTEIRO">Solteiro(a)</option>
              <option value="CASADO">Casado(a)</option>
              <option value="DIVORCIADO">Divorciado(a)</option>
              <option value="VIUVO">Viúvo(a)</option>
              <option value="UNIAO_ESTAVEL">União Estável</option>
            </Select>
          </div>
          <div>
            <Label>Telefone *</Label>
            <Input value={form.telefone} onChange={(e) => set("telefone", e.target.value)} placeholder="(11) 99999-9999" required />
          </div>
          <div>
            <Label>E-mail</Label>
            <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          </div>
        </div>
      </div>

      {/* Endereço */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3 pb-2 border-b">Endereço</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>Endereço *</Label>
            <Input value={form.endereco} onChange={(e) => set("endereco", e.target.value)} required />
          </div>
          <div>
            <Label>Cidade *</Label>
            <Input value={form.cidade} onChange={(e) => set("cidade", e.target.value)} required />
          </div>
          <div>
            <Label>Estado</Label>
            <Input value={form.estado} onChange={(e) => set("estado", e.target.value)} maxLength={2} />
          </div>
          <div>
            <Label>CEP *</Label>
            <Input value={form.cep} onChange={(e) => set("cep", e.target.value)} placeholder="00000-000" required />
          </div>
        </div>
      </div>

      {/* Dados Profissionais */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 mb-3 pb-2 border-b">Dados Profissionais</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Restaurante *</Label>
            <Select value={form.restauranteId} onChange={(e) => set("restauranteId", e.target.value)} required>
              <option value="">Selecione...</option>
              {restaurantes.map((r) => (
                <option key={r.id} value={r.id}>{r.nome}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Cargo *</Label>
            <Select value={form.cargoId} onChange={(e) => set("cargoId", e.target.value)} required>
              <option value="">Selecione...</option>
              {cargos.map((c) => (
                <option key={c.id} value={c.id}>{c.nome} - {c.departamento}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Data de Admissão *</Label>
            <Input type="date" value={form.dataAdmissao} onChange={(e) => set("dataAdmissao", e.target.value)} required />
          </div>
          <div>
            <Label>Salário (R$) *</Label>
            <Input type="number" step="0.01" value={form.salario} onChange={(e) => set("salario", e.target.value)} required />
          </div>
          <div>
            <Label>Tipo de Contrato</Label>
            <Select value={form.tipoContrato} onChange={(e) => set("tipoContrato", e.target.value)}>
              <option value="CLT">CLT</option>
              <option value="PJ">PJ</option>
              <option value="TEMPORARIO">Temporário</option>
            </Select>
          </div>
          <div>
            <Label>Turno</Label>
            <Select value={form.turno} onChange={(e) => set("turno", e.target.value)}>
              <option value="MANHA">Manhã</option>
              <option value="TARDE">Tarde</option>
              <option value="NOITE">Noite</option>
              <option value="MISTO">Misto</option>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={form.status} onChange={(e) => set("status", e.target.value)}>
              <option value="ATIVO">Ativo</option>
              <option value="FERIAS">Férias</option>
              <option value="AFASTADO">Afastado</option>
            </Select>
          </div>
          <div>
            <Label>CTPS</Label>
            <Input value={form.ctps} onChange={(e) => set("ctps", e.target.value)} />
          </div>
          <div>
            <Label>PIS/PASEP</Label>
            <Input value={form.pisPassep} onChange={(e) => set("pisPassep", e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label>Observações</Label>
            <Textarea value={form.observacoes} onChange={(e) => set("observacoes", e.target.value)} rows={2} />
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      <div className="flex justify-end gap-3 pt-2 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 size={14} className="animate-spin" />}
          {funcionario ? "Salvar Alterações" : "Cadastrar Funcionário"}
        </Button>
      </div>
    </form>
  );
}
