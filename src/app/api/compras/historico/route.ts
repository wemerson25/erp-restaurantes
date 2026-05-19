import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureComprasTables } from "@/lib/compras-setup";
import { calcularUsoReal, calcularMedias, divergeMetaSemanal } from "@/lib/calculos-estoque";

export async function GET(req: NextRequest) {
  await ensureComprasTables();
  const produtoId = req.nextUrl.searchParams.get("produtoId");
  const restaurante = req.nextUrl.searchParams.get("restaurante") ?? "";
  const semanas = Math.min(parseInt(req.nextUrl.searchParams.get("semanas") ?? "8"), 52);

  if (produtoId) {
    // Single product — return history + medias
    const historicos = await prisma.$queryRawUnsafe<{ id: string; semanaRef: string; estoqueInicial: number; comprasDia: number; contagemFim: number }[]>(
      `SELECT * FROM "HistoricoEstoque" WHERE produtoId=? AND restaurante=? ORDER BY semanaRef DESC LIMIT ?`,
      produtoId, restaurante, semanas,
    );
    const produto = await prisma.$queryRawUnsafe<{ metaSemanal: number }[]>(
      `SELECT metaSemanal FROM "ProdutoEstoque" WHERE id=?`,
      produtoId,
    );
    const rows = historicos.map((h) => ({ ...h, usoReal: calcularUsoReal(h) }));
    const medias = calcularMedias(historicos.slice(0, 4));
    const alerta = divergeMetaSemanal(historicos.slice(0, 4), produto[0]?.metaSemanal ?? 0);
    return NextResponse.json({ historicos: rows, medias, alerta });
  }

  // All products summary (last 4 weeks)
  const produtos = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM "ProdutoEstoque" WHERE ativo=1 ORDER BY ordemCategoria, categoria, nome`,
  );

  const result = [];
  for (const p of produtos) {
    const historicos = await prisma.$queryRawUnsafe<{ estoqueInicial: number; comprasDia: number; contagemFim: number; semanaRef: string }[]>(
      `SELECT estoqueInicial, comprasDia, contagemFim, semanaRef FROM "HistoricoEstoque"
       WHERE produtoId=? AND restaurante=? ORDER BY semanaRef DESC LIMIT 4`,
      p.id, restaurante,
    );
    const medias = calcularMedias(historicos);
    const alerta = divergeMetaSemanal(historicos, Number(p.metaSemanal));
    result.push({ ...p, medias, alerta, historicos: historicos.map((h) => ({ ...h, usoReal: calcularUsoReal(h) })) });
  }

  return NextResponse.json(result);
}
