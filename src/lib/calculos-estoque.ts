export type ProdutoCalculo = {
  metaSemanal: number;
  qtdPorPacote: number;
  ilimitado: number | boolean;
  sacaThresholdCheia?: number | null;
  sacaThresholdMeia?: number | null;
};

export type ResultadoPedido = { qtd: number; unidadeExibida: string };

export function calcularPedidoSaca(produto: ProdutoCalculo, contagem: number): string {
  if (produto.sacaThresholdCheia == null) return "0";
  if (contagem < produto.sacaThresholdCheia) return "1 SACA";
  if (produto.sacaThresholdMeia != null && contagem < produto.sacaThresholdMeia) return "MEIA SACA";
  return "0";
}

export function calcularPedido(
  produto: ProdutoCalculo,
  contagem: number,
  deposito: number,
  unidadeMedida: string,
): ResultadoPedido {
  if (produto.ilimitado) return { qtd: 0, unidadeExibida: unidadeMedida };
  if (produto.sacaThresholdCheia != null) {
    const texto = calcularPedidoSaca(produto, contagem);
    const qtd = texto === "1 SACA" ? 1 : texto === "MEIA SACA" ? 0.5 : 0;
    return { qtd, unidadeExibida: qtd === 0 ? "0" : "SACA" };
  }
  const qtd = Math.ceil(
    Math.max(0, (produto.metaSemanal - (contagem + deposito)) / Math.max(produto.qtdPorPacote, 1))
  );
  return { qtd, unidadeExibida: unidadeMedida };
}

export function calcularTrazerDeposito(metaSemanal: number, contagem: number, deposito: number): number {
  return Math.max(0, Math.min(deposito, metaSemanal - contagem));
}

export function calcularUsoReal(h: { estoqueInicial: number; comprasDia: number; contagemFim: number }): number {
  return h.estoqueInicial + h.comprasDia - h.contagemFim;
}

export function calcularMedias(historicos: { estoqueInicial: number; comprasDia: number; contagemFim: number }[]) {
  const soma = historicos.reduce((acc, h) => acc + calcularUsoReal(h), 0);
  return { diaria: soma / 28, semanal: soma / 4, mensal: soma };
}

export function divergeMetaSemanal(
  historicos: { estoqueInicial: number; comprasDia: number; contagemFim: number }[],
  metaSemanal: number,
  threshold = 0.2,
): boolean {
  if (!historicos.length || metaSemanal === 0) return false;
  const { semanal } = calcularMedias(historicos);
  return Math.abs(semanal - metaSemanal) / metaSemanal > threshold;
}

export function getSemanaRef(date = new Date()): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum =
    Math.round(((d.getTime() - week1.getTime()) / 86400000 + ((week1.getDay() + 6) % 7)) / 7) + 1;
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

export function formatarSemana(semanaRef: string): string {
  const [year, weekPart] = semanaRef.split("-W");
  const weekNum = parseInt(weekPart, 10);
  const jan4 = new Date(parseInt(year, 10), 0, 4);
  const dayOfWeek = (jan4.getDay() + 6) % 7;
  const weekStart = new Date(jan4);
  weekStart.setDate(jan4.getDate() - dayOfWeek + (weekNum - 1) * 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const meses = ["Jan", "Fev", "Mar", "Abr", "Maio", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `Semana ${weekNum} — ${String(weekStart.getDate()).padStart(2, "0")} a ${String(weekEnd.getDate()).padStart(2, "0")}/${meses[weekEnd.getMonth()]}`;
}

export function semanaAnterior(semanaRef: string): string {
  return getSemanaRef(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 * offsetFromCurrent(semanaRef) - 7 * 24 * 60 * 60 * 1000));
}

function offsetFromCurrent(semanaRef: string): number {
  const current = getSemanaRef();
  if (semanaRef === current) return 0;
  return 0;
}

export function navegarSemana(semanaRef: string, delta: number): string {
  const [year, weekPart] = semanaRef.split("-W");
  const y = parseInt(year, 10);
  const w = parseInt(weekPart, 10);
  const jan4 = new Date(y, 0, 4);
  const dayOfWeek = (jan4.getDay() + 6) % 7;
  const weekStart = new Date(jan4);
  weekStart.setDate(jan4.getDate() - dayOfWeek + (w - 1) * 7 + delta * 7);
  return getSemanaRef(weekStart);
}
