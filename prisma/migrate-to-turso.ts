/**
 * Migra todos os dados do SQLite local para o banco Turso.
 *
 * Uso:
 *   npx ts-node --compiler-options {"module":"CommonJS"} prisma/migrate-to-turso.ts \
 *     "libsql://SEU-BANCO.turso.io" \
 *     "SEU_AUTH_TOKEN"
 */

import { createClient } from "@libsql/client";

// Ordem de inserção respeitando dependências de FK
const TABLE_ORDER = [
  "User",
  "Restaurante",
  "Cargo",
  "Funcionario",
  "Ferias",
  "Ausencia",
  "Advertencia",
  "FolhaPagamento",
  "RegistroPonto",
  "Vaga",
  "Candidatura",
];

async function migrate() {
  const targetUrl = process.argv[2];
  const targetToken = process.argv[3];

  if (!targetUrl || !targetToken) {
    console.error("Uso: npx ts-node prisma/migrate-to-turso.ts <TURSO_URL> <AUTH_TOKEN>");
    process.exit(1);
  }

  console.log("Conectando ao banco local...");
  const source = createClient({ url: "file:./prisma/dev.db" });

  console.log("Conectando ao Turso...");
  const target = createClient({ url: targetUrl, authToken: targetToken });

  // Busca tabelas disponíveis no banco local
  const tablesResult = await source.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%'"
  );
  const availableTables = new Set(tablesResult.rows.map((r) => r.name as string));

  // Ordena conforme dependências, incluindo eventuais tabelas extras no final
  const extra = [...availableTables].filter((t) => !TABLE_ORDER.includes(t));
  const tables = [...TABLE_ORDER.filter((t) => availableTables.has(t)), ...extra];

  console.log(`Tabelas para migrar: ${tables.join(", ")}\n`);

  // Cria schema no Turso
  const schemaResult = await source.execute(
    `SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%'`
  );
  for (const row of schemaResult.rows) {
    const sql = row.sql as string;
    if (sql) {
      await target.execute(sql.replace(/^CREATE TABLE/, "CREATE TABLE IF NOT EXISTS"));
    }
  }

  // Cria índices
  const indexResult = await source.execute(
    "SELECT sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL"
  );
  for (const row of indexResult.rows) {
    const sql = (row.sql as string)
      .replace(/^CREATE INDEX/, "CREATE INDEX IF NOT EXISTS")
      .replace(/^CREATE UNIQUE INDEX/, "CREATE UNIQUE INDEX IF NOT EXISTS");
    try { await target.execute(sql); } catch { /* já existe */ }
  }

  // Desabilita FK para inserção em lote
  await target.execute("PRAGMA foreign_keys = OFF");

  // Migra dados na ordem correta
  for (const table of tables) {
    const rows = await source.execute(`SELECT * FROM "${table}"`);

    if (rows.rows.length === 0) {
      console.log(`  ${table}: 0 registros`);
      continue;
    }

    const cols = rows.columns;
    const colList = cols.map((c) => `"${c}"`).join(", ");
    const placeholders = cols.map(() => "?").join(", ");

    let count = 0;
    for (const row of rows.rows) {
      const values = cols.map((c) => {
        const v = row[c];
        return v === undefined ? null : v;
      });
      await target.execute({
        sql: `INSERT OR REPLACE INTO "${table}" (${colList}) VALUES (${placeholders})`,
        args: values as never[],
      });
      count++;
    }

    console.log(`  ${table}: ${count} registro(s) migrado(s)`);
  }

  // Reabilita FK
  await target.execute("PRAGMA foreign_keys = ON");

  console.log("\nMigração concluída com sucesso!");
}

migrate().catch((e) => {
  console.error("Erro na migração:", e.message ?? e);
  process.exit(1);
});
