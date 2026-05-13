import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ensureGestorTable } from "@/lib/gestor-setup";
import { randomUUID } from "crypto";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  await ensureGestorTable();
  const gestores = await prisma.$queryRawUnsafe<
    { id: string; nome: string; telefone: string; ativo: number }[]
  >(`SELECT id, nome, telefone, ativo FROM "Gestor" ORDER BY nome ASC`);
  return NextResponse.json(gestores.map(g => ({ ...g, ativo: g.ativo === 1 })));
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  await ensureGestorTable();
  const { nome, telefone } = await req.json() as { nome: string; telefone: string };
  if (!nome?.trim() || !telefone?.trim()) {
    return NextResponse.json({ error: "nome e telefone são obrigatórios" }, { status: 400 });
  }
  const id = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "Gestor" ("id","nome","telefone") VALUES (?,?,?)`,
    id, nome.trim(), telefone.trim(),
  );
  return NextResponse.json({ id, nome: nome.trim(), telefone: telefone.trim(), ativo: true }, { status: 201 });
}
