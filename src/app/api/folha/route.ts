import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { calcularINSS, calcularIRRF, calcularFGTS } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const competencia = searchParams.get("competencia");
  const restauranteId = searchParams.get("restauranteId");

  const folhas = await prisma.folhaPagamento.findMany({
    where: {
      ...(competencia ? { competencia } : {}),
      ...(restauranteId
        ? { funcionario: { restauranteId } }
        : {}),
    },
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
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(folhas);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { competencia, restauranteId } = await req.json();

  const funcionarios = await prisma.funcionario.findMany({
    where: {
      status: "ATIVO",
      ...(restauranteId ? { restauranteId } : {}),
    },
  });

  const folhas = await Promise.all(
    funcionarios.map(async (f) => {
      const existing = await prisma.folhaPagamento.findFirst({
        where: { funcionarioId: f.id, competencia },
      });
      if (existing) return existing;

      const pontos = await prisma.registroPonto.findMany({
        where: {
          funcionarioId: f.id,
          data: {
            gte: new Date(`${competencia}-01`),
            lt: new Date(
              new Date(`${competencia}-01`).setMonth(
                new Date(`${competencia}-01`).getMonth() + 1
              )
            ),
          },
        },
      });

      const totalHorasExtras = pontos.reduce((acc, p) => acc + (p.horasExtras ?? 0), 0);
      const valorHoraExtra = (f.salario / 220) * 1.5;
      const valorHorasExtras = totalHorasExtras * valorHoraExtra;
      const salarioBruto = f.salario + valorHorasExtras;

      const descontoINSS = calcularINSS(salarioBruto);
      const baseIRRF = salarioBruto - descontoINSS;
      const descontoIRRF = calcularIRRF(baseIRRF);
      const valorFGTS = calcularFGTS(salarioBruto);
      const salarioLiquido = salarioBruto - descontoINSS - descontoIRRF;

      return prisma.folhaPagamento.create({
        data: {
          funcionarioId: f.id,
          competencia,
          salarioBruto,
          horasExtras: totalHorasExtras,
          valorHorasExtras,
          descontoINSS,
          descontoIRRF,
          valorFGTS,
          salarioLiquido,
          status: "PENDENTE",
        },
      });
    })
  );

  return NextResponse.json({ geradas: folhas.length }, { status: 201 });
}
