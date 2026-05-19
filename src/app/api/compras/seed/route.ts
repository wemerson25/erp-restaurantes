import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureComprasTables } from "@/lib/compras-setup";
import { seedProdutos, JACOBINA, CG, DECK } from "@/lib/seed-produtos";

export async function POST() {
  await ensureComprasTables();
  const inserted = await seedProdutos(prisma);
  return NextResponse.json({
    ok: true,
    inserted,
    totais: { jacobina: JACOBINA.length, cg: CG.length, deck: DECK.length },
  });
}

export async function GET() {
  await ensureComprasTables();
  const counts = await prisma.$queryRawUnsafe<{ restaurante: string | null; total: number }[]>(
    `SELECT restaurante, COUNT(*) as total FROM "ProdutoEstoque" WHERE ativo=1 GROUP BY restaurante`,
  );
  return NextResponse.json({ counts: counts.map((r) => ({ restaurante: r.restaurante, total: Number(r.total) })) });
}
