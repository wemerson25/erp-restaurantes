import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const allowed = [
    "nome", "categoria", "unidade", "quantidadeAtual", "quantidadeMinima",
    "metaSemanal", "qtdPorPacote", "ilimitado", "sacaThresholdCheia", "sacaThresholdMeia",
    "restaurante", "ordemCategoria", "ativo", "setor",
  ];

  const updates: string[] = [];
  const values: unknown[] = [];

  for (const key of allowed) {
    if (body[key] !== undefined) {
      updates.push(`"${key}"=?`);
      values.push(key === "ilimitado" ? (body[key] ? 1 : 0) : body[key]);
    }
  }

  if (updates.length === 0) return NextResponse.json({ error: "Nada a atualizar" }, { status: 400 });

  updates.push('"updatedAt"=CURRENT_TIMESTAMP');
  values.push(id);

  await prisma.$executeRawUnsafe(
    `UPDATE "ProdutoEstoque" SET ${updates.join(",")} WHERE id=?`,
    ...values,
  );

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Soft delete
  await prisma.$executeRawUnsafe(`UPDATE "ProdutoEstoque" SET ativo=0, "updatedAt"=CURRENT_TIMESTAMP WHERE id=?`, id);
  return NextResponse.json({ ok: true });
}
