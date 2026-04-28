import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const cargos = await prisma.cargo.findMany({
    include: { _count: { select: { funcionarios: true } } },
    orderBy: { nome: "asc" },
  });

  return NextResponse.json(cargos);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const data = await req.json();
  const cargo = await prisma.cargo.create({
    data: { ...data, salarioBase: parseFloat(data.salarioBase) },
  });
  return NextResponse.json(cargo, { status: 201 });
}
