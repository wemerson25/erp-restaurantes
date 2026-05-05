// Shared Excel parsing — runs in both browser and server (no Node.js APIs)

export interface ParsedRecord {
  nomeFuncionario: string;
  dateStr: string;
  tempos?: { e1: string|null; s1: string|null; e2: string|null; s2: string|null; e3: string|null; s3: string|null };
  batidas?: string[];
  tipo?: "FOLGA" | "ATESTADO" | "FALTA";
}

const SKIP_VALUES = new Set(["folga", "ferias", "férias", "atesta", "atestad", "atestado", "ausen", "mat", "pat", "acid", ""]);

export function normalizeName(s: string): string {
  // U+0300–U+036F = combining diacritical marks
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[\s]+/g, " ");
}

export function parseTime(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") {
    const totalMin = Math.round(v * 24 * 60);
    const hh = Math.floor(totalMin / 60) % 24;
    const mm = totalMin % 60;
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  }
  if (typeof v === "string") {
    const clean = v.trim().replace(/[*^]+$/, "").trim();
    const m = clean.match(/^(\d{1,2}):(\d{2})$/);
    if (m) return `${m[1].padStart(2, "0")}:${m[2]}`;
  }
  return null;
}

export function parseDate(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "string") {
    const s = v.trim();
    const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})\s*-/);
    if (m1) {
      const year = 2000 + parseInt(m1[3]);
      return `${year}-${m1[2].padStart(2, "0")}-${m1[1].padStart(2, "0")}`;
    }
    const m2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m2) return `${m2[3]}-${m2[2].padStart(2, "0")}-${m2[1].padStart(2, "0")}`;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  }
  if (typeof v === "number") {
    // Excel serial date (days since 1900-01-01, with 1900 leap year bug)
    const adjusted = v > 60 ? v - 1 : v;
    const d = new Date(Math.round((adjusted - 25569) * 86400000));
    if (isNaN(d.getTime())) return null;
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  }
  return null;
}

function cellStr(row: unknown[], col: number): string {
  return String(row[col] ?? "").trim();
}

function isCartaoPonto(rows: unknown[][]): boolean {
  const cell = String(rows[0]?.[0] ?? "").trim().toUpperCase();
  return cell.includes("CART") && cell.includes("PONTO");
}

function parseCartaoPonto(rows: unknown[][]): ParsedRecord[] {
  let nomeFuncionario = "";
  let dataStartRow = -1;
  let tOff = 0; // 1 when a "Dia" (day-of-week) column sits between date and time columns

  for (let i = 0; i < rows.length; i++) {
    const a = cellStr(rows[i], 0).toLowerCase().replace(/:$/, "").trim();
    if (a === "nome" || a === "funcionario" || a === "colaborador") {
      // Value may be in col 1, or inline ("Nome: WEMERSON")
      nomeFuncionario = cellStr(rows[i], 1) || cellStr(rows[i], 0).replace(/^[^:]+:\s*/i, "").trim();
    }
    if (a === "data" || a.startsWith("dat")) {
      // Detect an extra "Dia" column (day-of-week label) that shifts time columns right by 1
      const c1 = cellStr(rows[i], 1).toLowerCase().trim();
      if (c1 === "dia" || c1.includes("semana")) tOff = 1;
      dataStartRow = i + 1;
      break;
    }
  }

  if (!nomeFuncionario || dataStartRow < 0) return [];

  const records: ParsedRecord[] = [];

  for (let i = dataStartRow; i < rows.length; i++) {
    const row = rows[i];
    const dateStr = parseDate(row[0]);
    if (!dateStr) continue;

    // Annotation column: use col 1+tOff (time slot col), fall back to col 1
    const ann = (cellStr(row, 1 + tOff) || cellStr(row, 1)).toLowerCase().replace(/[*^]+$/, "").trim();

    if (ann === "folga") { records.push({ nomeFuncionario, dateStr, tipo: "FOLGA" }); continue; }
    if (ann === "falta") { records.push({ nomeFuncionario, dateStr, tipo: "FALTA" }); continue; }
    if (ann.startsWith("atesta")) { records.push({ nomeFuncionario, dateStr, tipo: "ATESTADO" }); continue; }
    if (SKIP_VALUES.has(ann)) continue;

    const tempos = {
      e1: parseTime(row[1 + tOff]), s1: parseTime(row[2 + tOff]), e2: parseTime(row[3 + tOff]),
      s2: parseTime(row[4 + tOff]), e3: parseTime(row[5 + tOff]), s3: parseTime(row[6 + tOff]),
    };
    if (!tempos.e1 && !tempos.s1 && !tempos.e2 && !tempos.s2 && !tempos.e3 && !tempos.s3) continue;
    records.push({ nomeFuncionario, dateStr, tempos });
  }

  return records;
}

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

export function parseExcelPonto(rows: unknown[][]): ParsedRecord[] {
  if (rows.length < 2) return [];
  return isCartaoPonto(rows) ? parseCartaoPonto(rows) : parseSimpleFormat(rows);
}

export function groupConsecutiveDates(dates: string[]): { start: string; end: string; days: number }[] {
  const sorted = [...dates].sort();
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
