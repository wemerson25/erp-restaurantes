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

    const { tipo, funcionarioId, folgaExtraId } = await req.json() as {
      tipo: "ANIVERSARIO" | "EXTRA";
      funcionarioId?: string;
      folgaExtraId?: string;
    };

    // ── Folga Aniversário ────────────────────────────────────────────
    if (tipo === "ANIVERSARIO") {
      if (!funcionarioId) return NextResponse.json({ error: "funcionarioId obrigatório" }, { status: 400 });

      const func = await prisma.funcionario.findUnique({
        where: { id: funcionarioId },
        select: { nome: true, telefone: true, restaurante: { select: { nome: true } } },
      });
      if (!func) return NextResponse.json({ error: "Funcionário não encontrado" }, { status: 404 });
      if (!func.telefone) return NextResponse.json({ error: "Funcionário sem telefone cadastrado" }, { status: 400 });

      const today = new Date(); today.setUTCHours(0, 0, 0, 0);
      const folga = await prisma.folgaAniversario.findFirst({
        where: { funcionarioId, dataValidade: { gte: today } },
        orderBy: { dataValidade: "asc" },
      });

      if (!folga) {
        return NextResponse.json({ error: "Nenhuma folga de aniversário ativa para este colaborador" }, { status: 400 });
      }

      const disponivel = 2 - folga.folgasUsadas;
      const linhas: string[] = [
        `Olá, *${func.nome}*! 🎂\n`,
        `*Folga de Aniversário — ${folga.anoReferencia}º ano:*\n`,
      ];

      if (disponivel > 0) {
        linhas.push(`✅ *${disponivel} folga${disponivel === 1 ? "" : "s"} disponível${disponivel === 1 ? "" : "s"}*`);
        linhas.push(`📅 Válido até *${fmtDate(folga.dataValidade)}*`);
        linhas.push(`\n⚠️ Agende com o RH para não perder o benefício!`);
        linhas.push(`_Permitido: segunda a quinta, sem feriados ou vésperas._`);
      } else {
        linhas.push(`✅ Benefício já utilizado.`);
        linhas.push(`📅 Válido até *${fmtDate(folga.dataValidade)}*`);
      }

      linhas.push(`\n_${func.restaurante.nome} — RH_`);

      const r = await sendWhatsAppText(func.telefone, linhas.join("\n"));
      if (!r.ok) return NextResponse.json({ error: r.error }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    // ── Folga Benefício Extra ────────────────────────────────────────
    if (tipo === "EXTRA") {
      if (!folgaExtraId) return NextResponse.json({ error: "folgaExtraId obrigatório" }, { status: 400 });

      const folga = await prisma.folgaBeneficioExtra.findUnique({
        where: { id: folgaExtraId },
        include: { funcionario: { select: { nome: true, telefone: true, restaurante: { select: { nome: true } } } } },
      });
      if (!folga) return NextResponse.json({ error: "Folga não encontrada" }, { status: 404 });
      if (!folga.funcionario.telefone) return NextResponse.json({ error: "Funcionário sem telefone cadastrado" }, { status: 400 });

      const linhas: string[] = [
        `Olá, *${folga.funcionario.nome}*! 🎁\n`,
        `*Folga Benefício: ${folga.motivo}*\n`,
      ];

      if (folga.status === "DISPONIVEL") {
        linhas.push(`✅ *Disponível para uso*`);
        if (folga.dataValidade) {
          linhas.push(`📅 Válido até *${fmtDate(folga.dataValidade)}*`);
          linhas.push(`\n⚠️ Agende com o RH para não perder o benefício!`);
        } else {
          linhas.push(`\nAgende com o RH para utilizar.`);
        }
      } else {
        linhas.push(`✅ Benefício já utilizado${folga.dataUso ? ` em *${fmtDate(folga.dataUso)}*` : ""}.`);
      }

      if (folga.observacoes) {
        linhas.push(`\n_${folga.observacoes}_`);
      }

      linhas.push(`\n_${folga.funcionario.restaurante.nome} — RH_`);

      const r = await sendWhatsAppText(folga.funcionario.telefone, linhas.join("\n"));
      if (!r.ok) return NextResponse.json({ error: r.error }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "tipo inválido" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: "Erro ao enviar", detail: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
