import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;

  try {
    const data = await req.json();

    const update: Record<string, unknown> = {};
    if (data.funcionarioId) update.funcionarioId = data.funcionarioId;
    if (data.tipo) update.tipo = data.tipo;
    if (data.motivo !== undefined) update.motivo = data.motivo || null;
    if (data.descricao !== undefined) update.descricao = data.descricao || null;
    if (data.status) update.status = data.status;
    if (data.observacoes !== undefined) update.observacoes = data.observacoes || null;

    if (data.dataInicio && data.dataFim) {
      const dataInicio = new Date(data.dataInicio);
      const dataFim = new Date(data.dataFim);
      if (isNaN(dataInicio.getTime()) || isNaN(dataFim.getTime())) {
        return NextResponse.json({ error: "Datas inválidas" }, { status: 400 });
      }
      if (dataFim < dataInicio) {
        return NextResponse.json({ error: "Data fim deve ser após data início" }, { status: 400 });
      }
      update.dataInicio = dataInicio;
      update.dataFim = dataFim;
      update.diasAfastamento = Math.ceil((dataFim.getTime() - dataInicio.getTime()) / 86400000) + 1;
    }

    const ausencia = await prisma.ausencia.update({
      where: { id },
      data: update,
      include: {
        funcionario: { select: { nome: true, matricula: true } },
      },
    });

    return NextResponse.json(ausencia);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro interno";
    console.error("[PUT /api/ausencias]", msg);
    return NextResponse.json({ error: "Erro ao atualizar afastamento" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;
  await prisma.ausencia.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
