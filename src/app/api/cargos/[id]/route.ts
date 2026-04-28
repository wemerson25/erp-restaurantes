import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const { id } = await params;
  const data = await req.json();
  const cargo = await prisma.cargo.update({
    where: { id },
    data: { ...data, salarioBase: parseFloat(data.salarioBase) },
  });
  return NextResponse.json(cargo);
}
