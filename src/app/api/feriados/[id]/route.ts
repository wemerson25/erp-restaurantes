import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const feriado = await prisma.feriado.update({
    where: { id },
    data: {
      ...(body.nome && { nome: body.nome }),
      ...(body.data && { data: new Date(body.data) }),
      ...(body.tipo && { tipo: body.tipo }),
      ...(body.recorrente !== undefined && { recorrente: body.recorrente }),
    },
  });
  return NextResponse.json(feriado);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const { id } = await params;
  await prisma.feriado.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
