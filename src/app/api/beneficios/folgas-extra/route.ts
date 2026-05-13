import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ensureBeneficioExtraTable } from "@/lib/beneficio-extra-setup";
import { randomUUID } from "crypto";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    await ensureBeneficioExtraTable();

    const { searchParams } = new URL(req.url);
    const restauranteId = searchParams.get("restauranteId");

    const rows = await prisma.$queryRawUnsafe<
      {
        id: string; funcionarioId: string; nome: string; cargo: string; restaurante: string;
        motivo: string; dataConcessao: string; dataValidade: string | null;
        dataUso: string | null; status: string; observacoes: string | null; createdAt: string;
      }[]
    >(
      restauranteId
        ? `SELECT fb.id, fb.funcionarioId, fn.nome, c.nome as cargo, r.nome as restaurante,
                  fb.motivo, fb.dataConcessao, fb.dataValidade, fb.dataUso, fb.status, fb.observacoes, fb.createdAt
           FROM "FolgaBeneficioExtra" fb
           JOIN "Funcionario" fn ON fn.id = fb.funcionarioId
           JOIN "Cargo" c ON c.id = fn.cargoId
           JOIN "Restaurante" r ON r.id = fn.restauranteId
           WHERE fn.restauranteId = ? AND fn.status = 'ATIVO'
           ORDER BY fb.createdAt DESC`
        : `SELECT fb.id, fb.funcionarioId, fn.nome, c.nome as cargo, r.nome as restaurante,
                  fb.motivo, fb.dataConcessao, fb.dataValidade, fb.dataUso, fb.status, fb.observacoes, fb.createdAt
           FROM "FolgaBeneficioExtra" fb
           JOIN "Funcionario" fn ON fn.id = fb.funcionarioId
           JOIN "Cargo" c ON c.id = fn.cargoId
           JOIN "Restaurante" r ON r.id = fn.restauranteId
           ORDER BY fb.createdAt DESC`,
      ...(restauranteId ? [restauranteId] : []),
    );

    return NextResponse.json(rows);
  } catch (e) {
    return NextResponse.json({ error: "Erro ao buscar folgas", detail: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    await ensureBeneficioExtraTable();

    const { funcionarioId, motivo, dataConcessao, dataValidade, observacoes } = await req.json();

    if (!funcionarioId || !motivo || !dataConcessao)
      return NextResponse.json({ error: "Campos obrigatórios: funcionarioId, motivo, dataConcessao" }, { status: 400 });

    const id = randomUUID();
    const now = new Date().toISOString();

    await prisma.$executeRawUnsafe(
      `INSERT INTO "FolgaBeneficioExtra" (id, funcionarioId, motivo, dataConcessao, dataValidade, status, observacoes, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, 'DISPONIVEL', ?, ?, ?)`,
      id, funcionarioId, motivo,
      new Date(`${dataConcessao}T12:00:00Z`).toISOString(),
      dataValidade ? new Date(`${dataValidade}T12:00:00Z`).toISOString() : null,
      observacoes || null, now, now,
    );

    return NextResponse.json({ id, ok: true }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: "Erro ao criar folga", detail: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
