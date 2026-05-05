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

  // 1. All active employees + 2. All existing folga records — parallel
  const [funcionarios, existing] = await Promise.all([
    prisma.funcionario.findMany({
      where: { status: "ATIVO" },
      select: {
        id: true, nome: true, matricula: true, dataAdmissao: true,
        cargo: { select: { nome: true } },
        restaurante: { select: { nome: true } },
      },
      orderBy: { nome: "asc" },
    }),
    prisma.folgaAniversario.findMany({
      include: { usos: { orderBy: { data: "asc" } } },
    }),
  ]);

  // Index existing records by funcionarioId|anoReferencia
  const existingMap = new Map<string, typeof existing[0]>();
  for (const r of existing) {
    existingMap.set(`${r.funcionarioId}|${r.anoReferencia}`, r);
  }

  // 3. Build response entirely in memory — no DB writes on GET
  const result = funcionarios.map((f) => {
    const adm = new Date(f.dataAdmissao);

    // Count completed years
    let anosCompletos = 0;
    while (addYears(adm, anosCompletos + 1) <= today) anosCompletos++;

    // Find the current active benefit period (most recent valid one)
    let folgaAtual = null;
    for (let ano = anosCompletos; ano >= 1; ano--) {
      const dataConcessao = addYears(adm, ano);
      const dataValidade = addYears(adm, ano + 1);
      if (dataValidade <= today) break; // expired, no point looking further back

      const rec = existingMap.get(`${f.id}|${ano}`);
      if (rec) {
        folgaAtual = {
          id: rec.id,
          anoReferencia: rec.anoReferencia,
          dataConcessao: rec.dataConcessao,
          dataValidade: rec.dataValidade,
          folgasUsadas: rec.folgasUsadas,
          folgasDisponiveis: 2 - rec.folgasUsadas,
          usos: rec.usos.map((u) => ({ id: u.id, data: u.data })),
        };
      } else if (dataConcessao <= today) {
        // Benefit earned but no record yet (no folgas used) — compute virtually
        folgaAtual = {
          id: null,
          anoReferencia: ano,
          dataConcessao,
          dataValidade,
          folgasUsadas: 0,
          folgasDisponiveis: 2,
          usos: [],
        };
      }
      break;
    }

    return {
      funcionarioId: f.id, nome: f.nome, matricula: f.matricula,
      cargo: f.cargo.nome, restaurante: f.restaurante.nome,
      dataAdmissao: f.dataAdmissao, anosCompletos,
      proximoAniversario: addYears(adm, anosCompletos + 1),
      folgaAtual,
    };
  });

  return NextResponse.json(result);
}
