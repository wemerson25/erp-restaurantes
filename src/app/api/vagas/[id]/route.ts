import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;
  const data = await req.json();

  const vaga = await prisma.vaga.update({
    where: { id },
    data: {
      titulo: data.titulo,
      descricao: data.descricao,
      requisitos: data.requisitos,
      salario: data.salario ? parseFloat(data.salario) : null,
      tipoContrato: data.tipoContrato,
      status: data.status,
    },
    include: { restaurante: { select: { nome: true } } },
  });

  return NextResponse.json(vaga);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;
  await prisma.vaga.update({ where: { id }, data: { status: "FECHADA" } });
  return NextResponse.json({ ok: true });
}
