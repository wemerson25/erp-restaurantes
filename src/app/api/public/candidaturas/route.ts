import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const data = await req.json() as {
    vagaId: string; nome: string; email: string; telefone: string; cpf: string; observacoes?: string;
  };

  if (!data.vagaId || !data.nome || !data.email || !data.telefone || !data.cpf) {
    return NextResponse.json({ error: "Preencha todos os campos obrigatórios" }, { status: 400 });
  }

  const vaga = await prisma.vaga.findFirst({ where: { id: data.vagaId, status: "ABERTA" } });
  if (!vaga) return NextResponse.json({ error: "Vaga não encontrada ou encerrada" }, { status: 404 });

  const candidatura = await prisma.candidatura.create({
    data: {
      vagaId: data.vagaId,
      nome: data.nome.trim(),
      email: data.email.trim().toLowerCase(),
      telefone: data.telefone.trim(),
      cpf: data.cpf.replace(/\D/g, ""),
      observacoes: data.observacoes?.trim() || null,
    },
  });

  return NextResponse.json({ ok: true, id: candidatura.id }, { status: 201 });
}
