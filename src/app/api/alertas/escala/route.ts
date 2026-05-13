import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { sendWhatsAppImage } from "@/lib/whatsapp";
import { generateEscalaImage } from "@/lib/escala-image";
import { ensureEscalaTables } from "@/lib/escala-setup";

export const maxDuration = 60;

function fmtDate(d: Date) {
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit" });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    await ensureEscalaTables();

    const { semanaInicio, restauranteId, gestorTelefone } = await req.json() as {
      semanaInicio: string;
      restauranteId?: string;
      gestorTelefone?: string;
    };

    if (!semanaInicio) return NextResponse.json({ error: "semanaInicio obrigatório (YYYY-MM-DD)" }, { status: 400 });
    if (!gestorTelefone) return NextResponse.json({ error: "Selecione um gestor para receber a escala" }, { status: 400 });

    const inicio = new Date(`${semanaInicio}T00:00:00Z`);
    const fim    = new Date(inicio); fim.setUTCDate(fim.getUTCDate() + 6); fim.setUTCHours(23, 59, 59, 999);

    const schedules = await prisma.schedule.findMany({
      where: {
        data: { gte: inicio, lte: fim },
        ...(restauranteId ? { restauranteId } : {}),
      },
      include: {
        funcionario: { select: { nome: true } },
        restaurante: { select: { nome: true } },
      },
      orderBy: [{ setor: "asc" }, { funcionario: { nome: "asc" } }],
    });

    if (schedules.length === 0) {
      return NextResponse.json({ ok: true, enviados: 0, erros: [], message: "Nenhuma escala cadastrada para esta semana" });
    }

    // Build 7-day array Mon → Sun
    const dias: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(inicio); d.setUTCDate(d.getUTCDate() + i);
      dias.push(d.toISOString().slice(0, 10));
    }

    const semanaLabel = `${fmtDate(inicio)} a ${fmtDate(fim)}`;
    const restauranteNome = schedules[0]?.restaurante.nome ?? "";

    // Convert to image-friendly format
    const imageSchedules = schedules.map(s => ({
      funcionarioNome: s.funcionario.nome,
      setor: s.setor,
      data: s.data.toISOString().slice(0, 10),
      turno: s.turno,
    }));

    // Generate PNG
    const imgBuffer = await generateEscalaImage(imageSchedules, dias, semanaLabel, restauranteNome);

    // Send via Z-API
    const r = await sendWhatsAppImage(
      gestorTelefone,
      imgBuffer,
      `Escala Semanal — ${semanaLabel}`,
    );

    if (!r.ok) {
      return NextResponse.json({ ok: false, enviados: 0, erros: [r.error ?? "Falha ao enviar imagem"] });
    }

    const total = new Set(schedules.map(s => s.funcionarioId ?? s.funcionario.nome)).size;
    return NextResponse.json({ ok: true, enviados: 1, semTelefone: 0, erros: [], total });
  } catch (e) {
    return NextResponse.json({
      error: "Erro ao enviar escala",
      detail: e instanceof Error ? e.message : String(e),
    }, { status: 500 });
  }
}
