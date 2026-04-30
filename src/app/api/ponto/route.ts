import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { calcHoursFromPunches, detectOcorrencia, getCargaDiaria } from "@/lib/schedule";

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

  // Parse work block punches
  const batidas: string[] = (data.batidas ?? []).filter(Boolean);
  let punchDates: Date[] = [];

  if (batidas.length >= 2) {
    punchDates = batidas.map((b) => new Date(b));
  } else {
    // Legacy 4-field format
    const fields = [data.entrada, data.saidaAlmoco, data.retornoAlmoco, data.saida].filter(Boolean);
    punchDates = fields.map((f) => new Date(f));
  }

  const paired = punchDates.length % 2 === 0 ? punchDates : punchDates.slice(0, -1);
  const n = paired.length;

  // Explicit meal break (from form)
  const refeicaoSaida = data.refeicao?.saida ? new Date(data.refeicao.saida) : null;
  const refeicaoRetorno = data.refeicao?.retorno ? new Date(data.refeicao.retorno) : null;

  // Hours: sum all work pairs, subtract meal break if provided
  let horasTrabalhadas = calcHoursFromPunches(paired);
  if (refeicaoSaida && refeicaoRetorno) {
    const mealH = (refeicaoRetorno.getTime() - refeicaoSaida.getTime()) / 3600000;
    horasTrabalhadas = Math.max(0, Math.round((horasTrabalhadas - mealH) * 100) / 100);
  }
  const dataDate = new Date(data.data);
  const funcionario = await prisma.funcionario.findUnique({
    where: { id: data.funcionarioId },
    select: { restaurante: { select: { nome: true } } },
  });
  const carga = getCargaDiaria(funcionario?.restaurante?.nome ?? "", dataDate);
  const horasExtras = Math.max(0, Math.round((horasTrabalhadas - carga) * 100) / 100);

  // DB field mapping
  // entrada = first punch, saida = last punch
  // saidaAlmoco / retornoAlmoco = explicit meal break OR middle-pair boundary
  const entrada = paired[0] ?? null;
  const saida = n >= 2 ? paired[n - 1] : null;
  const saidaAlmoco = refeicaoSaida ?? (n >= 4 ? paired[n - 3] : null);
  const retornoAlmoco = refeicaoRetorno ?? (n >= 4 ? paired[n - 2] : null);
  const ocorrencia = data.ocorrencia && data.ocorrencia !== "NORMAL"
    ? data.ocorrencia
    : detectOcorrencia(entrada ?? undefined, dataDate, horasTrabalhadas, funcionario?.restaurante?.nome ?? "");

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
