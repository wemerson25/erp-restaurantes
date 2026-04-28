import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

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
        ? {
            data: {
              gte: new Date(dataInicio),
              lte: new Date(dataFim),
            },
          }
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

  const horasTrabalhadas = calcularHorasTrabalhadas(
    data.entrada,
    data.saidaAlmoco,
    data.retornoAlmoco,
    data.saida
  );

  const horasExtras = Math.max(0, horasTrabalhadas - 8);

  const registro = await prisma.registroPonto.create({
    data: {
      funcionarioId: data.funcionarioId,
      data: new Date(data.data),
      entrada: data.entrada ? new Date(data.entrada) : null,
      saidaAlmoco: data.saidaAlmoco ? new Date(data.saidaAlmoco) : null,
      retornoAlmoco: data.retornoAlmoco ? new Date(data.retornoAlmoco) : null,
      saida: data.saida ? new Date(data.saida) : null,
      horasTrabalhadas,
      horasExtras,
      ocorrencia: data.ocorrencia ?? "NORMAL",
      justificativa: data.justificativa,
    },
    include: {
      funcionario: { select: { nome: true, matricula: true } },
    },
  });

  return NextResponse.json(registro, { status: 201 });
}

function calcularHorasTrabalhadas(
  entrada?: string,
  saidaAlmoco?: string,
  retornoAlmoco?: string,
  saida?: string
): number {
  if (!entrada || !saida) return 0;

  const e = new Date(entrada).getTime();
  const s = new Date(saida).getTime();
  let total = (s - e) / 3600000;

  if (saidaAlmoco && retornoAlmoco) {
    const sa = new Date(saidaAlmoco).getTime();
    const ra = new Date(retornoAlmoco).getTime();
    total -= (ra - sa) / 3600000;
  }

  return Math.max(0, Math.round(total * 100) / 100);
}
