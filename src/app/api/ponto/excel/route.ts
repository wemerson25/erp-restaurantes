import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { detectOcorrencia, calcHoursFromPunches } from "@/lib/schedule";
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
  const funcionarios = await prisma.funcionario.findMany({ select: { id: true, nome: true } });
  const byName = new Map(funcionarios.map((f) => [normalizeName(f.nome), f]));

  let imported = 0;
  let updated  = 0;
  const unmatched = new Set<string>();
  const errors: string[] = [];

  for (const rec of records) {
    const nomeNorm = normalizeName(rec.nomeFuncionario);
    const funcionario =
      byName.get(nomeNorm) ??
      [...byName.entries()].find(([k]) => k.includes(nomeNorm) || nomeNorm.includes(k))?.[1];

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

    if (rec.tipo === "ATESTADO") {
      try {
        const existing = await prisma.ausencia.findFirst({
          where: { funcionarioId: funcionario.id, dataInicio: { lte: dataDate }, dataFim: { gte: dataDate } },
        });
        if (!existing) {
          await prisma.ausencia.create({
            data: { funcionarioId: funcionario.id, tipo: "ATESTADO_MEDICO", dataInicio: dataDate, dataFim: dataDate, diasAfastamento: 1, status: "APROVADA", motivo: "Importado via planilha" },
          });
          imported++;
        } else {
          updated++;
        }
      } catch { errors.push(`${rec.nomeFuncionario} / ${dateStr}: erro ao salvar atestado`); }
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
    const horasExtras = Math.max(0, horasTrabalhadas - 8);
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

  return NextResponse.json({ imported, updated, unmatched: Array.from(unmatched), errors, total: imported + updated });
}
