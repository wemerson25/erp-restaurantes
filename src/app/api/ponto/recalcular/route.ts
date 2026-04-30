import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { detectOcorrencia, calcHoursFromPunches, getCargaDiaria } from "@/lib/schedule";

// Ocorrencias that are manually set and must never be overwritten by auto-detection
const PRESERVE_OCORRENCIA = new Set(["FOLGA", "FALTA"]);

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { funcionarioId, month } = await req.json() as { funcionarioId: string; month?: string };
  if (!funcionarioId) return NextResponse.json({ error: "funcionarioId obrigatório" }, { status: 400 });

  let dataFilter: { gte: Date; lte: Date } | undefined;
  if (month) {
    const [y, m] = month.split("-").map(Number);
    dataFilter = { gte: new Date(y, m - 1, 1), lte: new Date(y, m, 0, 23, 59, 59) };
  }

  const registros = await prisma.registroPonto.findMany({
    where: { funcionarioId, ...(dataFilter ? { data: dataFilter } : {}) },
    include: { funcionario: { select: { restaurante: { select: { nome: true } } } } },
  });

  let updated = 0;
  for (const rec of registros) {
    // Records without entrada (FOLGA, FALTA, etc.) have nothing to recalculate
    if (!rec.entrada) continue;

    // Never auto-overwrite manually assigned non-punch ocorrencias
    if (rec.ocorrencia && PRESERVE_OCORRENCIA.has(rec.ocorrencia)) continue;

    const punches: Date[] = [rec.entrada];
    if (rec.saidaAlmoco) punches.push(rec.saidaAlmoco);
    if (rec.retornoAlmoco) punches.push(rec.retornoAlmoco);
    if (rec.saida) punches.push(rec.saida);

    const horasTrabalhadas = calcHoursFromPunches(punches);
    const carga = getCargaDiaria(rec.funcionario.restaurante.nome, rec.data);
    const horasExtras = Math.max(0, Math.round((horasTrabalhadas - carga) * 100) / 100);
    const ocorrencia = detectOcorrencia(rec.entrada, rec.data, horasTrabalhadas);

    await prisma.registroPonto.update({
      where: { id: rec.id },
      data: { horasTrabalhadas, horasExtras, ocorrencia },
    });
    updated++;
  }

  return NextResponse.json({ updated });
}
