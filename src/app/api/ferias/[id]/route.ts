import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;
  const data = await req.json();

  const update: Record<string, unknown> = {};
  if (data.status) update.status = data.status;
  if (data.observacoes !== undefined) update.observacoes = data.observacoes;
  if (data.diasVendidos !== undefined) update.diasVendidos = Math.max(0, Number(data.diasVendidos) || 0);
  if (data.dataInicio) {
    const dataInicio = new Date(data.dataInicio);
    const dataFim = new Date(data.dataFim);
    const diasCorridos = Math.ceil((dataFim.getTime() - dataInicio.getTime()) / 86400000) + 1;
    update.dataInicio = dataInicio;
    update.dataFim = dataFim;
    update.diasCorridos = diasCorridos;
    if (data.diasVendidos !== undefined) {
      update.diasVendidos = Math.max(0, Math.min(Math.floor(diasCorridos / 3), Number(data.diasVendidos) || 0));
    }
  }

  const ferias = await prisma.ferias.update({
    where: { id },
    data: update,
    include: { funcionario: { select: { nome: true, matricula: true } } },
  });

  return NextResponse.json(ferias);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;
  await prisma.ferias.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
