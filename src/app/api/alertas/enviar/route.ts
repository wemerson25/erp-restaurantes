import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { sendWhatsAppText, sleep } from "@/lib/whatsapp";
import { ensureBeneficioExtraTable } from "@/lib/beneficio-extra-setup";

export const maxDuration = 60;

/* ─── Helpers ────────────────────────────────────────────────── */
function addYears(date: Date, years: number) {
  const d = new Date(date); d.setFullYear(d.getFullYear() + years); return d;
}
function daysBetween(a: Date, b: Date) {
  return Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}
function fmtDate(d: Date) {
  return d.toLocaleDateString("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit" });
}

/* ─── Tipos de alerta ─────────────────────────────────────────── */
type Priority = "alta" | "media";
interface Alert {
  tipo: string; prioridade: Priority; descricao: string;
  data?: string; funcionarioId?: string;
  funcionarioNome?: string; funcionarioTelefone?: string;
}

/* ─── Builders de mensagem ────────────────────────────────────── */
function buildSummaryMessage(
  altas: Alert[], medias: Alert[], dataHoje: string,
  admitidos: { nome: string; cargo: string; restaurante: string }[],
  demitidos: { nome: string; cargo: string; restaurante: string; dataDemissao: Date | null }[],
  vagas: { titulo: string; restaurante: string; diasAberta: number }[],
): string {
  const lines: string[] = [`🔔 *Alertas RH — ${dataHoje}*\n`];

  if (altas.length > 0) {
    lines.push(`🔴 *Urgente (${altas.length}):*`);
    for (const a of altas) lines.push(`• ${a.descricao}`);
    lines.push("");
  }
  if (medias.length > 0) {
    lines.push(`🟡 *Atenção (${medias.length}):*`);
    for (const a of medias) lines.push(`• ${a.descricao}`);
    lines.push("");
  }
  if (admitidos.length > 0) {
    lines.push(`✅ *Admissões esta semana (${admitidos.length}):*`);
    for (const f of admitidos) lines.push(`• ${f.nome} — ${f.cargo} (${f.restaurante})`);
    lines.push("");
  }
  if (demitidos.length > 0) {
    lines.push(`❌ *Demissões esta semana (${demitidos.length}):*`);
    for (const f of demitidos) {
      const data = f.dataDemissao ? ` — ${fmtDate(new Date(f.dataDemissao))}` : "";
      lines.push(`• ${f.nome} — ${f.cargo} (${f.restaurante})${data}`);
    }
    lines.push("");
  }
  if (vagas.length > 0) {
    lines.push(`📢 *Vagas abertas (${vagas.length}):*`);
    for (const v of vagas) lines.push(`• ${v.titulo} — ${v.restaurante} (${v.diasAberta}d aberta)`);
    lines.push("");
  }
  lines.push("_Enviado pelo ERP Restaurantes_");
  return lines.join("\n");
}

function buildIndividualMessage(tipo: string, nome: string, extra: Record<string, string | number>): string {
  switch (tipo) {
    case "FERIAS_INICIANDO":
      return `Olá, *${nome}*! 🌴\n\nSuas férias iniciam ${extra.dias === 0 ? "*hoje*" : `em *${extra.dias} dia${Number(extra.dias) === 1 ? "" : "s"}*`}${extra.data ? ` (${extra.data})` : ""}.\n\nBom descanso! 😊\n_— Equipe RH_`;
    case "ANIVERSARIO_HOJE":
      return `🎂 *Feliz Aniversário, ${nome}!*\n\nToda a equipe deseja um dia muito especial para você! 🎉🎊\n\n_— Com carinho, Equipe Ykedin_`;
    case "ANIVERSARIO_ADMISSAO":
      return `🏆 *Parabéns, ${nome}!*\n\nHoje você completa *${extra.anos} ano${Number(extra.anos) === 1 ? "" : "s"}* na nossa equipe! Muito obrigado pela sua dedicação. 💪\n\n_— Equipe Ykedin_`;
    case "FOLGA_ANIVERSARIO_EXPIRANDO":
      return `Olá, *${nome}*! ⚠️\n\nVocê tem *${extra.qtd} folga${Number(extra.qtd) === 1 ? "" : "s"}* de aniversário vencendo em *${extra.dias} dia${Number(extra.dias) === 1 ? "" : "s"}*.\n\nAgende com o RH antes de perder o benefício!\n\n_— Equipe RH_`;
    case "FOLGA_EXTRA_EXPIRANDO":
      return `Olá, *${nome}*! ⚠️\n\nSua *folga benefício* (_${extra.motivo}_) vence em *${extra.dias} dia${Number(extra.dias) === 1 ? "" : "s"}*.\n\nAgende com o RH para não perder!\n\n_— Equipe RH_`;
    default: return "";
  }
}

/* ─── Rota principal ─────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    await ensureBeneficioExtraTable();
    const body = await req.json().catch(() => ({})) as { dryRun?: boolean; gestorTelefones?: string[]; grupos?: string[] };
    const dryRun = body.dryRun === true;
    const gestorTelefones: string[] = Array.isArray(body.gestorTelefones) && body.gestorTelefones.length > 0
      ? body.gestorTelefones
      : (process.env.WHATSAPP_GESTAO ? [process.env.WHATSAPP_GESTAO] : []);
    const ALL_GRUPOS = ["ferias", "aniversarios", "folgas", "admissoes", "demissoes", "vagas"];
    const grupos = new Set<string>(
      Array.isArray(body.grupos) && body.grupos.length > 0 ? body.grupos : ALL_GRUPOS
    );
    const TIPO_GRUPO: Record<string, string> = {
      FERIAS_INICIANDO: "ferias", FERIAS_VENCENDO: "ferias",
      ANIVERSARIO_HOJE: "aniversarios", ANIVERSARIO_SEMANA: "aniversarios", ANIVERSARIO_ADMISSAO: "aniversarios",
      FOLGA_ANIVERSARIO_EXPIRANDO: "folgas", FOLGA_EXTRA_EXPIRANDO: "folgas",
    };

    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    const em7dias  = new Date(today); em7dias.setUTCDate(em7dias.getUTCDate() + 7);
    const em30dias = new Date(today); em30dias.setUTCDate(em30dias.getUTCDate() + 30);
    const ha7dias  = new Date(today); ha7dias.setUTCDate(ha7dias.getUTCDate() - 7);

    const [
      funcionarios, feriasProximas, todasFerias, folgasAniv, folgasExtra,
      recemAdmitidos, recemDemitidos, vagasAbertas,
    ] = await Promise.all([
      prisma.funcionario.findMany({
        where: { status: "ATIVO" },
        select: { id: true, nome: true, telefone: true, dataNascimento: true, dataAdmissao: true, restaurante: { select: { nome: true } } },
      }),
      prisma.ferias.findMany({
        where: { status: "AGENDADA", dataInicio: { gte: today, lte: em30dias } },
        include: { funcionario: { select: { id: true, nome: true, telefone: true } } },
        orderBy: { dataInicio: "asc" },
      }),
      prisma.ferias.findMany({
        where: { status: { in: ["AGENDADA", "EM_ANDAMENTO", "CONCLUIDA"] } },
        select: { funcionarioId: true, dataInicio: true },
      }),
      prisma.folgaAniversario.findMany({
        where: { dataValidade: { gte: today, lte: em30dias } },
        include: { funcionario: { select: { id: true, nome: true, telefone: true } } },
      }),
      prisma.folgaBeneficioExtra.findMany({
        where: { status: "DISPONIVEL", dataValidade: { gte: today, lte: em30dias } },
        include: { funcionario: { select: { id: true, nome: true, telefone: true } } },
      }),
      prisma.funcionario.findMany({
        where: { dataAdmissao: { gte: ha7dias } },
        select: { nome: true, cargo: { select: { nome: true } }, restaurante: { select: { nome: true } } },
        orderBy: { dataAdmissao: "desc" },
      }),
      prisma.funcionario.findMany({
        where: { dataDemissao: { gte: ha7dias }, status: { in: ["INATIVO", "DEMITIDO"] } },
        select: { nome: true, dataDemissao: true, cargo: { select: { nome: true } }, restaurante: { select: { nome: true } } },
        orderBy: { dataDemissao: "desc" },
      }),
      prisma.vaga.findMany({
        where: { status: "ABERTA" },
        select: { titulo: true, restaurante: { select: { nome: true } }, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const feriasMap = new Map<string, Date[]>();
    for (const f of todasFerias) {
      if (!feriasMap.has(f.funcionarioId)) feriasMap.set(f.funcionarioId, []);
      feriasMap.get(f.funcionarioId)!.push(new Date(f.dataInicio));
    }

    const altas: Alert[] = [];
    const medias: Alert[] = [];

    // Férias iniciando
    for (const f of feriasProximas) {
      const dias = daysBetween(today, new Date(f.dataInicio));
      const a: Alert = {
        tipo: "FERIAS_INICIANDO", prioridade: dias <= 3 ? "alta" : "media",
        descricao: `Férias de ${f.funcionario.nome} iniciam ${dias === 0 ? "hoje" : `em ${dias} dia(s)`} (${fmtDate(new Date(f.dataInicio))})`,
        data: new Date(f.dataInicio).toISOString().slice(0, 10),
        funcionarioId: f.funcionario.id, funcionarioNome: f.funcionario.nome,
        funcionarioTelefone: f.funcionario.telefone ?? undefined,
      };
      (a.prioridade === "alta" ? altas : medias).push(a);
    }

    // Férias vencendo
    for (const func of funcionarios) {
      const adm = new Date(func.dataAdmissao);
      let anos = 0; while (addYears(adm, anos + 1) <= today) anos++;
      if (anos < 1) continue;
      const periodoFim = addYears(adm, anos + 1);
      if (periodoFim <= today) continue;
      const diasAteVencer = daysBetween(today, periodoFim);
      if (diasAteVencer > 60) continue;
      const temFerias = (feriasMap.get(func.id) ?? []).some(d => d >= addYears(adm, anos) && d <= periodoFim);
      if (!temFerias) {
        const a: Alert = {
          tipo: "FERIAS_VENCENDO", prioridade: diasAteVencer <= 30 ? "alta" : "media",
          descricao: `${func.nome} — férias sem agendar, vence em ${diasAteVencer} dia(s) (${fmtDate(periodoFim)})`,
          data: periodoFim.toISOString().slice(0, 10),
          funcionarioId: func.id, funcionarioNome: func.nome,
        };
        (a.prioridade === "alta" ? altas : medias).push(a);
      }
    }

    // Folgas aniversário expirando
    for (const fa of folgasAniv) {
      const disponivel = 2 - fa.folgasUsadas;
      if (disponivel <= 0) continue;
      const dias = daysBetween(today, new Date(fa.dataValidade));
      const a: Alert = {
        tipo: "FOLGA_ANIVERSARIO_EXPIRANDO", prioridade: dias <= 7 ? "alta" : "media",
        descricao: `${fa.funcionario.nome} — ${disponivel} folga(s) aniversário vence(m) em ${dias} dia(s)`,
        data: new Date(fa.dataValidade).toISOString().slice(0, 10),
        funcionarioId: fa.funcionario.id, funcionarioNome: fa.funcionario.nome,
        funcionarioTelefone: fa.funcionario.telefone ?? undefined,
      };
      (a.prioridade === "alta" ? altas : medias).push(a);
    }

    // Folgas extra expirando
    for (const fe of folgasExtra) {
      if (!fe.dataValidade) continue;
      const dias = daysBetween(today, new Date(fe.dataValidade));
      const a: Alert = {
        tipo: "FOLGA_EXTRA_EXPIRANDO", prioridade: dias <= 7 ? "alta" : "media",
        descricao: `${fe.funcionario.nome} — folga "${fe.motivo}" vence em ${dias} dia(s)`,
        data: new Date(fe.dataValidade).toISOString().slice(0, 10),
        funcionarioId: fe.funcionario.id, funcionarioNome: fe.funcionario.nome,
        funcionarioTelefone: fe.funcionario.telefone ?? undefined,
      };
      (a.prioridade === "alta" ? altas : medias).push(a);
    }

    // Aniversários
    for (const func of funcionarios) {
      const nasc = new Date(func.dataNascimento);
      const y = today.getUTCFullYear();
      const bdThis = new Date(Date.UTC(y, nasc.getUTCMonth(), nasc.getUTCDate()));
      const bd = bdThis >= today ? bdThis : new Date(Date.UTC(y + 1, nasc.getUTCMonth(), nasc.getUTCDate()));
      const dias = daysBetween(today, bd);
      if (dias > 7) continue;
      const a: Alert = {
        tipo: dias === 0 ? "ANIVERSARIO_HOJE" : "ANIVERSARIO_SEMANA",
        prioridade: dias === 0 ? "alta" : "media",
        descricao: dias === 0 ? `🎂 ${func.nome} faz aniversário HOJE` : `${func.nome} faz aniversário em ${dias} dia(s)`,
        funcionarioId: func.id, funcionarioNome: func.nome,
        funcionarioTelefone: func.telefone ?? undefined,
      };
      (a.prioridade === "alta" ? altas : medias).push(a);
    }

    // Aniversários de empresa (hoje)
    for (const func of funcionarios) {
      const adm = new Date(func.dataAdmissao);
      const y = today.getUTCFullYear();
      const anivHoje = new Date(Date.UTC(y, adm.getUTCMonth(), adm.getUTCDate()));
      if (anivHoje.toISOString().slice(0, 10) !== today.toISOString().slice(0, 10)) continue;
      const anos = y - adm.getUTCFullYear();
      if (anos < 1) continue;
      medias.push({
        tipo: "ANIVERSARIO_ADMISSAO", prioridade: "media",
        descricao: `🏆 ${func.nome} completa ${anos} ano(s) de empresa hoje`,
        funcionarioId: func.id, funcionarioNome: func.nome,
        funcionarioTelefone: func.telefone ?? undefined,
      });
    }

    // Filtrar por grupos selecionados
    const altasFilt  = altas.filter(a => grupos.has(TIPO_GRUPO[a.tipo] ?? ""));
    const mediasFilt = medias.filter(a => grupos.has(TIPO_GRUPO[a.tipo] ?? ""));
    const admRows  = grupos.has("admissoes") ? recemAdmitidos.map(f => ({ nome: f.nome, cargo: f.cargo.nome, restaurante: f.restaurante.nome })) : [];
    const demRows  = grupos.has("demissoes") ? recemDemitidos.map(f => ({ nome: f.nome, cargo: f.cargo.nome, restaurante: f.restaurante.nome, dataDemissao: f.dataDemissao ?? null })) : [];
    const vagRows  = grupos.has("vagas")     ? vagasAbertas.map(v => ({ titulo: v.titulo, restaurante: v.restaurante.nome, diasAberta: daysBetween(new Date(v.createdAt), today) })) : [];

    const temConteudo = altasFilt.length + mediasFilt.length + admRows.length + demRows.length + vagRows.length > 0;
    if (!temConteudo) {
      return NextResponse.json({ ok: true, enviados: 0, erros: [], message: "Nenhum alerta para enviar com os tipos selecionados" });
    }

    /* ── Montar mensagens ── */
    const dataHoje = today.toLocaleDateString("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" });

    interface Msg { to: string; label: string; text: string }
    const mensagens: Msg[] = [];

    // Resumo gestão — enviar para cada gestor selecionado
    if (gestorTelefones.length > 0) {
      const summaryText = buildSummaryMessage(altasFilt, mediasFilt, dataHoje, admRows, demRows, vagRows);
      for (const tel of gestorTelefones) {
        mensagens.push({
          to: tel,
          label: `Resumo gestão → ${tel} (${altasFilt.length + mediasFilt.length} alertas, ${admRows.length} adm, ${demRows.length} dem, ${vagRows.length} vagas)`,
          text: summaryText,
        });
      }
    }

    // Mensagens individuais
    const TIPOS_INDIVIDUAIS = new Set(["FERIAS_INICIANDO", "ANIVERSARIO_HOJE", "ANIVERSARIO_ADMISSAO", "FOLGA_ANIVERSARIO_EXPIRANDO", "FOLGA_EXTRA_EXPIRANDO"]);
    const jaEnviado = new Set<string>();

    for (const alert of [...altasFilt, ...mediasFilt]) {
      if (!TIPOS_INDIVIDUAIS.has(alert.tipo) || !alert.funcionarioTelefone) continue;
      const key = `${alert.tipo}|${alert.funcionarioId}`;
      if (jaEnviado.has(key)) continue;
      jaEnviado.add(key);

      let extra: Record<string, string | number> = {};
      if (alert.tipo === "FERIAS_INICIANDO") {
        const dias = alert.data ? daysBetween(today, new Date(alert.data)) : 0;
        extra = { dias, data: alert.data ? fmtDate(new Date(alert.data)) : "" };
      } else if (alert.tipo === "ANIVERSARIO_ADMISSAO") {
        const adm = funcionarios.find(f => f.id === alert.funcionarioId)?.dataAdmissao;
        extra = { anos: adm ? today.getUTCFullYear() - new Date(adm).getUTCFullYear() : 1 };
      } else if (alert.tipo === "FOLGA_ANIVERSARIO_EXPIRANDO") {
        const fa = folgasAniv.find(f => f.funcionarioId === alert.funcionarioId);
        extra = { qtd: fa ? 2 - fa.folgasUsadas : 1, dias: alert.data ? daysBetween(today, new Date(alert.data)) : 0 };
      } else if (alert.tipo === "FOLGA_EXTRA_EXPIRANDO") {
        const fe = folgasExtra.find(f => f.funcionarioId === alert.funcionarioId);
        extra = { motivo: fe?.motivo ?? "", dias: alert.data ? daysBetween(today, new Date(alert.data)) : 0 };
      }

      const text = buildIndividualMessage(alert.tipo, alert.funcionarioNome ?? "", extra);
      if (!text) continue;
      mensagens.push({ to: alert.funcionarioTelefone, label: `Individual → ${alert.funcionarioNome} (${alert.tipo})`, text });
    }

    /* ── Enviar ── */
    const resultados: { label: string; status: "ok" | "erro" | "dry-run"; error?: string }[] = [];
    for (const msg of mensagens) {
      if (dryRun) { resultados.push({ label: msg.label, status: "dry-run" }); continue; }
      const r = await sendWhatsAppText(msg.to, msg.text);
      resultados.push({ label: msg.label, status: r.ok ? "ok" : "erro", error: r.error });
      if (r.ok) await sleep(1200);
    }

    const enviados = resultados.filter(r => r.status === "ok").length;
    const erros    = resultados.filter(r => r.status === "erro").map(r => `${r.label}: ${r.error}`);
    const preview  = dryRun ? mensagens.map(m => `[${m.label}]\n${m.text}`) : [];

    return NextResponse.json({ ok: true, enviados, erros, preview, total: mensagens.length, dryRun });
  } catch (e) {
    return NextResponse.json({ error: "Erro ao enviar alertas", detail: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
