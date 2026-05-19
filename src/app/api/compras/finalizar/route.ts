import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureComprasTables } from "@/lib/compras-setup";
import { getSemanaRef } from "@/lib/calculos-estoque";
import { randomUUID } from "crypto";

export async function POST(req: NextRequest) {
  await ensureComprasTables();
  const { semanaRef, restaurante = "" } = await req.json();
  const semana = semanaRef ?? getSemanaRef();

  // Semana anterior para pegar estoqueInicial
  const semanaAnt = getSemanaRef(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));

  const contagens = await prisma.$queryRawUnsafe<{ produtoId: string; qtdContada: number }[]>(
    `SELECT produtoId, qtdContada FROM "ContagemSemanal" WHERE semanaRef=? AND restaurante=?`,
    semana, restaurante,
  );

  for (const c of contagens) {
    const prev = await prisma.$queryRawUnsafe<{ contagemFim: number }[]>(
      `SELECT contagemFim FROM "HistoricoEstoque" WHERE produtoId=? AND semanaRef=? AND restaurante=?`,
      c.produtoId, semanaAnt, restaurante,
    );
    const estoqueInicial = prev[0]?.contagemFim ?? 0;

    const existing = await prisma.$queryRawUnsafe<{ id: string }[]>(
      `SELECT id FROM "HistoricoEstoque" WHERE produtoId=? AND semanaRef=? AND restaurante=?`,
      c.produtoId, semana, restaurante,
    );

    if (existing.length > 0) {
      await prisma.$executeRawUnsafe(
        `UPDATE "HistoricoEstoque" SET contagemFim=? WHERE id=?`,
        c.qtdContada, existing[0].id,
      );
    } else {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "HistoricoEstoque" ("id","produtoId","semanaRef","restaurante","estoqueInicial","comprasDia","contagemFim")
         VALUES (?,?,?,?,?,0,?)`,
        randomUUID(), c.produtoId, semana, restaurante, estoqueInicial, c.qtdContada,
      );
    }
  }

  return NextResponse.json({ ok: true, semanaRef: semana, itens: contagens.length });
}
