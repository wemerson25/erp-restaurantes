import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { sendWhatsAppText } from "@/lib/whatsapp";
import { ensureBeneficioExtraTable } from "@/lib/beneficio-extra-setup";

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    await ensureBeneficioExtraTable();

    const { tipo, funcionarioId: rawFuncId, folgaExtraId } = await req.json() as {
      tipo: "ANIVERSARIO" | "EXTRA";
      funcionarioId?: string;
      folgaExtraId?: string;
    };

    // Resolve funcionarioId from either trigger
    let funcionarioId: string;

    if (tipo === "ANIVERSARIO") {
      if (!rawFuncId) return NextResponse.json({ error: "funcionarioId obrigatório" }, { status: 400 });
      funcionarioId = rawFuncId;
    } else if (tipo === "EXTRA") {
      if (!folgaExtraId) return NextResponse.json({ error: "folgaExtraId obrigatório" }, { status: 400 });
      const ref = await prisma.folgaBeneficioExtra.findUnique({
        where: { id: folgaExtraId },
        select: { funcionarioId: true },
      });
      if (!ref) return NextResponse.json({ error: "Folga não encontrada" }, { status: 404 });
      funcionarioId = ref.funcionarioId;
    } else {
      return NextResponse.json({ error: "tipo inválido" }, { status: 400 });
    }

    const func = await prisma.funcionario.findUnique({
      where: { id: funcionarioId },
      select: { nome: true, telefone: true, restaurante: { select: { nome: true } } },
    });
    if (!func) return NextResponse.json({ error: "Funcionário não encontrado" }, { status: 404 });
    if (!func.telefone) return NextResponse.json({ error: "Funcionário sem telefone cadastrado" }, { status: 400 });

    // Fetch ALL folgas for this employee
    const now = new Date(); now.setUTCHours(0, 0, 0, 0);

    const [folgasAnuais, folgasExtra] = await Promise.all([
      prisma.folgaAniversario.findMany({
        where: { funcionarioId, dataValidade: { gte: now } },
        orderBy: { anoReferencia: "asc" },
      }),
      prisma.folgaBeneficioExtra.findMany({
        where: {
          funcionarioId,
          OR: [{ dataValidade: null }, { dataValidade: { gte: now } }],
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    // Build unified message with all folgas
    const linhas: string[] = [
      `Olá, *${func.nome}*! 📋\n`,
      `*Suas Folgas Benefício:*\n`,
    ];

    for (const fa of folgasAnuais) {
      const disponivel = 2 - fa.folgasUsadas;
      linhas.push(`📌 *Folga Benefício Anual — ${fa.anoReferencia}º ano de empresa*`);
      linhas.push(disponivel > 0
        ? `   ✅ *${disponivel} folga${disponivel > 1 ? "s" : ""} disponível${disponivel > 1 ? "s" : ""}*`
        : `   ✅ Já utilizado`);
      linhas.push(`   📅 Válido até *${fmtDate(fa.dataValidade)}*`);
      linhas.push("");
    }

    for (const fe of folgasExtra) {
      linhas.push(`📌 *${fe.motivo}*`);
      if (fe.status === "DISPONIVEL") {
        linhas.push(`   ✅ *Disponível para uso*`);
        if (fe.dataValidade) linhas.push(`   📅 Válido até *${fmtDate(fe.dataValidade)}*`);
      } else {
        linhas.push(`   ✅ Utilizado${fe.dataUso ? ` em *${fmtDate(fe.dataUso)}*` : ""}`);
      }
      if (fe.observacoes) linhas.push(`   _${fe.observacoes}_`);
      linhas.push("");
    }

    if (folgasAnuais.length === 0 && folgasExtra.length === 0) {
      linhas.push(`Nenhuma folga benefício registrada no momento.\n`);
    }

    const temDisponivel =
      folgasAnuais.some(fa => fa.folgasUsadas < 2 && new Date(fa.dataValidade) >= now) ||
      folgasExtra.some(fe => fe.status === "DISPONIVEL");

    if (temDisponivel) {
      linhas.push(`⚠️ Agende com o RH para não perder os benefícios!`);
      linhas.push(`_Permitido: segunda a quinta, sem feriados ou vésperas._\n`);
    }

    linhas.push(`_${func.restaurante.nome} — RH_`);

    const r = await sendWhatsAppText(func.telefone, linhas.join("\n"));
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 500 });
    return NextResponse.json({ ok: true });

  } catch (e) {
    return NextResponse.json({
      error: "Erro ao enviar",
      detail: e instanceof Error ? e.message : String(e),
    }, { status: 500 });
  }
}
