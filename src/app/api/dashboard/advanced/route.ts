import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

function daysBetween(a: Date, b: Date) {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function addYears(date: Date, years: number) {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

const MESES = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const mesAtualInicio  = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const mesPassadoInicio = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
  const mesPassadoFim    = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0, 23, 59, 59));
  const d30 = new Date(today); d30.setUTCDate(d30.getUTCDate() - 30);
  const d6m  = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 5, 1));
  const mesIni = mesAtualInicio;
  const mesKey = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}`;

  try {
    const [
      funcionariosAtivos,
      todasFerias,
      pontosPeriodo,
      advertenciasPeriodo,
      ausenciasPeriodo,
      admissoes6m,
      demissoes6m,
      horasExtrasMesAnt,
    ] = await Promise.all([
      prisma.funcionario.findMany({
        where: { status: "ATIVO" },
        select: {
          id: true,
          nome: true,
          matricula: true,
          dataAdmissao: true,
          restaurante: { select: { id: true, nome: true } },
          cargo: { select: { nome: true, departamento: true } },
        },
      }),
      prisma.ferias.findMany({
        where: { status: { in: ["AGENDADA", "EM_ANDAMENTO", "CONCLUIDA"] } },
        select: { funcionarioId: true, dataInicio: true },
      }),
      // Período = início do mês passado até hoje (mês atual + mês anterior)
      prisma.registroPonto.findMany({
        where: { ocorrencia: { in: ["ATRASO", "FALTA"] }, data: { gte: mesPassadoInicio } },
        select: {
          funcionarioId: true,
          data: true,
          ocorrencia: true,
          funcionario: {
            select: {
              restaurante: { select: { id: true, nome: true } },
              cargo: { select: { departamento: true } },
            },
          },
        },
      }),
      prisma.advertencia.findMany({
        where: { data: { gte: mesPassadoInicio } },
        select: {
          funcionarioId: true,
          data: true,
          funcionario: { select: { restaurante: { select: { id: true, nome: true } } } },
        },
      }),
      prisma.ausencia.findMany({
        where: {
          tipo: { in: ["ATESTADO_MEDICO", "LICENCA_MEDICA", "ACIDENTE_TRABALHO"] },
          dataInicio: { gte: mesPassadoInicio },
        },
        select: {
          funcionarioId: true,
          funcionario: {
            select: {
              restaurante: { select: { id: true, nome: true } },
              cargo: { select: { departamento: true } },
            },
          },
        },
      }),
      prisma.funcionario.findMany({
        where: { dataAdmissao: { gte: d6m } },
        select: { dataAdmissao: true, restaurante: { select: { id: true, nome: true } } },
      }),
      prisma.funcionario.findMany({
        where: { status: "DEMITIDO", dataDemissao: { gte: d6m } },
        select: { dataDemissao: true, restaurante: { select: { id: true, nome: true } } },
      }),
      // Horas extras do mês anterior para o aviso
      prisma.registroPonto.findMany({
        where: { data: { gte: mesPassadoInicio, lte: mesPassadoFim }, horasExtras: { gt: 0 } },
        select: {
          funcionarioId: true,
          horasExtras: true,
          funcionario: {
            select: {
              nome: true, matricula: true,
              restaurante: { select: { nome: true } },
              cargo: { select: { nome: true } },
            },
          },
        },
      }),
    ]);

    // ── emExperiencia (3 etapas: 30 / 60 / 90 dias) ───────────────────────────
    const emExperiencia = funcionariosAtivos
      .map((f) => {
        const diasNaEmpresa = daysBetween(new Date(f.dataAdmissao), today);
        if (diasNaEmpresa >= 90) return null;
        const etapa: 1 | 2 | 3 = diasNaEmpresa < 30 ? 1 : diasNaEmpresa < 60 ? 2 : 3;
        const etapaDias: 30 | 60 | 90 = etapa === 1 ? 30 : etapa === 2 ? 60 : 90;
        const diasRestantes = etapaDias - diasNaEmpresa;
        return {
          id: f.id,
          nome: f.nome,
          restaurante: f.restaurante.nome,
          cargo: f.cargo.nome,
          dataAdmissao: new Date(f.dataAdmissao).toISOString().slice(0, 10),
          diasNaEmpresa,
          etapa,
          etapaDias,
          diasRestantes,
          alerta: diasRestantes <= 7 ? "vencendo" as const : "normal" as const,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => a.diasRestantes - b.diasRestantes);

    // ── feriasVencendo / feriasVencidas ────────────────────────────────────────
    const feriasMap = new Map<string, Date[]>();
    for (const f of todasFerias) {
      const arr = feriasMap.get(f.funcionarioId) ?? [];
      arr.push(new Date(f.dataInicio));
      feriasMap.set(f.funcionarioId, arr);
    }

    const feriasVencendo: {
      id: string; nome: string; restaurante: string;
      diasAteVencer: number; periodoFim: string; prioridade: "alta" | "media";
    }[] = [];
    const feriasVencidas: {
      id: string; nome: string; restaurante: string; diasVencidas: number;
    }[] = [];

    for (const f of funcionariosAtivos) {
      const admissao = new Date(f.dataAdmissao);
      const anosEmpresa = daysBetween(admissao, today) / 365;
      if (anosEmpresa < 1) continue;

      const feriasDoFuncionario = feriasMap.get(f.id) ?? [];

      // find current period
      let periodoInicio = admissao;
      let periodoFim: Date = addYears(admissao, 1);
      let count = 1;
      while (true) {
        const fim = addYears(periodoInicio, 1);
        if (fim > today) {
          periodoFim = fim;
          break;
        }
        periodoInicio = fim;
        periodoFim = fim;
        count++;
        if (count > 50) break; // safety
      }

      // check if ferias taken in current period
      const temFeriasNoPeriodo = feriasDoFuncionario.some((d) => {
        return d >= periodoInicio && d < periodoFim;
      });

      if (!temFeriasNoPeriodo) {
        const diasAteVencer = daysBetween(today, periodoFim);
        if (diasAteVencer > 0 && diasAteVencer <= 60) {
          feriasVencendo.push({
            id: f.id,
            nome: f.nome,
            restaurante: f.restaurante.nome,
            diasAteVencer,
            periodoFim: periodoFim.toISOString().slice(0, 10),
            prioridade: diasAteVencer <= 30 ? "alta" : "media",
          });
        } else if (diasAteVencer <= 0 && Math.abs(diasAteVencer) <= 180) {
          feriasVencidas.push({
            id: f.id,
            nome: f.nome,
            restaurante: f.restaurante.nome,
            diasVencidas: Math.abs(daysBetween(today, periodoFim)),
          });
        }
      }
    }

    // ── horasExtrasMesAnterior ─────────────────────────────────────────────────
    const heMap = new Map<string, { nome: string; matricula: string; restaurante: string; cargo: string; total: number }>();
    for (const p of horasExtrasMesAnt) {
      const existing = heMap.get(p.funcionarioId);
      if (existing) {
        existing.total += p.horasExtras ?? 0;
      } else {
        heMap.set(p.funcionarioId, {
          nome: p.funcionario.nome,
          matricula: p.funcionario.matricula,
          restaurante: p.funcionario.restaurante.nome,
          cargo: p.funcionario.cargo.nome,
          total: p.horasExtras ?? 0,
        });
      }
    }
    const mesAntLabel = `${MESES[mesPassadoInicio.getUTCMonth()]}/${String(mesPassadoInicio.getUTCFullYear()).slice(2)}`;
    const horasExtrasMesAnterior = Array.from(heMap.entries())
      .map(([id, v]) => ({ id, ...v, totalHoras: Math.round(v.total * 10) / 10 }))
      .filter(v => v.totalHoras > 0)
      .sort((a, b) => b.totalHoras - a.totalHoras)
      .slice(0, 10);

    // ── restAtivosCount (usado no comparativo) ─────────────────────────────────
    const restAtivosCount = new Map<string, number>();
    for (const f of funcionariosAtivos) {
      restAtivosCount.set(f.restaurante.nome, (restAtivosCount.get(f.restaurante.nome) ?? 0) + 1);
    }

    // ── heatmap ────────────────────────────────────────────────────────────────
    const atrasos90d = pontosPeriodo.filter((p) => p.ocorrencia === "ATRASO");
    const diasCount = new Array(7).fill(0) as number[];
    const lojaMap2 = new Map<string, number>();
    const DIAS_SEMANA = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

    for (const p of atrasos90d) {
      const dow = new Date(p.data).getUTCDay();
      diasCount[dow]++;
      const nome = p.funcionario.restaurante.nome;
      lojaMap2.set(nome, (lojaMap2.get(nome) ?? 0) + 1);
    }

    const porDia = diasCount.map((count, dia) => ({ dia, nome: DIAS_SEMANA[dia], count }));
    const porLoja = Array.from(lojaMap2.entries())
      .map(([nome, count]) => ({ nome, count }))
      .sort((a, b) => b.count - a.count);

    const heatmap = { porDia, total: atrasos90d.length, porLoja };

    // ── scoresDisciplinares (período: mês atual + mês anterior) ──────────────
    const scoresDisciplinares = funcionariosAtivos
      .map((f) => {
        const atrasos = pontosPeriodo.filter(
          (p) => p.funcionarioId === f.id && p.ocorrencia === "ATRASO"
        ).length;
        const faltas = pontosPeriodo.filter(
          (p) => p.funcionarioId === f.id && p.ocorrencia === "FALTA"
        ).length;
        const advertencias = advertenciasPeriodo.filter((a) => a.funcionarioId === f.id).length;
        const atestados = ausenciasPeriodo.filter((a) => a.funcionarioId === f.id).length;
        const score = atrasos * 2 + faltas * 5 + advertencias * 10 + atestados;
        const nivel: "critico" | "atencao" | "excelente" =
          score >= 25 ? "critico" : score >= 10 ? "atencao" : "excelente";
        return {
          id: f.id,
          nome: f.nome,
          matricula: f.matricula,
          restaurante: f.restaurante.nome,
          cargo: f.cargo.nome,
          score,
          nivel,
          atrasos,
          faltas,
          advertencias,
          atestados,
        };
      })
      .filter((x) => x.nivel !== "excelente")
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    // ── comparativoLojas ──────────────────────────────────────────────────────
    const lojaStats = new Map<string, {
      restaurante: string;
      totalAtivos: number;
      atrasos: number;
      faltas: number;
      advertencias: number;
      admissoes: number;
      demissoes: number;
    }>();

    for (const f of funcionariosAtivos) {
      const nome = f.restaurante.nome;
      if (!lojaStats.has(nome)) {
        lojaStats.set(nome, { restaurante: nome, totalAtivos: 0, atrasos: 0, faltas: 0, advertencias: 0, admissoes: 0, demissoes: 0 });
      }
      lojaStats.get(nome)!.totalAtivos++;
    }

    for (const p of pontosPeriodo) {
      const nome = p.funcionario.restaurante.nome;
      const entry = lojaStats.get(nome);
      if (!entry) continue;
      if (p.ocorrencia === "ATRASO") entry.atrasos++;
      else if (p.ocorrencia === "FALTA") entry.faltas++;
    }

    for (const a of advertenciasPeriodo) {
      const nome = a.funcionario.restaurante.nome;
      const entry = lojaStats.get(nome);
      if (entry) entry.advertencias++;
    }

    for (const f of admissoes6m) {
      const d = new Date(f.dataAdmissao);
      const key2 = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      if (key2 === mesKey) {
        const nome = f.restaurante.nome;
        if (!lojaStats.has(nome)) {
          lojaStats.set(nome, { restaurante: nome, totalAtivos: 0, atrasos: 0, faltas: 0, advertencias: 0, admissoes: 0, demissoes: 0 });
        }
        lojaStats.get(nome)!.admissoes++;
      }
    }

    for (const f of demissoes6m) {
      if (!f.dataDemissao) continue;
      const d = new Date(f.dataDemissao);
      const key2 = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      if (key2 === mesKey) {
        const nome = f.restaurante.nome;
        if (!lojaStats.has(nome)) {
          lojaStats.set(nome, { restaurante: nome, totalAtivos: 0, atrasos: 0, faltas: 0, advertencias: 0, admissoes: 0, demissoes: 0 });
        }
        lojaStats.get(nome)!.demissoes++;
      }
    }

    const comparativoLojas = Array.from(lojaStats.values())
      .map((s) => ({
        ...s,
        turnoverPct: Math.round((s.demissoes / (s.totalAtivos || 1)) * 100 * 10) / 10,
      }))
      .sort((a, b) => (b.atrasos + b.faltas) - (a.atrasos + a.faltas));

    return NextResponse.json({
      emExperiencia,
      feriasVencendo,
      feriasVencidas,
      horasExtrasMesAnterior,
      mesAntLabel,
      heatmap,
      scoresDisciplinares,
      comparativoLojas,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Erro", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
