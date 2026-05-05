import { readFileSync } from "fs";
import { read, utils } from "xlsx";

const filePath = "C:\\Users\\Wemer\\Meu Drive\\Projetos Wemerson\\PONTOS INDIVIDUAIS\\IAGO\\IAGO.xls";
const buf = readFileSync(filePath);
const wb = read(buf, { type: "buffer", cellDates: false });
const ws = wb.Sheets["Cartão Ponto"];
const rows = utils.sheet_to_json(ws, { header: 1, defval: "" });

function cellStr(row, col) { return String(row[col] ?? "").trim(); }
function parseTime(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number") {
    const m = Math.round(v * 24 * 60);
    return `${String(Math.floor(m/60)%24).padStart(2,"0")}:${String(m%60).padStart(2,"0")}`;
  }
  if (typeof v === "string") {
    const c = v.trim().replace(/[*^¨]+$/, "").trim();
    const m = c.match(/^(\d{1,2}):(\d{2})$/);
    if (m) return `${m[1].padStart(2,"0")}:${m[2]}`;
  }
  return null;
}
function parseDate(v) {
  if (v == null || v === "") return null;
  if (typeof v === "string") {
    const s = v.trim();
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})\s*-/);
    if (m) return `${2000+parseInt(m[3])}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;
    const m2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m2) return `${m2[3]}-${m2[2].padStart(2,"0")}-${m2[1].padStart(2,"0")}`;
  }
  return null;
}
const SKIP = new Set(["folga","ferias","férias","atesta","atestad","atestado","falta","ausen","mat","pat","acid",""]);

// Find header
let nome = "", start = -1, tOff = 0;
for (let i = 0; i < rows.length; i++) {
  const a = cellStr(rows[i],0).toLowerCase().replace(/:$/,"").trim();
  if (a==="nome"||a==="funcionario"||a==="colaborador") nome = cellStr(rows[i],1)||a.replace(/^[^:]+:\s*/i,"").trim();
  if (a==="data"||a.startsWith("dat")) {
    const c1 = cellStr(rows[i],1).toLowerCase();
    if (c1==="dia"||c1.includes("semana")) tOff=1;
    start = i+1; break;
  }
}
console.log(`Nome: "${nome}", dataStartRow: ${start}, tOff: ${tOff}`);

let total=0, folgas=0, normais=0, skipped=0, skipEmpty=0;
const firstFew = [];
const skipSamples = [];

for (let i = start; i < rows.length; i++) {
  const row = rows[i];
  const dateStr = parseDate(row[0]);
  if (!dateStr) { skipEmpty++; continue; }

  const ann = (cellStr(row,1+tOff)||cellStr(row,1)).toLowerCase().replace(/[*^¨]+$/,"").trim();
  if (ann==="folga") { folgas++; total++; if(total<=5) firstFew.push({i,dateStr,type:"FOLGA"}); continue; }
  if (ann.startsWith("atesta")) { total++; continue; }
  if (SKIP.has(ann)) { skipped++; skipSamples.push({i,dateStr,ann,c1:cellStr(row,1)}); continue; }

  const e1 = parseTime(row[1+tOff]);
  const s3 = parseTime(row[6+tOff]);
  if (!e1 && !s3) {
    skipped++;
    if (skipSamples.length<5) skipSamples.push({i,dateStr,ann,c1:cellStr(row,1),c2:cellStr(row,2)});
    continue;
  }
  normais++; total++;
  if (total<=5) firstFew.push({i,dateStr,type:"NORMAL",e1,s3});
}

console.log(`\nTotal: ${total} (folgas:${folgas}, normais:${normais})`);
console.log(`Skipped: ${skipped} (skipEmpty:${skipEmpty})`);
console.log(`\nPrimeiros registros:`, firstFew);
console.log(`\nAmostras de skip:`, skipSamples.slice(0,10));
