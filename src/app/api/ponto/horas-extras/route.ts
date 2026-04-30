import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getCargaDiaria } from "@/lib/schedule";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month"); // YYYY-MM
  if (!month) return NextResponse.json({ error: "month obrigatório" }, { status: 400 });

  const [y, m] = month.split("-").map(Number);
  const dataInicio = new Date(y, m - 1, 1);
  const dataFim = new Date(y, m, 0, 23, 59, 59);

  const registros = await prisma.registroPonto.findMany({
    where: {
      data: { gte: dataInicio, lte: dataFim },
      ocorrencia: { notIn: ["FOLGA", "FALTA"] },
    },
    include: {
      funcionario: {
        select: {
          id: true,
          nome: true,
          matricula: true,
          cargo: { select: { nome: true } },
          restaurante: { select: { nome: true } },
        },
      },
    },
    orderBy: { data: "asc" },
  });

  type Entry = {
    funcionario: { id: string; nome: string; matricula: string; cargo: { nome: string }; restaurante: { nome: string } };
    diasTrabalhados: number;
    horasTrabalhadas: number;
    horasPrevistas: number;
    horasExtras: number;
  };

  const map = new Map<string, Entry>();

  for (const r of registros) {
    const f = r.funcionario;
    const trabalhado = r.horasTrabalhadas ?? 0;
    if (trabalhado <= 0) continue;

    const carga = getCargaDiaria(f.restaurante.nome, r.data);
    const extra = Math.max(0, trabalhado - carga);

    if (!map.has(f.id)) {
      map.set(f.id, { funcionario: f, diasTrabalhados: 0, horasTrabalhadas: 0, horasPrevistas: 0, horasExtras: 0 });
    }
    const e = map.get(f.id)!;
    e.diasTrabalhados += 1;
    e.horasTrabalhadas += trabalhado;
    e.horasPrevistas += carga;
    e.horasExtras += extra;
  }

  const round2 = (n: number) => Math.round(n * 100) / 100;

  const result = [...map.values()]
    .map(e => ({
      ...e,
      horasTrabalhadas: round2(e.horasTrabalhadas),
      horasPrevistas: round2(e.horasPrevistas),
      horasExtras: round2(e.horasExtras),
    }))
    .sort((a, b) => b.horasExtras - a.horasExtras);

  return NextResponse.json(result);
}
