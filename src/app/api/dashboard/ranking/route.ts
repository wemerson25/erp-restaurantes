import { NextRequest, NextResponse } from "next/server";
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

// GET /api/dashboard/ranking?month=YYYY-MM   → filter by month
// GET /api/dashboard/ranking?period=all      → all time (since admission)
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month  = searchParams.get("month");
  const period = searchParams.get("period");

  let dateRange: { gte: Date; lte: Date } | undefined;
  if (period !== "all" && month) {
    const [y, m] = month.split("-").map(Number);
    dateRange = { gte: new Date(y, m - 1, 1), lte: new Date(y, m, 0, 23, 59, 59) };
  }

  const [rawAtrasos, rawFaltas, rawAtestados, rawAdvertencias] = await Promise.all([
    prisma.registroPonto.groupBy({
      by: ["funcionarioId"],
      where: dateRange ? { ocorrencia: "ATRASO", data: dateRange } : { ocorrencia: "ATRASO" },
      _count: { funcionarioId: true },
      orderBy: { _count: { funcionarioId: "desc" } },
      take: 5,
    }),
    prisma.registroPonto.groupBy({
      by: ["funcionarioId"],
      where: dateRange ? { ocorrencia: "FALTA", data: dateRange } : { ocorrencia: "FALTA" },
      _count: { funcionarioId: true },
      orderBy: { _count: { funcionarioId: "desc" } },
      take: 5,
    }),
    prisma.ausencia.groupBy({
      by: ["funcionarioId"],
      where: dateRange
        ? { tipo: { in: ["ATESTADO_MEDICO", "LICENCA_MEDICA", "ACIDENTE_TRABALHO"] }, dataInicio: dateRange }
        : { tipo: { in: ["ATESTADO_MEDICO", "LICENCA_MEDICA", "ACIDENTE_TRABALHO"] } },
      _count: { funcionarioId: true },
      orderBy: { _count: { funcionarioId: "desc" } },
      take: 5,
    }),
    prisma.advertencia.groupBy({
      by: ["funcionarioId"],
      where: dateRange ? { data: dateRange } : {},
      _count: { funcionarioId: true },
      orderBy: { _count: { funcionarioId: "desc" } },
      take: 5,
    }),
  ]);

  const [rankingAtrasos, rankingFaltas, rankingAtestados, rankingAdvertencias] = await Promise.all([
    buildRanking(rawAtrasos),
    buildRanking(rawFaltas),
    buildRanking(rawAtestados),
    buildRanking(rawAdvertencias),
  ]);

  return NextResponse.json({ rankingAtrasos, rankingFaltas, rankingAtestados, rankingAdvertencias });
}
