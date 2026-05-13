import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ensureEscalaTables } from "@/lib/escala-setup";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    await ensureEscalaTables();
    const { searchParams } = new URL(req.url);
    const restauranteId = searchParams.get("restauranteId");
    if (!restauranteId)
      return NextResponse.json({ error: "restauranteId é obrigatório" }, { status: 400 });

    const requisitos = await prisma.scheduleRequirement.findMany({ where: { restauranteId } });
    return NextResponse.json(requisitos);
  } catch (e) {
    return NextResponse.json({ error: "Erro ao buscar requisitos", detail: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    await ensureEscalaTables();
    const { restauranteId, setor, turno, minimoFuncionarios } = await req.json();
    if (!restauranteId || !setor || !turno)
      return NextResponse.json({ error: "restauranteId, setor e turno são obrigatórios" }, { status: 400 });

    const req2 = await prisma.scheduleRequirement.upsert({
      where: { restauranteId_setor_turno: { restauranteId, setor, turno } },
      create: { restauranteId, setor, turno, minimoFuncionarios: minimoFuncionarios ?? 1 },
      update: { minimoFuncionarios: minimoFuncionarios ?? 1 },
    });

    return NextResponse.json(req2);
  } catch (e) {
    return NextResponse.json({ error: "Erro ao salvar requisito", detail: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
