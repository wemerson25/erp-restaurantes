import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureComprasTables } from "@/lib/compras-setup";
import { getSemanaRef } from "@/lib/calculos-estoque";
import { randomUUID } from "crypto";

export async function GET(req: NextRequest) {
  await ensureComprasTables();
  const semana = req.nextUrl.searchParams.get("semana") ?? getSemanaRef();
  const restaurante = req.nextUrl.searchParams.get("restaurante") ?? "";

  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM "ContagemSemanal" WHERE semanaRef=? AND restaurante=?`,
    semana, restaurante,
  );
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  await ensureComprasTables();
  const { produtoId, semanaRef, restaurante = "", qtdContada, qtdDeposito = 0 } = await req.json();

  if (!produtoId) return NextResponse.json({ error: "produtoId obrigatório" }, { status: 400 });
  const semana = semanaRef ?? getSemanaRef();

  // Check if exists
  const existing = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM "ContagemSemanal" WHERE produtoId=? AND semanaRef=? AND restaurante=?`,
    produtoId, semana, restaurante,
  );

  if (existing.length > 0) {
    await prisma.$executeRawUnsafe(
      `UPDATE "ContagemSemanal" SET qtdContada=?, qtdDeposito=?, contadoEm=CURRENT_TIMESTAMP WHERE id=?`,
      qtdContada ?? 0, qtdDeposito, existing[0].id,
    );
  } else {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "ContagemSemanal" ("id","produtoId","semanaRef","restaurante","qtdContada","qtdDeposito")
       VALUES (?,?,?,?,?,?)`,
      randomUUID(), produtoId, semana, restaurante, qtdContada ?? 0, qtdDeposito,
    );
  }

  return NextResponse.json({ ok: true });
}
