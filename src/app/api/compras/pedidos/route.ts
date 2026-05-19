import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureComprasTables } from "@/lib/compras-setup";
import { getSemanaRef, calcularPedido, calcularTrazerDeposito } from "@/lib/calculos-estoque";

export async function GET(req: NextRequest) {
  await ensureComprasTables();
  const semana = req.nextUrl.searchParams.get("semana") ?? getSemanaRef();
  const restaurante = req.nextUrl.searchParams.get("restaurante") ?? "";

  const produtos = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM "ProdutoEstoque" WHERE ativo=1 ORDER BY ordemCategoria, categoria, nome`,
  );

  const contagens = await prisma.$queryRawUnsafe<{ produtoId: string; qtdContada: number; qtdDeposito: number }[]>(
    `SELECT produtoId, qtdContada, qtdDeposito FROM "ContagemSemanal" WHERE semanaRef=? AND restaurante=?`,
    semana, restaurante,
  );

  const contagemMap = Object.fromEntries(contagens.map((c) => [c.produtoId, c]));

  const result = produtos
    .filter((p) => !restaurante || !p.restaurante || p.restaurante === restaurante)
    .map((p) => {
      const id = p.id as string;
      const c = contagemMap[id];
      const contagem = c?.qtdContada ?? 0;
      const deposito = c?.qtdDeposito ?? 0;
      const { qtd, unidadeExibida } = calcularPedido(p as never, contagem, deposito, p.unidade as string);
      const trazer = calcularTrazerDeposito(Number(p.metaSemanal), contagem, deposito);
      return {
        produto: p,
        contagem,
        deposito,
        qtdPedido: qtd,
        unidadeExibida,
        trazerDeposito: trazer,
      };
    });

  return NextResponse.json(result);
}
