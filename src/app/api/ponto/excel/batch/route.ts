import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { detectOcorrencia, calcHoursFromPunches, getCargaDiaria } from "@/lib/schedule";
import { normalizeName, groupConsecutiveDates, type ParsedRecord } from "@/lib/parse-excel-ponto";

export const maxDuration = 60;

function punchesToFields(punches: Date[]) {
  const n = punches.length;
  return {
    entrada:       punches[0]                              ?? null,
    saida1:        n === 6 ? punches[1]                   : null,
    entrada2:      n === 6 ? punches[2]                   : null,
    saidaAlmoco:   n >= 4  ? (n === 6 ? punches[3] : punches[1]) : null,
    retornoAlmoco: n >= 4  ? (n === 6 ? punches[4] : punches[2]) : null,
    saida:         n >= 2  ? punches[n - 1]               : null,
  };
}

type PontoPayload = {
  funcionarioId: string;
  data: Date;
  entrada: Date | null;
  saida1: Date | null;
  entrada2: Date | null;
  saidaAlmoco: Date | null;
  retornoAlmoco: Date | null;
  saida: Date | null;
  horasTrabalhadas: number;
  horasExtras: number;
  ocorrencia: string;
};

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const body = await req.json();
    const records: ParsedRecord[] = body?.records ?? [];

    if (records.length === 0) {
      return NextResponse.json({ imported: 0, updated: 0, total: 0, unmatched: [], errors: [] });
    }

    const funcionarios = await prisma.funcionario.findMany({
      select: { id: true, nome: true, restaurante: { select: { nome: true } } },
    });
    const byName = new Map(funcionarios.map((f) => [normalizeName(f.nome), f]));

    function resolveFuncionario(nome: string) {
      const norm = normalizeName(nome);
      return byName.get(norm) ?? [...byName.entries()].find(([k]) => k.includes(norm) || norm.includes(k))?.[1];
    }

    const unmatched = new Set<string>();
    const errors: string[] = [];
    const payloads: PontoPayload[] = [];
    const atestadoGroups = new Map<string, { nome: string; dates: string[] }>();

    for (const rec of records) {
      const funcionario = resolveFuncionario(rec.nomeFuncionario);
      if (!funcionario) { unmatched.add(rec.nomeFuncionario); continue; }

      if (rec.tipo === "ATESTADO") {
        if (!atestadoGroups.has(funcionario.id)) atestadoGroups.set(funcionario.id, { nome: rec.nomeFuncionario, dates: [] });
        atestadoGroups.get(funcionario.id)!.dates.push(rec.dateStr);
        continue;
      }

      const dataDate = new Date(`${rec.dateStr}T00:00:00`);

      if (rec.tipo === "FOLGA") {
        payloads.push({
          funcionarioId: funcionario.id, data: dataDate,
          entrada: null, saida1: null, entrada2: null, saidaAlmoco: null, retornoAlmoco: null, saida: null,
          horasTrabalhadas: 0, horasExtras: 0, ocorrencia: "FOLGA",
        });
        continue;
      }

      let entrada: Date | null = null, saida1: Date | null = null, entrada2: Date | null = null;
      let saidaAlmoco: Date | null = null, retornoAlmoco: Date | null = null, saida: Date | null = null;

      if (rec.tempos) {
        const t = rec.tempos;
        const toD = (s: string | null) => s ? new Date(`${rec.dateStr}T${s}:00`) : null;
        entrada = toD(t.e1); saida1 = toD(t.s1); entrada2 = toD(t.e2);
        saidaAlmoco = toD(t.s2); retornoAlmoco = toD(t.e3); saida = toD(t.s3);
      } else if (rec.batidas && rec.batidas.length > 0) {
        const dates = rec.batidas.map(t => new Date(`${rec.dateStr}T${t}:00`));
        const paired = dates.length % 2 === 0 ? dates : dates.slice(0, -1);
        const f = punchesToFields(paired);
        entrada = f.entrada; saida1 = f.saida1; entrada2 = f.entrada2;
        saidaAlmoco = f.saidaAlmoco; retornoAlmoco = f.retornoAlmoco; saida = f.saida;
      }

      const punches = [entrada, saida1, entrada2, saidaAlmoco, retornoAlmoco, saida].filter(Boolean) as Date[];
      const horasTrabalhadas = calcHoursFromPunches(punches);
      const carga = getCargaDiaria(funcionario.restaurante.nome, dataDate);
      const horasExtras = Math.max(0, Math.round((horasTrabalhadas - carga) * 100) / 100);
      const ocorrencia = detectOcorrencia(entrada ?? undefined, dataDate, horasTrabalhadas, funcionario.restaurante.nome);

      payloads.push({ funcionarioId: funcionario.id, data: dataDate, entrada, saida1, entrada2, saidaAlmoco, retornoAlmoco, saida, horasTrabalhadas, horasExtras, ocorrencia });
    }

    let imported = 0;
    let updated = 0;

    if (payloads.length > 0) {
      const funcionarioIds = [...new Set(payloads.map(p => p.funcionarioId))];
      const timestamps = payloads.map(p => p.data.getTime());
      const minDate = new Date(Math.min(...timestamps));
      const maxDate = new Date(Math.max(...timestamps));

      // Single query to find all existing records in the date range
      const existingRecords = await prisma.registroPonto.findMany({
        where: { funcionarioId: { in: funcionarioIds }, data: { gte: minDate, lte: maxDate } },
        select: { id: true, funcionarioId: true, data: true },
      });

      const existingMap = new Map(
        existingRecords.map(r => [`${r.funcionarioId}|${r.data.toISOString()}`, r.id])
      );

      const toCreate: PontoPayload[] = [];
      const toUpdate: Array<{ id: string; payload: PontoPayload }> = [];

      for (const p of payloads) {
        const existingId = existingMap.get(`${p.funcionarioId}|${p.data.toISOString()}`);
        if (existingId) toUpdate.push({ id: existingId, payload: p });
        else toCreate.push(p);
      }

      // Split into chunks of 100 to stay within Turso's per-transaction limits
      const TX = 100;
      for (let i = 0; i < toCreate.length; i += TX) {
        const chunk = toCreate.slice(i, i + TX);
        try {
          await prisma.$transaction(chunk.map(p => prisma.registroPonto.create({ data: p })));
          imported += chunk.length;
        } catch (e) {
          errors.push(`Erro criar lote ${Math.floor(i / TX) + 1}: ${e instanceof Error ? e.message : String(e)}`);
          break;
        }
      }

      for (let i = 0; i < toUpdate.length; i += TX) {
        const chunk = toUpdate.slice(i, i + TX);
        try {
          await prisma.$transaction(chunk.map(({ id, payload }) => prisma.registroPonto.update({ where: { id }, data: payload })));
          updated += chunk.length;
        } catch (e) {
          errors.push(`Erro atualizar lote ${Math.floor(i / TX) + 1}: ${e instanceof Error ? e.message : String(e)}`);
          break;
        }
      }
    }

    // Atestados
    for (const [funcionarioId, { nome, dates }] of atestadoGroups) {
      const sortedDates = [...dates].sort();
      const rangeStart = new Date(`${sortedDates[0]}T00:00:00`);
      const rangeEnd   = new Date(`${sortedDates[sortedDates.length - 1]}T00:00:00`);
      try {
        await prisma.ausencia.deleteMany({
          where: { funcionarioId, tipo: "ATESTADO_MEDICO", dataInicio: { lte: rangeEnd }, dataFim: { gte: rangeStart } },
        });
        const spans = groupConsecutiveDates(sortedDates);
        for (const span of spans) {
          await prisma.ausencia.create({
            data: {
              funcionarioId, tipo: "ATESTADO_MEDICO",
              dataInicio: new Date(`${span.start}T00:00:00`),
              dataFim:    new Date(`${span.end}T00:00:00`),
              diasAfastamento: span.days,
              status: "APROVADO",
              motivo: "Importado via planilha",
            },
          });
          imported++;
        }
      } catch { errors.push(`${nome}: erro ao salvar atestado`); }
    }

    return NextResponse.json({ imported, updated, unmatched: Array.from(unmatched), errors, total: imported + updated });
  } catch (e) {
    console.error("[POST /api/ponto/excel/batch]", e);
    return NextResponse.json(
      { error: "Erro interno no servidor", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
