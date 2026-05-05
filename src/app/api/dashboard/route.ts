import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

async function buildRanking(
  ids: { funcionarioId: string; _count: { funcionarioId: number } }[]
): Promise<{ funcionarioId: string; nome: string; matricula: string; count: number }[]> {
  if (ids.length === 0) return [];
  const funcionarios = await prisma.funcionario.findMany({
    where: { id: { in: ids.map((r) => r.funcionarioId) } },
    select: { id: true, nome: true, matricula: true },
  });
  const map = new Map(funcionarios.map((f) => [f.id, f]));
  return ids.map((r) => ({
    funcionarioId: r.funcionarioId,
    nome: map.get(r.funcionarioId)?.nome ?? "—",
    matricula: map.get(r.funcionarioId)?.matricula ?? "",
    count: r._count.funcionarioId,
  }));
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const now = new Date();
  // Ponto is always imported for the previous month
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1); // current month (admissões/demissões)
  const yearStart  = new Date(now.getFullYear(), 0, 1);

  // Cargos de confiança não entram no ranking de atrasos
  const confiancaIds = (await prisma.funcionario.findMany({
    where: { OR: [{ cargo: { nome: { contains: "gerente" } } }, { cargo: { nome: { contains: "analista" } } }] },
    select: { id: true },
  })).map(f => f.id);

  const [
    totalFuncionarios,
    funcionariosAtivos,
    feriasMes,
    admissoesMes,
    demissoesMes,
    funcionariosPorRestaurante,
    rawAtrasos,
    rawFaltas,
    rawAtestados,
    rawAdvertencias,
  ] = await Promise.all([
    prisma.funcionario.count(),
    prisma.funcionario.count({ where: { status: "ATIVO" } }),
    prisma.ferias.count({
      where: {
        status: "EM_ANDAMENTO",
        dataInicio: { lte: now },
        dataFim: { gte: now },
      },
    }),
    prisma.funcionario.count({
      where: { dataAdmissao: { gte: monthStart } },
    }),
    prisma.funcionario.count({
      where: { dataDemissao: { gte: monthStart } },
    }),
    prisma.restaurante.findMany({
      where: { ativo: true },
      select: { nome: true, _count: { select: { funcionarios: true } } },
    }),
    // Ranking: Atrasos do mês anterior (cargos de confiança excluídos)
    prisma.registroPonto.groupBy({
      by: ["funcionarioId"],
      where: { ocorrencia: "ATRASO", data: { gte: lastMonthStart, lte: lastMonthEnd }, funcionarioId: { notIn: confiancaIds } },
      _count: { funcionarioId: true },
      orderBy: { _count: { funcionarioId: "desc" } },
      take: 5,
    }),
    // Ranking: Faltas do mês anterior
    prisma.registroPonto.groupBy({
      by: ["funcionarioId"],
      where: { ocorrencia: "FALTA", data: { gte: lastMonthStart, lte: lastMonthEnd } },
      _count: { funcionarioId: true },
      orderBy: { _count: { funcionarioId: "desc" } },
      take: 5,
    }),
    // Ranking: Atestados no ano
    prisma.ausencia.groupBy({
      by: ["funcionarioId"],
      where: {
        tipo: { in: ["ATESTADO_MEDICO", "LICENCA_MEDICA", "ACIDENTE_TRABALHO"] },
        dataInicio: { gte: yearStart },
      },
      _count: { funcionarioId: true },
      orderBy: { _count: { funcionarioId: "desc" } },
      take: 5,
    }),
    // Ranking: Advertências (acumulado)
    prisma.advertencia.groupBy({
      by: ["funcionarioId"],
      _count: { funcionarioId: true },
      orderBy: { _count: { funcionarioId: "desc" } },
      take: 5,
    }),
  ]);

  const [rankingAtrasos, rankingFaltas, rankingAtestados, rankingAdvertencias] =
    await Promise.all([
      buildRanking(rawAtrasos),
      buildRanking(rawFaltas),
      buildRanking(rawAtestados),
      buildRanking(rawAdvertencias),
    ]);

  return NextResponse.json({
    totalFuncionarios,
    funcionariosAtivos,
    feriasMes,
    admissoesMes,
    demissoesMes,
    funcionariosPorRestaurante: funcionariosPorRestaurante.map((r) => ({
      nome: r.nome,
      total: r._count.funcionarios,
    })),
    rankingAtrasos,
    rankingFaltas,
    rankingAtestados,
    rankingAdvertencias,
  });
}
