import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { status, observacoes } = body;

  const updates: string[] = [];
  const values: unknown[] = [];

  if (status) { updates.push('"status"=?'); values.push(status); }
  if (observacoes !== undefined) { updates.push('"observacoes"=?'); values.push(observacoes); }
  updates.push('"updatedAt"=CURRENT_TIMESTAMP');

  if (updates.length === 1) {
    return NextResponse.json({ error: "Nada a atualizar" }, { status: 400 });
  }

  values.push(id);
  await prisma.$executeRawUnsafe(
    `UPDATE "RequisicaoServico" SET ${updates.join(",")} WHERE id=?`,
    ...values,
  );

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.$executeRawUnsafe(`DELETE FROM "RequisicaoServico" WHERE id=?`, id);
  return NextResponse.json({ ok: true });
}
