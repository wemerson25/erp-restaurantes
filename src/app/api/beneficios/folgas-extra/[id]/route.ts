import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ensureBeneficioExtraTable } from "@/lib/beneficio-extra-setup";
import { dispararEvento } from "@/lib/notificacao-config";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    await ensureBeneficioExtraTable();

    const { id } = await params;
    const { dataUso } = await req.json();

    if (!dataUso)
      return NextResponse.json({ error: "dataUso obrigatório" }, { status: 400 });

    const folga = await prisma.folgaBeneficioExtra.update({
      where: { id },
      data: {
        dataUso: new Date(`${dataUso}T12:00:00Z`),
        status: "UTILIZADA",
      },
      include: {
        funcionario: { select: { nome: true, telefone: true, restaurante: { select: { nome: true } } } },
      },
    });

    const dataFormatada = new Date(`${dataUso}T12:00:00Z`).toLocaleDateString("pt-BR", { timeZone: "UTC" });
    const msg = [
      `🎁 *Folga Benefício Registrada*\n`,
      `Colaborador: *${folga.funcionario.nome}*`,
      `Restaurante: ${folga.funcionario.restaurante.nome}`,
      `Folga: *${folga.motivo}*`,
      `Data de uso: *${dataFormatada}*`,
      `\n_RH — Grupo Ykedin_`,
    ].join("\n");
    dispararEvento("FOLGA_USADA", msg, folga.funcionario.telefone ?? undefined).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: "Erro ao registrar uso", detail: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    await ensureBeneficioExtraTable();

    const { id } = await params;
    await prisma.folgaBeneficioExtra.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: "Erro ao excluir folga", detail: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
