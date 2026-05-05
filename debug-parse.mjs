import { readFileSync } from "fs";
import { read, utils } from "xlsx";

const filePath = "C:\\Users\\Wemer\\Meu Drive\\Projetos Wemerson\\PONTOS INDIVIDUAIS\\WEMERSON\\WEMERSON.xls";
const buf = readFileSync(filePath);
const wb = read(buf, { type: "buffer", cellDates: false });
const ws = wb.Sheets["Cartão Ponto"];
const rows = utils.sheet_to_json(ws, { header: 1, defval: "" });

// ----- same logic as parse-excel-ponto.ts -----
function cellStr(row, col) { return String(row[col] ?? "").trim(); }

function parseTime(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number") {
    const totalMin = Math.round(v * 24 * 60);
    const hh = Math.floor(totalMin / 60) % 24;
    const mm = totalMin % 60;
    return `${String(hh).padStart(2,"0")}:${String(mm).padStart(2,"0")}`;
  }
  if (typeof v === "string") {
    const clean = v.trim().replace(/[*^¨]+$/, "").trim();
    const m = clean.match(/^(\d{1,2}):(\d{2})$/);
    if (m) return `${m[1].padStart(2,"0")}:${m[2]}`;
  }
  return null;
}

function parseDate(v) {
  if (v == null || v === "") return null;
  if (typeof v === "string") {
    const s = v.trim();
    const m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})\s*-/);
    if (m1) { const year = 2000 + parseInt(m1[3]); return `${year}-${m1[2].padStart(2,"0")}-${m1[1].padStart(2,"0")}`; }
    const m2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m2) return `${m2[3]}-${m2[2].padStart(2,"0")}-${m2[1].padStart(2,"0")}`;
  }
  return null;
}

const SKIP_VALUES = new Set(["folga","ferias","atesta","atestad","atestado","falta","ausen","mat","pat","acid",""]);

let nomeFuncionario = "";
let dataStartRow = -1;
let tOff = 0;

for (let i = 0; i < rows.length; i++) {
  const a = cellStr(rows[i], 0).toLowerCase().replace(/:$/, "").trim();
  if (a === "nome" || a === "funcionario" || a === "colaborador") {
    nomeFuncionario = cellStr(rows[i], 1) || cellStr(rows[i], 0).replace(/^[^:]+:\s*/i, "").trim();
  }
  if (a === "data" || a.startsWith("dat")) {
    const c1 = cellStr(rows[i], 1).toLowerCase().trim();
    if (c1 === "dia" || c1.includes("semana")) tOff = 1;
    dataStartRow = i + 1;
    break;
  }
}

console.log("Nome:", nomeFuncionario);
console.log("dataStartRow:", dataStartRow, "tOff:", tOff);

let total = 0, folgas = 0, atestados = 0, normais = 0, skipped = 0;
const skipReasons = {};

for (let i = dataStartRow; i < rows.length; i++) {
  const row = rows[i];
  const dateStr = parseDate(row[0]);
  if (!dateStr) { skipped++; continue; }

  const ann = (cellStr(row, 1 + tOff) || cellStr(row, 1)).toLowerCase().replace(/[*^¨]+$/, "").trim();

  if (ann === "folga") { folgas++; total++; continue; }
  if (ann.startsWith("atesta")) { atestados++; total++; continue; }
  if (SKIP_VALUES.has(ann)) {
    skipReasons[ann] = (skipReasons[ann] || 0) + 1;
    skipped++;
    continue;
  }

  const e1 = parseTime(row[1 + tOff]);
  const s3 = parseTime(row[6 + tOff]);
  if (!e1 && !s3) {
    skipped++;
    const reason = `no-e1-s3 | ann="${ann}" | row0="${cellStr(row,0)}" | col1="${cellStr(row,1)}"`;
    if (skipped <= 10) console.log("SKIP:", reason);
    continue;
  }
  normais++;
  total++;
}

console.log("\n=== RESULTADO ===");
console.log("Total registros:", total);
console.log("  - FOLGA:", folgas);
console.log("  - ATESTADO:", atestados);
console.log("  - Normais:", normais);
console.log("  - Skipped:", skipped);
console.log("  - SkipReasons:", skipReasons);
