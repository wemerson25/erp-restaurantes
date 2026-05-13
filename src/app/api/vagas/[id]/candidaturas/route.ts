import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;

  const vaga = await prisma.vaga.findUnique({
    where: { id },
    include: { restaurante: { select: { nome: true } } },
  });
  if (!vaga) return NextResponse.json({ error: "Vaga não encontrada" }, { status: 404 });

  const candidaturas = await prisma.candidatura.findMany({
    where: { vagaId: id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ vaga, candidaturas });
}
