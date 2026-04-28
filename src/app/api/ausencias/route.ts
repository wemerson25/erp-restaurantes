import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const tipo = searchParams.get("tipo");
  const funcionarioId = searchParams.get("funcionarioId");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (tipo) where.tipo = tipo;
  if (funcionarioId) where.funcionarioId = funcionarioId;

  const ausencias = await prisma.ausencia.findMany({
    where,
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
    orderBy: { dataInicio: "desc" },
  });

  return NextResponse.json(ausencias);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    const data = await req.json();

    if (!data.funcionarioId) {
      return NextResponse.json({ error: "Funcionário é obrigatório" }, { status: 400 });
    }
    if (!data.dataInicio || !data.dataFim) {
      return NextResponse.json({ error: "Datas de início e fim são obrigatórias" }, { status: 400 });
    }

    const dataInicio = new Date(data.dataInicio);
    const dataFim = new Date(data.dataFim);

    if (isNaN(dataInicio.getTime()) || isNaN(dataFim.getTime())) {
      return NextResponse.json({ error: "Datas inválidas" }, { status: 400 });
    }
    if (dataFim < dataInicio) {
      return NextResponse.json({ error: "Data fim deve ser após data início" }, { status: 400 });
    }

    const diasAfastamento = Math.ceil((dataFim.getTime() - dataInicio.getTime()) / 86400000) + 1;

    const ausencia = await prisma.ausencia.create({
      data: {
        funcionarioId: data.funcionarioId,
        tipo: data.tipo,
        dataInicio,
        dataFim,
        diasAfastamento,
        motivo: data.motivo || null,
        descricao: data.descricao || null,
        status: data.status || "PENDENTE",
        observacoes: data.observacoes || null,
      },
      include: {
        funcionario: { select: { nome: true, matricula: true } },
      },
    });

    return NextResponse.json(ausencia, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    console.error("[POST /api/ausencias]", e);
    return NextResponse.json({ error: "Erro ao registrar afastamento", detail: msg }, { status: 500 });
  }
}
