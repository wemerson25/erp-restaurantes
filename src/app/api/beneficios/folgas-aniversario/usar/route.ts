import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { validateFolgaDay } from "@/lib/feriados";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    const { folgaAniversarioId, data: dateStr } = await req.json();
    if (!folgaAniversarioId || !dateStr)
      return NextResponse.json({ error: "folgaAniversarioId e data são obrigatórios" }, { status: 400 });

    const benefit = await prisma.folgaAniversario.findUnique({
      where: { id: folgaAniversarioId },
      include: { usos: true },
    });
    if (!benefit) return NextResponse.json({ error: "Benefício não encontrado" }, { status: 404 });

    const today = new Date();
    if (new Date(benefit.dataValidade) <= today)
      return NextResponse.json({ error: "Benefício expirado" }, { status: 400 });
    if (benefit.folgasUsadas >= 2)
      return NextResponse.json({ error: "Todas as folgas já foram utilizadas" }, { status: 400 });

    // Validate day of week + holiday
    const feriados = await prisma.feriado.findMany({ select: { data: true, recorrente: true } });
    const feriadosLite = feriados.map((f) => ({ data: f.data.toISOString(), recorrente: f.recorrente }));
    const validation = validateFolgaDay(dateStr, feriadosLite);
    if (!validation.valid)
      return NextResponse.json({ error: validation.reason }, { status: 400 });

    const dataDate = new Date(`${dateStr}T12:00:00Z`);

    // Check for duplicate uso on same date
    const duplicateUso = benefit.usos.find(
      (u) => new Date(u.data).toISOString().slice(0, 10) === dateStr
    );
    if (duplicateUso)
      return NextResponse.json({ error: "Já existe uma folga registrada nessa data" }, { status: 400 });

    // Check for existing ponto record on that date
    const existingPonto = await prisma.registroPonto.findFirst({
      where: {
        funcionarioId: benefit.funcionarioId,
        data: new Date(`${dateStr}T00:00:00`),
      },
    });

    await prisma.$transaction([
      prisma.usoFolgaAniversario.create({
        data: { folgaAniversarioId, data: dataDate },
      }),
      prisma.folgaAniversario.update({
        where: { id: folgaAniversarioId },
        data: { folgasUsadas: { increment: 1 } },
      }),
      ...(existingPonto
        ? [prisma.registroPonto.update({
            where: { id: existingPonto.id },
            data: { ocorrencia: "FOLGA_B", entrada: null, saida1: null, entrada2: null, saidaAlmoco: null, retornoAlmoco: null, saida: null, horasTrabalhadas: 0, horasExtras: 0 },
          })]
        : [prisma.registroPonto.create({
            data: {
              funcionarioId: benefit.funcionarioId,
              data: new Date(`${dateStr}T00:00:00`),
              ocorrencia: "FOLGA_B",
              horasTrabalhadas: 0,
              horasExtras: 0,
            },
          })]),
    ]);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: "Erro interno", detail: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
