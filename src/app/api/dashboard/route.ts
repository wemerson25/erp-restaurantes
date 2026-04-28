import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const [
    totalFuncionarios,
    funcionariosAtivos,
    totalRestaurantes,
    feriasMes,
    folhaTotal,
    admissoesMes,
    demissoesMes,
    funcionariosPorRestaurante,
    registrosPontoHoje,
  ] = await Promise.all([
    prisma.funcionario.count(),
    prisma.funcionario.count({ where: { status: "ATIVO" } }),
    prisma.restaurante.count({ where: { ativo: true } }),
    prisma.ferias.count({
      where: {
        status: "EM_ANDAMENTO",
        dataInicio: { lte: new Date() },
        dataFim: { gte: new Date() },
      },
    }),
    prisma.folhaPagamento.aggregate({
      where: { competencia: new Date().toISOString().slice(0, 7) },
      _sum: { salarioLiquido: true },
    }),
    prisma.funcionario.count({
      where: {
        dataAdmissao: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
    }),
    prisma.funcionario.count({
      where: {
        dataDemissao: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
    }),
    prisma.restaurante.findMany({
      where: { ativo: true },
      select: {
        nome: true,
        _count: { select: { funcionarios: true } },
      },
    }),
    prisma.registroPonto.count({
      where: {
        data: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
          lt: new Date(new Date().setHours(23, 59, 59, 999)),
        },
      },
    }),
  ]);

  return NextResponse.json({
    totalFuncionarios,
    funcionariosAtivos,
    totalRestaurantes,
    feriasMes,
    folhaMes: folhaTotal._sum.salarioLiquido ?? 0,
    admissoesMes,
    demissoesMes,
    funcionariosPorRestaurante: funcionariosPorRestaurante.map((r) => ({
      nome: r.nome,
      total: r._count.funcionarios,
    })),
    registrosPontoHoje,
  });
}
