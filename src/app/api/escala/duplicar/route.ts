import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ensureEscalaTables } from "@/lib/escala-setup";
import { randomUUID } from "crypto";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    await ensureEscalaTables();

    const { restauranteId, sourceSemana, targetSemana } = await req.json();
    if (!restauranteId || !sourceSemana || !targetSemana)
      return NextResponse.json({ error: "restauranteId, sourceSemana e targetSemana são obrigatórios" }, { status: 400 });

    const srcInicio = new Date(`${sourceSemana}T00:00:00Z`);
    const srcFim = new Date(srcInicio);
    srcFim.setUTCDate(srcFim.getUTCDate() + 6);
    srcFim.setUTCHours(23, 59, 59, 999);

    const tgtInicio = new Date(`${targetSemana}T00:00:00Z`);
    const diffMs = tgtInicio.getTime() - srcInicio.getTime();

    const source = await prisma.schedule.findMany({
      where: { restauranteId, data: { gte: srcInicio, lte: srcFim } },
    });

    if (source.length === 0)
      return NextResponse.json({ ok: true, copied: 0 });

    // Delete existing entries in target week
    const tgtFim = new Date(tgtInicio);
    tgtFim.setUTCDate(tgtFim.getUTCDate() + 6);
    tgtFim.setUTCHours(23, 59, 59, 999);
    await prisma.schedule.deleteMany({ where: { restauranteId, data: { gte: tgtInicio, lte: tgtFim } } });

    // Batch insert — 70 rows × 12 params = 840 < 999 LibSQL limit
    const BATCH = 70;
    const now = new Date().toISOString();

    for (let i = 0; i < source.length; i += BATCH) {
      const chunk = source.slice(i, i + BATCH);
      const placeholders = chunk.map(() => "(?,?,?,?,?,?,?,?,?,?,?,?)").join(",");
      const values: unknown[] = [];
      for (const s of chunk) {
        const newDate = new Date(s.data.getTime() + diffMs);
        values.push(
          randomUUID(),
          s.funcionarioId,
          s.restauranteId,
          newDate.toISOString(),
          s.setor,
          s.turno,
          s.horarioEntrada ?? null,
          s.horarioSaida ?? null,
          s.observacao ?? null,
          "PLANEJADA",
          now,
          now,
        );
      }
      await prisma.$executeRawUnsafe(
        `INSERT INTO "Schedule" (id, funcionarioId, restauranteId, data, setor, turno, horarioEntrada, horarioSaida, observacao, status, createdAt, updatedAt) VALUES ${placeholders}`,
        ...values,
      );
    }

    return NextResponse.json({ ok: true, copied: source.length });
  } catch (e) {
    return NextResponse.json({ error: "Erro ao duplicar semana", detail: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
