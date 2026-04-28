import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");

  const ferias = await prisma.ferias.findMany({
    where: status ? { status } : {},
    include: {
      funcionario: {
        select: {
          nome: true,
          matricula: true,
          cargo: { select: { nome: true } },
          restaurante: { select: { nome: true } },
        },
      },
    },
    orderBy: { dataInicio: "asc" },
  });

  return NextResponse.json(ferias);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const data = await req.json();
  const dataInicio = new Date(data.dataInicio);
  const dataFim = new Date(data.dataFim);
  const diasCorridos = Math.ceil((dataFim.getTime() - dataInicio.getTime()) / 86400000) + 1;

  const diasVendidos = Math.max(0, Math.min(10, 30 - diasCorridos, Number(data.diasVendidos) || 0));

  const ferias = await prisma.ferias.create({
    data: {
      funcionarioId: data.funcionarioId,
      dataInicio,
      dataFim,
      diasCorridos,
      diasVendidos,
      status: "AGENDADA",
      observacoes: data.observacoes,
    },
    include: {
      funcionario: { select: { nome: true, matricula: true } },
    },
  });

  return NextResponse.json(ferias, { status: 201 });
}
