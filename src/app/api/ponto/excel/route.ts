import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { detectOcorrencia, calcHoursFromPunches, getCargaDiaria } from "@/lib/schedule";
import * as XLSX from "xlsx";

// ─── helpers ────────────────────────────────────────────────────────────────

const SKIP_VALUES = new Set(["folga", "ferias", "férias", "atesta", "atestad", "atestado", "falta", "ausen", "mat", "pat", "acid", ""]);

function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/** Parse time cell → "HH:MM"
 *  Handles: Excel numeric fraction, "HH:MM", "HH:MM*", "HH:MM^" */
function parseTime(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") {
    const totalMin = Math.round(v * 24 * 60);
    const hh = Math.floor(totalMin / 60) % 24;
    const mm = totalMin % 60;
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  }
  if (typeof v === "string") {
    // Strip trailing markers (* ^ etc.) and whitespace
    const clean = v.trim().replace(/[*^]+$/, "").trim();
    const m = clean.match(/^(\d{1,2}):(\d{2})$/);
    if (m) return `${m[1].padStart(2, "0")}:${m[2]}`;
  }
  return null;
}

/** Parse date cell → "YYYY-MM-DD"
 *  Handles: "01/03/26 - dom", "01/03/2026", "YYYY-MM-DD", Excel serial */
function parseDate(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "string") {
    const s = v.trim();
    // "DD/MM/YY - dow" (Cartão Ponto format)
    const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})\s*-/);
    if (m1) {
      const year = 2000 + parseInt(m1[3]);
      return `${year}-${m1[2].padStart(2, "0")}-${m1[1].padStart(2, "0")}`;
    }
    // "DD/MM/YYYY"
    const m2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m2) return `${m2[3]}-${m2[2].padStart(2, "0")}-${m2[1].padStart(2, "0")}`;
    // "YYYY-MM-DD"
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  }
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  return null;
}

function cellStr(row: unknown[], col: number): string {
  return String(row[col] ?? "").trim();
}

// ─── Detect Cartão Ponto format ──────────────────────────────────────────────

function isCartaoPonto(rows: unknown[][]): boolean {
  return String(rows[0]?.[0] ?? "").trim().toUpperCase().includes("CARTÃO PONTO") ||
         String(rows[0]?.[0] ?? "").trim().toUpperCase().includes("CARTAO PONTO");
}

// ─── Parse Cartão Ponto format ───────────────────────────────────────────────
// Employee name in header; data rows identified by date in col A

interface ParsedRecord {
  nomeFuncionario: string;
  dateStr: string;
  batidas: string[];
  tipo?: "FOLGA" | "ATESTADO";
}

function parseCartaoPonto(rows: unknown[][]): ParsedRecord[] {
  // Find employee name: look for row where col A = "Nome"
  let nomeFuncionario = "";
  let dataStartRow = -1;

  for (let i = 0; i < rows.length; i++) {
    const a = cellStr(rows[i], 0).toLowerCase();
    if (a === "nome") {
      nomeFuncionario = cellStr(rows[i], 1);
    }
    if (a === "data") {
      dataStartRow = i + 2; // +1 for totals row, +1 to start at first day
      break;
    }
  }

  if (!nomeFuncionario || dataStartRow < 0) return [];

  const records: ParsedRecord[] = [];

  for (let i = dataStartRow; i < rows.length; i++) {
    const row = rows[i];
    const dateStr = parseDate(row[0]);
    if (!dateStr) break; // End of data section

    // Columns B(1)=Ent.1, C(2)=Saí.1, D(3)=Ent.2, E(4)=Saí.2
    const b1 = cellStr(row, 1).toLowerCase().replace(/[*^]+$/, "").trim();
    if (b1 === "folga") {
      records.push({ nomeFuncionario, dateStr, batidas: [], tipo: "FOLGA" });
      continue;
    }
    if (b1.startsWith("atesta")) {
      records.push({ nomeFuncionario, dateStr, batidas: [], tipo: "ATESTADO" });
      continue;
    }
    if (SKIP_VALUES.has(b1)) continue;

    const batidas: string[] = [];
    for (let c = 1; c <= 4; c++) {
      const t = parseTime(row[c]);
      if (t) batidas.push(t);
    }

    if (batidas.length === 0) continue;

    records.push({ nomeFuncionario, dateStr, batidas });
  }

  return records;
}

// ─── Parse simple format (Nome | Data | Batida 1-6) ─────────────────────────

function parseSimpleFormat(rows: unknown[][]): ParsedRecord[] {
  const headerRow = rows[0].map((h) => String(h).toLowerCase().trim());
  const col = (names: string[]) => headerRow.findIndex((h) => names.some((n) => h.includes(n)));

  const iNome = col(["nome"]);
  const iData = col(["data"]);
  const iBat  = [1, 2, 3, 4, 5, 6].map((n) => col([`batida ${n}`, `batida${n}`]));

  if (iNome < 0 || iData < 0) return [];

  const records: ParsedRecord[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const nome = cellStr(row, iNome);
    if (!nome) continue;
    const dateStr = parseDate(row[iData]);
    if (!dateStr) continue;

    const batidas: string[] = [];
    for (const idx of iBat) {
      if (idx < 0) continue;
      const t = parseTime(row[idx]);
      if (t) batidas.push(t);
    }

    if (batidas.length === 0) continue;
    records.push({ nomeFuncionario: nome, dateStr, batidas });
  }

  return records;
}

// ─── Group consecutive dates into spans ─────────────────────────────────────

function groupConsecutiveDates(dates: string[]): { start: string; end: string; days: number }[] {
  const sorted = [...dates].sort(); // YYYY-MM-DD sorts correctly as strings
  const spans: { start: string; end: string; days: number }[] = [];
  let spanStart = sorted[0];
  let prev = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const diffDays = Math.round(
      (new Date(sorted[i] + "T12:00:00").getTime() - new Date(prev + "T12:00:00").getTime()) / 86_400_000
    );
    if (diffDays === 1) {
      prev = sorted[i];
    } else {
      const days = Math.round((new Date(prev + "T12:00:00").getTime() - new Date(spanStart + "T12:00:00").getTime()) / 86_400_000) + 1;
      spans.push({ start: spanStart, end: prev, days });
      spanStart = sorted[i];
      prev = sorted[i];
    }
  }
  const days = Math.round((new Date(prev + "T12:00:00").getTime() - new Date(spanStart + "T12:00:00").getTime()) / 86_400_000) + 1;
  spans.push({ start: spanStart, end: prev, days });
  return spans;
}

// ─── GET — download blank template ──────────────────────────────────────────

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const wb = XLSX.utils.book_new();
  const headers = ["Nome", "Data", "Batida 1", "Batida 2", "Batida 3", "Batida 4", "Batida 5", "Batida 6"];
  const example = ["NOME DO FUNCIONÁRIO", "01/03/2026", "11:00", "14:30", "18:00", "18:30", "19:00", "23:00"];
  const ws = XLSX.utils.aoa_to_sheet([headers, example]);
  ws["!cols"] = [{ wch: 40 }, { wch: 14 }, ...Array(6).fill({ wch: 12 })];
  XLSX.utils.book_append_sheet(wb, ws, "Ponto");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="template_ponto.xlsx"',
    },
  });
}

// ─── POST — import Excel file ────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 });

  const arrayBuffer = await file.arrayBuffer();
  const wb = XLSX.read(new Uint8Array(arrayBuffer), { type: "array", cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });

  if (rows.length < 2) {
    return NextResponse.json({ error: "Planilha vazia ou sem dados" }, { status: 400 });
  }

  // Auto-detect format
  const records = isCartaoPonto(rows)
    ? parseCartaoPonto(rows)
    : parseSimpleFormat(rows);

  if (records.length === 0) {
    return NextResponse.json({ error: "Nenhum registro encontrado na planilha" }, { status: 400 });
  }

  // Load all employees for name matching
  const funcionarios = await prisma.funcionario.findMany({
    select: { id: true, nome: true, restaurante: { select: { nome: true } } },
  });
  const byName = new Map(funcionarios.map((f) => [normalizeName(f.nome), f]));

  let imported = 0;
  let updated  = 0;
  const unmatched = new Set<string>();
  const errors: string[] = [];

  function resolveFuncionario(nome: string) {
    const norm = normalizeName(nome);
    return byName.get(norm) ?? [...byName.entries()].find(([k]) => k.includes(norm) || norm.includes(k))?.[1];
  }

  // Pre-pass: collect consecutive ATESTADO dates per employee before the main loop
  const atestadoGroups = new Map<string, { nome: string; dates: string[] }>();
  for (const rec of records) {
    if (rec.tipo !== "ATESTADO") continue;
    const funcionario = resolveFuncionario(rec.nomeFuncionario);
    if (!funcionario) { unmatched.add(rec.nomeFuncionario); continue; }
    if (!atestadoGroups.has(funcionario.id)) atestadoGroups.set(funcionario.id, { nome: rec.nomeFuncionario, dates: [] });
    atestadoGroups.get(funcionario.id)!.dates.push(rec.dateStr);
  }

  // Main loop: FOLGA + punch records (ATESTADO handled separately)
  for (const rec of records) {
    if (rec.tipo === "ATESTADO") continue;

    const funcionario = resolveFuncionario(rec.nomeFuncionario);
    if (!funcionario) { unmatched.add(rec.nomeFuncionario); continue; }

    const { dateStr, batidas } = rec;
    const dataDate = new Date(`${dateStr}T00:00:00`);

    if (rec.tipo === "FOLGA") {
      try {
        const existing = await prisma.registroPonto.findFirst({ where: { funcionarioId: funcionario.id, data: dataDate } });
        const payload = { funcionarioId: funcionario.id, data: dataDate, entrada: null, saidaAlmoco: null, retornoAlmoco: null, saida: null, horasTrabalhadas: 0, horasExtras: 0, ocorrencia: "FOLGA" };
        if (existing) { await prisma.registroPonto.update({ where: { id: existing.id }, data: payload }); updated++; }
        else { await prisma.registroPonto.create({ data: payload }); imported++; }
      } catch { errors.push(`${rec.nomeFuncionario} / ${dateStr}: erro ao salvar folga`); }
      continue;
    }

    const toDate = (t: string) => new Date(`${dateStr}T${t}:00`);
    const dates  = batidas.map(toDate);
    const paired = dates.length % 2 === 0 ? dates : dates.slice(0, -1);

    const n = paired.length;
    const entrada       = paired[0]   ?? null;
    const saidaAlmoco   = n >= 4 ? paired[n - 3] : null;
    const retornoAlmoco = n >= 4 ? paired[n - 2] : null;
    const saida         = n >= 2 ? paired[n - 1] : null;

    const horasTrabalhadas = calcHoursFromPunches(paired);
    const carga = getCargaDiaria(funcionario.restaurante.nome, dataDate);
    const horasExtras = Math.max(0, Math.round((horasTrabalhadas - carga) * 100) / 100);
    const ocorrencia = detectOcorrencia(entrada ?? undefined, dataDate, horasTrabalhadas);

    const payload = { funcionarioId: funcionario.id, data: dataDate, entrada, saidaAlmoco, retornoAlmoco, saida, horasTrabalhadas, horasExtras, ocorrencia };

    try {
      const existing = await prisma.registroPonto.findFirst({ where: { funcionarioId: funcionario.id, data: dataDate } });
      if (existing) {
        await prisma.registroPonto.update({ where: { id: existing.id }, data: payload });
        updated++;
      } else {
        await prisma.registroPonto.create({ data: payload });
        imported++;
      }
    } catch {
      errors.push(`${rec.nomeFuncionario} / ${dateStr}: erro ao salvar`);
    }
  }

  // Post-loop: save grouped ATESTADO spans — delete any overlapping records first
  for (const [funcionarioId, { nome, dates }] of atestadoGroups) {
    const sortedDates = [...dates].sort();
    const rangeStart = new Date(`${sortedDates[0]}T00:00:00`);
    const rangeEnd   = new Date(`${sortedDates[sortedDates.length - 1]}T00:00:00`);

    try {
      // Remove all ATESTADO_MEDICO ausencias that overlap with the imported date range
      await prisma.ausencia.deleteMany({
        where: { funcionarioId, tipo: "ATESTADO_MEDICO", dataInicio: { lte: rangeEnd }, dataFim: { gte: rangeStart } },
      });

      const spans = groupConsecutiveDates(sortedDates);
      for (const span of spans) {
        await prisma.ausencia.create({
          data: {
            funcionarioId,
            tipo: "ATESTADO_MEDICO",
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
}
