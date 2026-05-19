import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureComprasTables } from "@/lib/compras-setup";
import { randomUUID } from "crypto";

export async function GET() {
  await ensureComprasTables();
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM "ProdutoEstoque" WHERE ativo=1 ORDER BY ordemCategoria, categoria, nome`,
  );
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  await ensureComprasTables();
  const body = await req.json();
  const {
    nome, categoria, unidade, quantidadeAtual, quantidadeMinima,
    metaSemanal, qtdPorPacote, ilimitado, sacaThresholdCheia, sacaThresholdMeia,
    restaurante, ordemCategoria,
  } = body;

  if (!nome) return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 });

  const id = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "ProdutoEstoque"
       ("id","nome","categoria","unidade","quantidadeAtual","quantidadeMinima",
        "metaSemanal","qtdPorPacote","ilimitado","sacaThresholdCheia","sacaThresholdMeia",
        "restaurante","ordemCategoria")
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    id,
    nome,
    categoria ?? "GERAL",
    unidade ?? "un",
    quantidadeAtual ?? 0,
    quantidadeMinima ?? 0,
    metaSemanal ?? 0,
    qtdPorPacote ?? 1,
    ilimitado ? 1 : 0,
    sacaThresholdCheia ?? null,
    sacaThresholdMeia ?? null,
    restaurante ?? null,
    ordemCategoria ?? 0,
  );

  return NextResponse.json({ id }, { status: 201 });
}
