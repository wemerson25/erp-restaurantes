import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ensureBeneficioExtraTable } from "@/lib/beneficio-extra-setup";

function addYears(date: Date, years: number) {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

function daysBetween(a: Date, b: Date) {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export interface Notificacao {
  id: string;
  tipo: string;
  titulo: string;
  descricao: string;
  prioridade: "alta" | "media" | "baixa";
  data?: string;
  funcionarioNome?: string;
}

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    await ensureBeneficioExtraTable();

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const em7dias = new Date(today);  em7dias.setUTCDate(em7dias.getUTCDate() + 7);
    const em30dias = new Date(today); em30dias.setUTCDate(em30dias.getUTCDate() + 30);
    const em60dias = new Date(today); em60dias.setUTCDate(em60dias.getUTCDate() + 60);

    const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const em7diasAtras = new Date(today); em7diasAtras.setUTCDate(em7diasAtras.getUTCDate() - 7);

    const [
      funcionarios, feriasProximas, todasFerias, folgasAniv, folgasExtra,
      admissoesRecentes, demissoesRecentes, semTelefone, advertenciasRecentes,
    ] = await Promise.all([
      prisma.funcionario.findMany({
        where: { status: "ATIVO" },
        select: {
          id: true, nome: true, dataNascimento: true, dataAdmissao: true, telefone: true,
          restaurante: { select: { nome: true } },
        },
      }),
      prisma.ferias.findMany({
        where: { status: "AGENDADA", dataInicio: { gte: today, lte: em30dias } },
        include: { funcionario: { select: { nome: true } } },
        orderBy: { dataInicio: "asc" },
      }),
      prisma.ferias.findMany({
        where: { status: { in: ["AGENDADA", "EM_ANDAMENTO", "CONCLUIDA"] } },
        select: { funcionarioId: true, dataInicio: true },
      }),
      prisma.folgaAniversario.findMany({
        where: { dataValidade: { gte: today, lte: em30dias } },
        include: { funcionario: { select: { nome: true } } },
      }),
      prisma.folgaBeneficioExtra.findMany({
        where: { status: "DISPONIVEL", dataValidade: { gte: today, lte: em30dias } },
        include: { funcionario: { select: { nome: true } } },
      }),
      prisma.funcionario.findMany({
        where: { dataAdmissao: { gte: monthStart } },
        select: { nome: true, cargo: { select: { nome: true } }, restaurante: { select: { nome: true } }, dataAdmissao: true },
        orderBy: { dataAdmissao: "desc" },
      }),
      prisma.funcionario.findMany({
        where: { status: "DEMITIDO", dataDemissao: { gte: monthStart } },
        select: { nome: true, cargo: { select: { nome: true } }, restaurante: { select: { nome: true } }, dataDemissao: true },
        orderBy: { dataDemissao: "desc" },
      }),
      prisma.funcionario.findMany({
        where: { status: "ATIVO", OR: [{ telefone: "" }] },
        select: { nome: true, restaurante: { select: { nome: true } } },
      }),
      prisma.advertencia.findMany({
        where: { data: { gte: em7diasAtras } },
        include: { funcionario: { select: { nome: true, restaurante: { select: { nome: true } } } } },
        orderBy: { data: "desc" },
        take: 10,
      }),
    ]);

    // Index férias por funcionário
    const feriasMap = new Map<string, Date[]>();
    for (const f of todasFerias) {
      if (!feriasMap.has(f.funcionarioId)) feriasMap.set(f.funcionarioId, []);
      feriasMap.get(f.funcionarioId)!.push(new Date(f.dataInicio));
    }

    const notificacoes: Notificacao[] = [];
    let idx = 0;

    // ── 1. Férias iniciando em breve ──────────────────────────────
    for (const f of feriasProximas) {
      const dias = daysBetween(today, new Date(f.dataInicio));
      notificacoes.push({
        id: `ferias_ini_${idx++}`,
        tipo: "FERIAS_INICIANDO",
        titulo: dias === 0 ? "Férias iniciando hoje" : "Férias iniciando em breve",
        descricao: `${f.funcionario.nome} ${dias === 0 ? "entra de férias hoje" : `entra de férias em ${dias} dia${dias === 1 ? "" : "s"}`}`,
        prioridade: dias <= 3 ? "alta" : "media",
        data: new Date(f.dataInicio).toISOString().slice(0, 10),
        funcionarioNome: f.funcionario.nome,
      });
    }

    // ── 2. Férias vencendo (período concessivo expirando em 60 dias) ──
    for (const func of funcionarios) {
      const adm = new Date(func.dataAdmissao);
      let anosCompletos = 0;
      while (addYears(adm, anosCompletos + 1) <= today) anosCompletos++;
      if (anosCompletos < 1) continue;

      const periodoInicio = addYears(adm, anosCompletos);
      const periodoFim = addYears(adm, anosCompletos + 1);
      if (periodoFim <= today) continue;

      const diasAteVencer = daysBetween(today, periodoFim);
      if (diasAteVencer > 60) continue;

      const feriasNoPeriodo = (feriasMap.get(func.id) ?? []).filter(
        (d) => d >= periodoInicio && d <= periodoFim,
      );

      if (feriasNoPeriodo.length === 0) {
        notificacoes.push({
          id: `ferias_venc_${func.id}`,
          tipo: "FERIAS_VENCENDO",
          titulo: "Férias a vencer",
          descricao: `${func.nome} não tem férias agendadas — período vence em ${diasAteVencer} dia${diasAteVencer === 1 ? "" : "s"}`,
          prioridade: diasAteVencer <= 30 ? "alta" : "media",
          data: periodoFim.toISOString().slice(0, 10),
          funcionarioNome: func.nome,
        });
      }
    }

    // ── 3. Folgas aniversário expirando ───────────────────────────
    for (const fa of folgasAniv) {
      const disponivel = 2 - fa.folgasUsadas;
      if (disponivel <= 0) continue;
      const dias = daysBetween(today, new Date(fa.dataValidade));
      notificacoes.push({
        id: `folga_aniv_${fa.id}`,
        tipo: "FOLGA_ANIVERSARIO_EXPIRANDO",
        titulo: "Folga aniversário expirando",
        descricao: `${fa.funcionario.nome} tem ${disponivel} folga${disponivel === 1 ? "" : "s"} de aniversário vencendo em ${dias} dia${dias === 1 ? "" : "s"}`,
        prioridade: dias <= 7 ? "alta" : "media",
        data: new Date(fa.dataValidade).toISOString().slice(0, 10),
        funcionarioNome: fa.funcionario.nome,
      });
    }

    // ── 4. Folgas benefício extra expirando ───────────────────────
    for (const fe of folgasExtra) {
      if (!fe.dataValidade) continue;
      const dias = daysBetween(today, new Date(fe.dataValidade));
      notificacoes.push({
        id: `folga_extra_${fe.id}`,
        tipo: "FOLGA_EXTRA_EXPIRANDO",
        titulo: "Folga benefício vencendo",
        descricao: `${fe.funcionario.nome} — "${fe.motivo}" vence em ${dias} dia${dias === 1 ? "" : "s"}`,
        prioridade: dias <= 7 ? "alta" : "media",
        data: new Date(fe.dataValidade).toISOString().slice(0, 10),
        funcionarioNome: fe.funcionario.nome,
      });
    }

    // ── 5. Aniversários de nascimento (próximos 7 dias) ───────────
    for (const func of funcionarios) {
      const nasc = new Date(func.dataNascimento);
      const thisYear = today.getUTCFullYear();
      const bdThisYear = new Date(Date.UTC(thisYear, nasc.getUTCMonth(), nasc.getUTCDate()));
      const bdNext     = new Date(Date.UTC(thisYear + 1, nasc.getUTCMonth(), nasc.getUTCDate()));
      const bd = bdThisYear >= today ? bdThisYear : bdNext;
      const dias = daysBetween(today, bd);
      if (dias > 7) continue;

      notificacoes.push({
        id: `aniv_nasc_${func.id}`,
        tipo: dias === 0 ? "ANIVERSARIO_HOJE" : "ANIVERSARIO_SEMANA",
        titulo: dias === 0 ? "Aniversário hoje!" : "Aniversário esta semana",
        descricao: dias === 0
          ? `${func.nome} faz aniversário hoje (${func.restaurante.nome})`
          : `${func.nome} faz aniversário em ${dias} dia${dias === 1 ? "" : "s"} (${func.restaurante.nome})`,
        prioridade: dias === 0 ? "alta" : "baixa",
        funcionarioNome: func.nome,
      });
    }

    // ── 6. Aniversários de empresa (próximos 7 dias, mínimo 1 ano) ──
    for (const func of funcionarios) {
      const adm = new Date(func.dataAdmissao);
      const thisYear = today.getUTCFullYear();
      const anivThisYear = new Date(Date.UTC(thisYear, adm.getUTCMonth(), adm.getUTCDate()));
      const anivNext     = new Date(Date.UTC(thisYear + 1, adm.getUTCMonth(), adm.getUTCDate()));
      const aniv = anivThisYear >= today ? anivThisYear : anivNext;
      const dias = daysBetween(today, aniv);
      if (dias > 7) continue;

      const anos = aniv.getUTCFullYear() - adm.getUTCFullYear();
      if (anos < 1) continue;

      notificacoes.push({
        id: `aniv_emp_${func.id}`,
        tipo: "ANIVERSARIO_ADMISSAO",
        titulo: dias === 0 ? `${anos} ano${anos === 1 ? "" : "s"} de empresa hoje!` : "Aniversário de empresa",
        descricao: dias === 0
          ? `${func.nome} completa ${anos} ano${anos === 1 ? "" : "s"} na empresa hoje`
          : `${func.nome} completa ${anos} ano${anos === 1 ? "" : "s"} de empresa em ${dias} dia${dias === 1 ? "" : "s"}`,
        prioridade: dias === 0 ? "media" : "baixa",
        funcionarioNome: func.nome,
      });
    }

    // ── 7. Experiência — avaliação de etapa vencendo (≤ 7 dias) ─────
    for (const func of funcionarios) {
      const diasNaEmpresa = daysBetween(new Date(func.dataAdmissao), today);
      if (diasNaEmpresa >= 90) continue;
      const etapa = diasNaEmpresa < 30 ? 1 : diasNaEmpresa < 60 ? 2 : 3;
      const etapaDias = etapa === 1 ? 30 : etapa === 2 ? 60 : 90;
      const diasRestantes = etapaDias - diasNaEmpresa;
      if (diasRestantes > 7) continue;
      notificacoes.push({
        id: `exp_${func.id}_et${etapa}`,
        tipo: "EXPERIENCIA_VENCENDO",
        titulo: `Avaliação ${etapaDias} dias vencendo`,
        descricao: `${func.nome} (${func.restaurante.nome}) — avaliação de ${etapaDias} dias vence em ${diasRestantes} dia${diasRestantes === 1 ? "" : "s"}`,
        prioridade: diasRestantes <= 3 ? "alta" : "media",
        funcionarioNome: func.nome,
      });
    }

    // ── 8. Admissões este mês ─────────────────────────────────────
    for (const f of admissoesRecentes) {
      notificacoes.push({
        id: `admissao_${idx++}`,
        tipo: "ADMISSAO_RECENTE",
        titulo: "Nova admissão este mês",
        descricao: `${f.nome} foi admitido(a) como ${f.cargo?.nome ?? "—"} em ${f.restaurante?.nome ?? "—"}`,
        prioridade: "baixa",
        data: new Date(f.dataAdmissao).toISOString().slice(0, 10),
        funcionarioNome: f.nome,
      });
    }

    // ── 9. Demissões este mês ─────────────────────────────────────
    for (const f of demissoesRecentes) {
      notificacoes.push({
        id: `demissao_${idx++}`,
        tipo: "DEMISSAO_RECENTE",
        titulo: "Demissão este mês",
        descricao: `${f.nome} foi desligado(a) de ${f.restaurante?.nome ?? "—"}${f.dataDemissao ? ` em ${new Date(f.dataDemissao).toLocaleDateString("pt-BR", { timeZone: "UTC" })}` : ""}`,
        prioridade: "media",
        data: f.dataDemissao ? new Date(f.dataDemissao).toISOString().slice(0, 10) : undefined,
        funcionarioNome: f.nome,
      });
    }

    // ── 10. Colaboradores sem telefone ────────────────────────────
    for (const f of semTelefone) {
      notificacoes.push({
        id: `sem_tel_${idx++}`,
        tipo: "SEM_TELEFONE",
        titulo: "Cadastro incompleto",
        descricao: `${f.nome} (${f.restaurante?.nome ?? "—"}) não tem telefone cadastrado`,
        prioridade: "media",
        funcionarioNome: f.nome,
      });
    }

    // ── 11. Advertências recentes (7 dias) ───────────────────────
    for (const a of advertenciasRecentes) {
      notificacoes.push({
        id: `adv_${a.id}`,
        tipo: "ADVERTENCIA_RECENTE",
        titulo: "Advertência registrada",
        descricao: `${a.funcionario.nome} (${a.funcionario.restaurante?.nome ?? "—"}) — ${a.motivo ?? a.tipo ?? "sem motivo"}`,
        prioridade: "alta",
        data: new Date(a.data).toISOString().slice(0, 10),
        funcionarioNome: a.funcionario.nome,
      });
    }

    // Ordenar: alta → media → baixa
    const order = { alta: 0, media: 1, baixa: 2 };
    notificacoes.sort((a, b) => order[a.prioridade] - order[b.prioridade]);

    return NextResponse.json(notificacoes);
  } catch (e) {
    return NextResponse.json(
      { error: "Erro ao buscar notificações", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
