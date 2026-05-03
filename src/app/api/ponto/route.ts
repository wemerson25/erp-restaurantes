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

  const body = await req.json();
  const toDate = (v: unknown) => (v ? new Date(v as string) : null);

  const dataDate = new Date(body.data);
  const e1 = toDate(body.entrada);
  const s1 = toDate(body.saida1);
  const e2 = toDate(body.entrada2);
  const s2 = toDate(body.saidaAlmoco);
  const e3 = toDate(body.retornoAlmoco);
  const s3 = toDate(body.saida);

  const punches = [e1, s1, e2, s2, e3, s3].filter((d): d is Date => d !== null);
  const horasTrabalhadas = calcHoursFromPunches(punches);

  const funcionario = await prisma.funcionario.findUnique({
    where: { id: body.funcionarioId },
    select: { restaurante: { select: { nome: true } } },
  });
  const restauranteNome = funcionario?.restaurante?.nome ?? "";
  const carga = getCargaDiaria(restauranteNome, dataDate);
  const horasExtras = Math.max(0, Math.round((horasTrabalhadas - carga) * 100) / 100);
  const ocorrencia = body.ocorrencia && body.ocorrencia !== "NORMAL"
    ? body.ocorrencia
    : detectOcorrencia(e1 ?? undefined, dataDate, horasTrabalhadas, restauranteNome);

  const registro = await prisma.registroPonto.create({
    data: {
      funcionarioId: body.funcionarioId,
      data: dataDate,
      entrada: e1,
      saida1: s1,
      entrada2: e2,
      saidaAlmoco: s2,
      retornoAlmoco: e3,
      saida: s3,
      horasTrabalhadas,
      horasExtras,
      ocorrencia,
      justificativa: body.justificativa,
    },
    include: {
      funcionario: { select: { nome: true, matricula: true } },
    },
  });

  return NextResponse.json(registro, { status: 201 });
}
