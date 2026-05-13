import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const vagas = await prisma.vaga.findMany({
    where: { status: "ABERTA" },
    select: {
      id: true,
      titulo: true,
      descricao: true,
      requisitos: true,
      salario: true,
      tipoContrato: true,
      createdAt: true,
      restaurante: { select: { nome: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(vagas);
}
