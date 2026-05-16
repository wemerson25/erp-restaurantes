import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { dispararEvento } from "@/lib/notificacao-config";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;
  const funcionario = await prisma.funcionario.findUnique({
    where: { id },
    include: {
      restaurante: true,
      cargo: true,
      registrosPonto: { orderBy: { data: "desc" }, take: 30 },
      ferias: { orderBy: { dataInicio: "desc" } },
      folhas: { orderBy: { competencia: "desc" }, take: 12 },
      advertencias: { orderBy: { data: "desc" } },
    },
  });

  if (!funcionario) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  return NextResponse.json(funcionario);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;
  const data = await req.json();

  const funcionario = await prisma.funcionario.update({
    where: { id },
    data: {
      ...data,
      dataNascimento: data.dataNascimento ? new Date(data.dataNascimento) : undefined,
      dataAdmissao: data.dataAdmissao ? new Date(data.dataAdmissao) : undefined,
      dataDemissao: data.dataDemissao ? new Date(data.dataDemissao) : undefined,
      salario: data.salario ? parseFloat(data.salario) : undefined,
    },
    include: {
      restaurante: { select: { nome: true } },
      cargo: { select: { nome: true } },
    },
  });

  if (data.status === "DEMITIDO") {
    const tipoLabel: Record<string, string> = {
      SEM_JUSTA_CAUSA: "Sem Justa Causa", JUSTA_CAUSA: "Justa Causa",
      ACORDO: "Acordo", PEDIU_DEMISSAO: "Pediu Demissão",
    };
    const demData = data.dataDemissao
      ? new Date(data.dataDemissao).toLocaleDateString("pt-BR", { timeZone: "UTC" })
      : new Date().toLocaleDateString("pt-BR");
    const demMsg = [
      `📋 *Demissão Registrada*\n`,
      `Colaborador: *${funcionario.nome}*`,
      `Cargo: ${funcionario.cargo.nome}`,
      `Restaurante: ${funcionario.restaurante.nome}`,
      `Data: *${demData}*`,
      data.tipoDemissao ? `Tipo: *${tipoLabel[data.tipoDemissao] ?? data.tipoDemissao}*` : "",
      `\n_RH — Grupo Ykedin_`,
    ].filter(Boolean).join("\n");
    dispararEvento("DEMISSAO", demMsg).catch(() => {});
  }

  return NextResponse.json(funcionario);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await params;
  await prisma.funcionario.update({
    where: { id },
    data: { status: "DEMITIDO", dataDemissao: new Date() },
  });

  return NextResponse.json({ ok: true });
}
