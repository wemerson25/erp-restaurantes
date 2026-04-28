import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const vagas = await prisma.vaga.findMany({
    where: status ? { status } : {},
    include: {
      restaurante: { select: { nome: true } },
      _count: { select: { candidaturas: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(vagas);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const data = await req.json();
  const vaga = await prisma.vaga.create({
    data: { ...data, salario: data.salario ? parseFloat(data.salario) : null },
    include: { restaurante: { select: { nome: true } } },
  });
  return NextResponse.json(vaga, { status: 201 });
}
