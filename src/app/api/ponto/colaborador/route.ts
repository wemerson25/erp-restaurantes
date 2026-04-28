import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const funcionarioId = searchParams.get("funcionarioId");
  const month = searchParams.get("month"); // YYYY-MM

  if (!funcionarioId || !month) {
    return NextResponse.json({ error: "Parâmetros obrigatórios" }, { status: 400 });
  }

  const [year, mon] = month.split("-").map(Number);
  const dataInicio = new Date(year, mon - 1, 1);
  const dataFim = new Date(year, mon, 0, 23, 59, 59);

  const [funcionario, registros, ausencias, ferias] = await Promise.all([
    prisma.funcionario.findUnique({
      where: { id: funcionarioId },
      select: {
        id: true,
        nome: true,
        matricula: true,
        cargo: { select: { nome: true } },
        restaurante: { select: { nome: true } },
      },
    }),
    prisma.registroPonto.findMany({
      where: { funcionarioId, data: { gte: dataInicio, lte: dataFim } },
      orderBy: { data: "asc" },
    }),
    prisma.ausencia.findMany({
      where: {
        funcionarioId,
        dataInicio: { lte: dataFim },
        dataFim: { gte: dataInicio },
      },
      orderBy: { dataInicio: "asc" },
    }),
    prisma.ferias.findMany({
      where: {
        funcionarioId,
        dataInicio: { lte: dataFim },
        dataFim: { gte: dataInicio },
      },
      orderBy: { dataInicio: "asc" },
    }),
  ]);

  if (!funcionario) {
    return NextResponse.json({ error: "Funcionário não encontrado" }, { status: 404 });
  }

  return NextResponse.json({ funcionario, registros, ausencias, ferias });
}
