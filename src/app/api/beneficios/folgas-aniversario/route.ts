import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

function addYears(date: Date, years: number) {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const today = new Date();

  const funcionarios = await prisma.funcionario.findMany({
    where: { status: "ATIVO" },
    select: {
      id: true, nome: true, matricula: true, dataAdmissao: true,
      cargo: { select: { nome: true } },
      restaurante: { select: { nome: true } },
      folgasAniversario: {
        include: { usos: { orderBy: { data: "asc" } } },
        orderBy: { anoReferencia: "asc" },
      },
    },
    orderBy: { nome: "asc" },
  });

  const result = [];

  for (const f of funcionarios) {
    const adm = new Date(f.dataAdmissao);

    // Auto-create anniversary benefit records for all passed anniversaries
    let ano = 1;
    while (true) {
      const concessao = addYears(adm, ano);
      if (concessao > today) break;
      const validade = addYears(concessao, 1);
      const exists = f.folgasAniversario.some((fa) => fa.anoReferencia === ano);
      if (!exists) {
        await prisma.folgaAniversario.create({
          data: { funcionarioId: f.id, anoReferencia: ano, dataConcessao: concessao, dataValidade: validade, folgasUsadas: 0 },
        });
      }
      ano++;
    }

    // Re-fetch to include newly created records
    const beneficios = await prisma.folgaAniversario.findMany({
      where: { funcionarioId: f.id },
      include: { usos: { orderBy: { data: "asc" } } },
      orderBy: { anoReferencia: "desc" },
    });

    const anosCompletos = ano - 1;

    // Current benefit = latest one still within validity period
    const folgaAtual = beneficios.find((b) => new Date(b.dataValidade) > today) ?? null;

    result.push({
      funcionarioId: f.id,
      nome: f.nome,
      matricula: f.matricula,
      cargo: f.cargo.nome,
      restaurante: f.restaurante.nome,
      dataAdmissao: f.dataAdmissao,
      anosCompletos,
      proximoAniversario: addYears(adm, anosCompletos + 1),
      folgaAtual: folgaAtual
        ? {
            id: folgaAtual.id,
            anoReferencia: folgaAtual.anoReferencia,
            dataConcessao: folgaAtual.dataConcessao,
            dataValidade: folgaAtual.dataValidade,
            folgasUsadas: folgaAtual.folgasUsadas,
            folgasDisponiveis: 2 - folgaAtual.folgasUsadas,
            usos: folgaAtual.usos.map((u) => ({ id: u.id, data: u.data })),
          }
        : null,
    });
  }

  return NextResponse.json(result);
}
