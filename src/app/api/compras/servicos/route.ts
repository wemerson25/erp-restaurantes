import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureComprasTables } from "@/lib/compras-setup";
import { randomUUID } from "crypto";

export async function GET() {
  await ensureComprasTables();
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM "RequisicaoServico" ORDER BY createdAt DESC`
  );
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  await ensureComprasTables();
  const body = await req.json();
  const { titulo, descricao, categoria, urgencia, solicitante, restaurante, equipamento, observacoes } = body;

  if (!titulo || !solicitante) {
    return NextResponse.json({ error: "Título e solicitante são obrigatórios" }, { status: 400 });
  }

  const id = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "RequisicaoServico" ("id","titulo","descricao","categoria","urgencia","solicitante","restaurante","equipamento","observacoes")
     VALUES (?,?,?,?,?,?,?,?,?)`,
    id, titulo, descricao ?? "", categoria ?? "MANUTENCAO", urgencia ?? "MEDIA",
    solicitante, restaurante ?? null, equipamento ?? null, observacoes ?? null,
  );

  return NextResponse.json({ id }, { status: 201 });
}
