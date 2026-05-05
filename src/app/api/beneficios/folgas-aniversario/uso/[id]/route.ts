import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;
  const uso = await prisma.usoFolgaAniversario.findUnique({
    where: { id },
    include: { folgaAniversario: true },
  });
  if (!uso) return NextResponse.json({ error: "Registro não encontrado" }, { status: 404 });

  const dateStr = uso.data.toISOString().slice(0, 10);

  await prisma.$transaction([
    prisma.usoFolgaAniversario.delete({ where: { id } }),
    prisma.folgaAniversario.update({
      where: { id: uso.folgaAniversarioId },
      data: { folgasUsadas: { decrement: 1 } },
    }),
  ]);

  // Remove the FOLGA_B ponto record for that date
  await prisma.registroPonto.deleteMany({
    where: {
      funcionarioId: uso.folgaAniversario.funcionarioId,
      data: new Date(`${dateStr}T00:00:00`),
      ocorrencia: "FOLGA_B",
    },
  });

  return NextResponse.json({ ok: true });
}
