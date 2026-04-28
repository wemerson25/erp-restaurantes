import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const restaurantes = await prisma.restaurante.findMany({
    include: {
      _count: { select: { funcionarios: true } },
    },
    orderBy: { nome: "asc" },
  });

  return NextResponse.json(restaurantes);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const data = await req.json();
  const restaurante = await prisma.restaurante.create({ data });
  return NextResponse.json(restaurante, { status: 201 });
}
