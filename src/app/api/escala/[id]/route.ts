import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ensureEscalaTables } from "@/lib/escala-setup";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;

  try {
    await ensureEscalaTables();

    const body = await req.json();
    const update: Record<string, unknown> = {};
    if (body.turno) update.turno = body.turno;
    if (body.setor) update.setor = body.setor;
    if (body.horarioEntrada !== undefined) update.horarioEntrada = body.horarioEntrada || null;
    if (body.horarioSaida !== undefined) update.horarioSaida = body.horarioSaida || null;
    if (body.observacao !== undefined) update.observacao = body.observacao || null;

    const schedule = await prisma.schedule.update({ where: { id }, data: update });
    return NextResponse.json(schedule);
  } catch (e) {
    return NextResponse.json({ error: "Erro ao atualizar entrada", detail: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;

  try {
    await ensureEscalaTables();
    await prisma.schedule.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: "Erro ao excluir entrada", detail: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
