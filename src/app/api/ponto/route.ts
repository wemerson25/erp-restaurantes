import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { calcHoursFromPunches, detectOcorrencia } from "@/lib/schedule";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const funcionarioId = searchParams.get("funcionarioId");
  const dataInicio = searchParams.get("dataInicio");
  const dataFim = searchParams.get("dataFim");

  const registros = await prisma.registroPonto.findMany({
    where: {
      ...(funcionarioId ? { funcionarioId } : {}),
      ...(dataInicio && dataFim
        ? { data: { gte: new Date(dataInicio), lte: new Date(dataFim) } }
        : {}),
    },
    include: {
      funcionario: {
        select: {
          nome: true,
          matricula: true,
          cargo: { select: { nome: true } },
          restaurante: { select: { nome: true } },
        },
      },
    },
    orderBy: { data: "desc" },
  });

  return NextResponse.json(registros);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const data = await req.json();

  // New format: batidas[] = ISO datetime strings (1 per punch)
  const batidas: string[] = (data.batidas ?? []).filter(Boolean);

  let punchDates: Date[] = [];
  let entrada: Date | null = null;
  let saidaAlmoco: Date | null = null;
  let retornoAlmoco: Date | null = null;
  let saida: Date | null = null;

  if (batidas.length >= 2) {
    punchDates = batidas.map((b) => new Date(b));
    entrada = punchDates[0];
    saidaAlmoco = punchDates[1] ?? null;
    retornoAlmoco = punchDates.length >= 4 ? punchDates[punchDates.length - 2] : null;
    saida = punchDates[punchDates.length - 1];
  } else {
    // Legacy 4-field format
    entrada = data.entrada ? new Date(data.entrada) : null;
    saidaAlmoco = data.saidaAlmoco ? new Date(data.saidaAlmoco) : null;
    retornoAlmoco = data.retornoAlmoco ? new Date(data.retornoAlmoco) : null;
    saida = data.saida ? new Date(data.saida) : null;
    punchDates = [entrada, saidaAlmoco, retornoAlmoco, saida].filter(Boolean) as Date[];
  }

  // Ensure even number of punches for correct calculation
  const paired = punchDates.length % 2 === 0 ? punchDates : punchDates.slice(0, -1);
  const horasTrabalhadas = calcHoursFromPunches(paired);
  const horasExtras = Math.max(0, horasTrabalhadas - 8);

  const dataDate = new Date(data.data);
  const ocorrencia = data.ocorrencia && data.ocorrencia !== "NORMAL"
    ? data.ocorrencia
    : detectOcorrencia(entrada ?? undefined, dataDate, horasTrabalhadas);

  const registro = await prisma.registroPonto.create({
    data: {
      funcionarioId: data.funcionarioId,
      data: dataDate,
      entrada,
      saidaAlmoco,
      retornoAlmoco,
      saida,
      horasTrabalhadas,
      horasExtras,
      ocorrencia,
      justificativa: data.justificativa,
    },
    include: {
      funcionario: { select: { nome: true, matricula: true } },
    },
  });

  return NextResponse.json(registro, { status: 201 });
}
