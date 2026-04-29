import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { detectOcorrencia, calcHoursFromPunches } from "@/lib/schedule";
import * as XLSX from "xlsx";

// ─── helpers ────────────────────────────────────────────────────────────────

function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/** Parse "HH:MM" or Excel numeric time (fraction of a day) → "HH:MM" string */
function parseTime(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "string") {
    const m = v.trim().match(/^(\d{1,2}):(\d{2})$/);
    if (m) return `${m[1].padStart(2, "0")}:${m[2]}`;
    return null;
  }
  if (typeof v === "number") {
    const totalMin = Math.round(v * 24 * 60);
    const hh = Math.floor(totalMin / 60) % 24;
    const mm = totalMin % 60;
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
  }
  return null;
}

/** Parse date cell → "YYYY-MM-DD" */
function parseDate(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "string") {
    // DD/MM/YYYY
    const m = v.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    // YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(v.trim())) return v.trim();
    return null;
  }
  if (typeof v === "number") {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  return null;
}

// ─── GET — download blank template ──────────────────────────────────────────

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const wb = XLSX.utils.book_new();

  const headers = ["Nome", "Data", "Batida 1", "Batida 2", "Batida 3", "Batida 4", "Batida 5", "Batida 6"];
  const example = ["NOME DO FUNCIONÁRIO", "01/03/2026", "11:00", "14:30", "18:00", "18:30", "19:00", "23:00"];

  const ws = XLSX.utils.aoa_to_sheet([headers, example]);

  // Column widths
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
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { header: 1, defval: "" }) as unknown[][];

  if (rows.length < 2) {
    return NextResponse.json({ error: "Planilha vazia ou sem dados" }, { status: 400 });
  }

  // First row = headers; find column indexes
  const headerRow = (rows[0] as unknown[]).map((h) => String(h).toLowerCase().trim());
  const col = (names: string[]) => headerRow.findIndex((h) => names.some((n) => h.includes(n)));

  const iNome  = col(["nome"]);
  const iData  = col(["data"]);
  const iBat   = [1, 2, 3, 4, 5, 6].map((n) => col([`batida ${n}`, `batida${n}`]));

  if (iNome < 0 || iData < 0) {
    return NextResponse.json({ error: 'Colunas "Nome" e "Data" são obrigatórias' }, { status: 400 });
  }

  // Load all employees for name matching
  const funcionarios = await prisma.funcionario.findMany({
    select: { id: true, nome: true },
  });
  const byName = new Map(funcionarios.map((f) => [normalizeName(f.nome), f]));

  let imported = 0;
  let updated = 0;
  const unmatched = new Set<string>();
  const errors: string[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    const nomeRaw = String(row[iNome] ?? "").trim();
    if (!nomeRaw) continue;

    const dateStr = parseDate(row[iData]);
    if (!dateStr) { errors.push(`Linha ${i + 1}: data inválida`); continue; }

    // Match employee by name (exact, then partial)
    const nomeNorm = normalizeName(nomeRaw);
    let funcionario =
      byName.get(nomeNorm) ??
      [...byName.entries()].find(([k]) => k.includes(nomeNorm) || nomeNorm.includes(k))?.[1];

    if (!funcionario) { unmatched.add(nomeRaw); continue; }

    // Collect non-null batidas
    const times: string[] = [];
    for (const idx of iBat) {
      if (idx < 0) continue;
      const t = parseTime(row[idx]);
      if (t) times.push(t);
    }

    if (times.length === 0) continue;

    const toDate = (t: string) => new Date(`${dateStr}T${t}:00`);
    const dates = times.map(toDate);
    const paired = dates.length % 2 === 0 ? dates : dates.slice(0, -1);

    const n = paired.length;
    const entrada       = paired[0] ?? null;
    const saidaAlmoco   = n >= 4 ? paired[n - 3] : null;
    const retornoAlmoco = n >= 4 ? paired[n - 2] : null;
    const saida         = n >= 2 ? paired[n - 1] : null;

    const horasTrabalhadas = calcHoursFromPunches(paired);
    const horasExtras = Math.max(0, horasTrabalhadas - 8);
    const dataDate = new Date(`${dateStr}T00:00:00`);
    const ocorrencia = detectOcorrencia(entrada ?? undefined, dataDate, horasTrabalhadas);

    const payload = {
      funcionarioId: funcionario.id,
      data: dataDate,
      entrada,
      saidaAlmoco,
      retornoAlmoco,
      saida,
      horasTrabalhadas,
      horasExtras,
      ocorrencia,
    };

    try {
      const existing = await prisma.registroPonto.findFirst({
        where: { funcionarioId: funcionario.id, data: dataDate },
      });
      if (existing) {
        await prisma.registroPonto.update({ where: { id: existing.id }, data: payload });
        updated++;
      } else {
        await prisma.registroPonto.create({ data: payload });
        imported++;
      }
    } catch {
      errors.push(`Linha ${i + 1}: erro ao salvar ${nomeRaw}`);
    }
  }

  return NextResponse.json({
    imported,
    updated,
    unmatched: Array.from(unmatched),
    errors,
    total: imported + updated,
  });
}
