import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

function addYears(date: Date, years: number): Date {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

interface FeriasBD {
  id: string;
  dataInicio: Date;
  dataFim: Date;
  diasCorridos: number;
  diasVendidos: number;
  status: string;
}

export interface PeriodoInfo {
  numero: number;
  label: string;
  inicioAquisitivo: string;
  fimAquisitivo: string;
  inicioConcessivo: string;
  fimConcessivo: string;
  diasDevidos: number;
  diasUsados: number;
  diasSaldo: number;
  status: "ADQUIRINDO" | "ADQUIRIDO" | "PARCIAL" | "VENCENDO" | "VENCIDO" | "CONCEDIDO";
  diasParaVencer: number;
  ferias: Array<{ id: string; dataInicio: string; dataFim: string; diasCorridos: number; diasVendidos: number; status: string }>;
}

function calcularPeriodos(dataAdmissao: Date, hoje: Date, ferias: FeriasBD[]): PeriodoInfo[] {
  const periodos: PeriodoInfo[] = [];

  for (let n = 1; n <= 50; n++) {
    const inicioAq = addYears(dataAdmissao, n - 1);
    inicioAq.setHours(0, 0, 0, 0);
    const fimAq = new Date(addYears(dataAdmissao, n).getTime() - 86400000);
    fimAq.setHours(23, 59, 59, 999);
    const inicioConc = addYears(dataAdmissao, n);
    inicioConc.setHours(0, 0, 0, 0);
    const fimConc = new Date(addYears(dataAdmissao, n + 1).getTime() - 86400000);
    fimConc.setHours(23, 59, 59, 999);

    // Stop when acquisition starts more than 12 months in the future
    if (inicioAq.getTime() > hoje.getTime() + 366 * 86400000) break;

    // Match ferias to concession window (or antecipated in acquisition window)
    const feriasNoPeriodo = ferias.filter(f => {
      if (f.status === "CANCELADA") return false;
      const di = new Date(f.dataInicio);
      di.setHours(0, 0, 0, 0);
      // Standard: ferias taken during concession period
      if (di >= inicioConc && di <= fimConc) return true;
      // Antecipated ferias: during acquisition window (some CLT provisions allow it)
      if (di >= inicioAq && di < inicioConc) return true;
      return false;
    });

    const diasUsados = feriasNoPeriodo.reduce((s, f) => s + f.diasCorridos + (f.diasVendidos ?? 0), 0);
    const diasDevidos = 30;
    const diasSaldo = Math.max(0, diasDevidos - diasUsados);
    const diasParaVencer = Math.ceil((fimConc.getTime() - hoje.getTime()) / 86400000);

    let status: PeriodoInfo["status"];
    if (hoje <= fimAq) {
      status = "ADQUIRINDO";
    } else if (diasSaldo === 0) {
      status = "CONCEDIDO";
    } else if (hoje > fimConc) {
      status = "VENCIDO";
    } else if (diasParaVencer <= 60) {
      status = "VENCENDO";
    } else if (diasUsados > 0) {
      status = "PARCIAL";
    } else {
      status = "ADQUIRIDO";
    }

    const anoInicio = inicioAq.getFullYear();
    const anoFim = fimAq.getFullYear();
    const label = anoInicio === anoFim
      ? `${n}º Período (${anoInicio})`
      : `${n}º Período (${anoInicio}/${anoFim})`;

    periodos.push({
      numero: n,
      label,
      inicioAquisitivo: inicioAq.toISOString(),
      fimAquisitivo: fimAq.toISOString(),
      inicioConcessivo: inicioConc.toISOString(),
      fimConcessivo: fimConc.toISOString(),
      diasDevidos,
      diasUsados,
      diasSaldo,
      status,
      diasParaVencer,
      ferias: feriasNoPeriodo.map(f => ({
        id: f.id,
        dataInicio: f.dataInicio.toISOString(),
        dataFim: f.dataFim.toISOString(),
        diasCorridos: f.diasCorridos,
        diasVendidos: f.diasVendidos ?? 0,
        status: f.status,
      })),
    });
  }

  return periodos;
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const restauranteId = searchParams.get("restauranteId");
  const statusFiltro = searchParams.get("status");

  const funcionarios = await prisma.funcionario.findMany({
    where: {
      status: { in: ["ATIVO", "FERIAS", "AFASTADO"] },
      ...(restauranteId ? { restauranteId } : {}),
    },
    include: {
      cargo: { select: { nome: true } },
      restaurante: { select: { id: true, nome: true } },
      ferias: { orderBy: { dataInicio: "asc" } },
    },
    orderBy: { nome: "asc" },
  });

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const resultado = funcionarios.map(func => {
    const dataAdm = new Date(func.dataAdmissao);
    dataAdm.setHours(0, 0, 0, 0);

    const periodos = calcularPeriodos(dataAdm, hoje, func.ferias as FeriasBD[]);

    // Urgência: mostrar apenas pendentes + ativos + vencidos (não CONCEDIDO passado nem ADQUIRINDO futuro além do atual)
    const periodosRelevantes = periodos.filter(p => {
      if (p.status === "CONCEDIDO") return false;
      if (p.status === "ADQUIRINDO" && p.numero > 1) {
        // Show current ADQUIRINDO only if no other period is pending
        const temPendente = periodos.some(x => ["VENCIDO","VENCENDO","ADQUIRIDO","PARCIAL"].includes(x.status));
        return !temPendente;
      }
      return true;
    });

    const ultimasFerias = (func.ferias as FeriasBD[])
      .filter(f => f.status === "CONCLUIDA" && new Date(f.dataFim) <= hoje)
      .sort((a, b) => new Date(b.dataFim).getTime() - new Date(a.dataFim).getTime())[0];

    const statusMaisUrgente = periodosRelevantes[0]?.status ?? "ADQUIRINDO";

    return {
      funcionario: {
        id: func.id,
        nome: func.nome,
        matricula: func.matricula,
        dataAdmissao: func.dataAdmissao,
        cargo: func.cargo,
        restaurante: func.restaurante,
        status: func.status,
      },
      periodos: periodosRelevantes,
      statusMaisUrgente,
      ultimasFerias: ultimasFerias
        ? { dataInicio: ultimasFerias.dataInicio, dataFim: ultimasFerias.dataFim, diasCorridos: ultimasFerias.diasCorridos }
        : null,
    };
  });

  const filtrado = statusFiltro
    ? resultado.filter(r => r.periodos.some(p => p.status === statusFiltro))
    : resultado;

  // Sort by urgency: VENCIDO → VENCENDO → ADQUIRIDO → PARCIAL → ADQUIRINDO
  const ordem = { VENCIDO: 0, VENCENDO: 1, ADQUIRIDO: 2, PARCIAL: 3, ADQUIRINDO: 4, CONCEDIDO: 5 };
  filtrado.sort((a, b) => (ordem[a.statusMaisUrgente as keyof typeof ordem] ?? 5) - (ordem[b.statusMaisUrgente as keyof typeof ordem] ?? 5));

  return NextResponse.json(filtrado);
}
