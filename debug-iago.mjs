import { readFileSync } from "fs";
import { read, utils } from "xlsx";

const filePath = "C:\\Users\\Wemer\\Meu Drive\\Projetos Wemerson\\PONTOS INDIVIDUAIS\\IAGO\\IAGO.xls";
const buf = readFileSync(filePath);
const wb = read(buf, { type: "buffer", cellDates: false });

console.log("=== ABAS ===", wb.SheetNames);

for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name];
  const rows = utils.sheet_to_json(ws, { header: 1, defval: "" });
  console.log(`\n=== ABA: "${name}" (${rows.length} linhas) ===`);
  for (let i = 0; i < Math.min(25, rows.length); i++) {
    console.log(`  [${i}]`, JSON.stringify(rows[i].slice(0, 9)));
  }
}
