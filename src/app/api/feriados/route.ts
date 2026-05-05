import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  const feriados = await prisma.feriado.findMany({ orderBy: [{ recorrente: "desc" }, { data: "asc" }] });
  return NextResponse.json(feriados);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  try {
    const { nome, data, tipo, recorrente } = await req.json();
    if (!nome || !data) return NextResponse.json({ error: "Nome e data são obrigatórios" }, { status: 400 });
    const feriado = await prisma.feriado.create({
      data: { nome, data: new Date(data), tipo: tipo ?? "NACIONAL", recorrente: recorrente ?? true },
    });
    return NextResponse.json(feriado, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: "Erro ao criar feriado", detail: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
