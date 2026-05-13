import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ensureGestorTable } from "@/lib/gestor-setup";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  await ensureGestorTable();
  const { id } = await params;
  const { nome, telefone, ativo } = await req.json() as { nome?: string; telefone?: string; ativo?: boolean };
  const parts: string[] = [];
  const values: unknown[] = [];
  if (nome !== undefined)    { parts.push(`"nome" = ?`);    values.push(nome.trim()); }
  if (telefone !== undefined) { parts.push(`"telefone" = ?`); values.push(telefone.trim()); }
  if (ativo !== undefined)   { parts.push(`"ativo" = ?`);   values.push(ativo ? 1 : 0); }
  if (parts.length === 0) return NextResponse.json({ error: "Nada para atualizar" }, { status: 400 });
  parts.push(`"updatedAt" = CURRENT_TIMESTAMP`);
  values.push(id);
  await prisma.$executeRawUnsafe(
    `UPDATE "Gestor" SET ${parts.join(", ")} WHERE "id" = ?`,
    ...values,
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  await ensureGestorTable();
  const { id } = await params;
  await prisma.$executeRawUnsafe(`DELETE FROM "Gestor" WHERE "id" = ?`, id);
  return NextResponse.json({ ok: true });
}
