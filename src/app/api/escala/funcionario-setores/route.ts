import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ensureEscalaTables } from "@/lib/escala-setup";
import { randomUUID } from "crypto";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  try {
    await ensureEscalaTables();
    const { searchParams } = new URL(req.url);
    const restauranteId = searchParams.get("restauranteId");
    if (!restauranteId)
      return NextResponse.json({ error: "restauranteId obrigatório" }, { status: 400 });
    const rows = await prisma.funcionarioSetor.findMany({
      where: { funcionario: { restauranteId } },
      select: { funcionarioId: true, setor: true },
    });
    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: "Erro", detail: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  try {
    await ensureEscalaTables();
    const { funcionarioId, setor, ativo } = await req.json();
    if (!funcionarioId || !setor)
      return NextResponse.json({ error: "funcionarioId e setor obrigatórios" }, { status: 400 });

    if (ativo) {
      await prisma.$executeRawUnsafe(
        `INSERT OR IGNORE INTO "FuncionarioSetor" (id, funcionarioId, setor, createdAt) VALUES (?, ?, ?, ?)`,
        randomUUID(), funcionarioId, setor, new Date().toISOString(),
      );
    } else {
      await prisma.funcionarioSetor.deleteMany({ where: { funcionarioId, setor } });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: "Erro", detail: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
