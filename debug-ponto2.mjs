import { readFileSync } from "fs";
import { read, utils } from "xlsx";

const filePath = "C:\\Users\\Wemer\\Meu Drive\\Projetos Wemerson\\PONTOS INDIVIDUAIS\\WEMERSON\\WEMERSON.xls";
const buf = readFileSync(filePath);
const wb = read(buf, { type: "buffer", cellDates: false });
const ws = wb.Sheets["Cartão Ponto"];
const rows = utils.sheet_to_json(ws, { header: 1, defval: "" });

console.log("Total linhas:", rows.length);

// Print rows 14-50 to see data structure
console.log("\n=== Linhas 14-50 ===");
for (let i = 14; i < Math.min(50, rows.length); i++) {
  console.log(`[${i}]`, JSON.stringify(rows[i].slice(0, 8)));
}

// Find blank/header rows that would interrupt parsing
console.log("\n=== Linhas com col[0] não-data após linha 14 ===");
let count = 0;
for (let i = 15; i < rows.length && count < 20; i++) {
  const v = String(rows[i][0] ?? "").trim();
  const isDate = /^\d{1,2}\/\d{1,2}\/\d{2}/.test(v) || /^\d{4}-\d{2}-\d{2}/.test(v);
  if (!isDate) {
    console.log(`[${i}] col0="${v}" | row=${JSON.stringify(rows[i].slice(0,4))}`);
    count++;
  }
}
