import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureComprasTables } from "@/lib/compras-setup";
import { randomUUID } from "crypto";

export async function GET() {
  await ensureComprasTables();
  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT r.*, (
      SELECT json_group_array(json_object(
        'id', i.id, 'nome', i.nome, 'quantidade', i.quantidade, 'unidade', i.unidade, 'precoEstimado', i.precoEstimado
      )) FROM "ItemRequisicao" i WHERE i.requisicaoId = r.id
    ) as itensJson
    FROM "RequisicaoCompra" r ORDER BY r.createdAt DESC`
  );
  const result = rows.map((r) => ({
    ...r,
    itens: JSON.parse((r.itensJson as string) ?? "[]"),
    itensJson: undefined,
  }));
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  await ensureComprasTables();
  const body = await req.json();
  const { titulo, descricao, categoria, urgencia, solicitante, restaurante, observacoes, itens } = body;

  if (!titulo || !solicitante) {
    return NextResponse.json({ error: "Título e solicitante são obrigatórios" }, { status: 400 });
  }

  const id = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "RequisicaoCompra" ("id","titulo","descricao","categoria","urgencia","solicitante","restaurante","observacoes")
     VALUES (?,?,?,?,?,?,?,?)`,
    id, titulo, descricao ?? "", categoria ?? "OUTROS", urgencia ?? "MEDIA",
    solicitante, restaurante ?? null, observacoes ?? null,
  );

  if (Array.isArray(itens)) {
    for (const item of itens) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "ItemRequisicao" ("id","requisicaoId","nome","quantidade","unidade","precoEstimado")
         VALUES (?,?,?,?,?,?)`,
        randomUUID(), id, item.nome, item.quantidade ?? 1, item.unidade ?? "un", item.precoEstimado ?? null,
      );
    }
  }

  return NextResponse.json({ id }, { status: 201 });
}
