/**
 * Migra todos os dados do SQLite local para o banco Turso.
 *
 * Uso:
 *   npx ts-node --compiler-options {"module":"CommonJS"} prisma/migrate-to-turso.ts \
 *     "libsql://SEU-BANCO.turso.io" \
 *     "SEU_AUTH_TOKEN"
 */

import { createClient } from "@libsql/client";

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

  // Busca todas as tabelas (exceto internas do SQLite e Prisma)
  const tablesResult = await source.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%' ORDER BY name"
  );

  const tables = tablesResult.rows.map((r) => r.name as string);
  console.log(`Tabelas encontradas: ${tables.join(", ")}\n`);

  // Envia o schema atual para o Turso
  const schemaResult = await source.execute(
    "SELECT sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_prisma_%'"
  );

  for (const row of schemaResult.rows) {
    const sql = row.sql as string;
    if (sql) {
      await target.execute(sql.replace("CREATE TABLE", "CREATE TABLE IF NOT EXISTS"));
    }
  }

  // Migra índices
  const indexResult = await source.execute(
    "SELECT sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL"
  );
  for (const row of indexResult.rows) {
    const sql = row.sql as string;
    if (sql) {
      try {
        await target.execute(sql.replace("CREATE INDEX", "CREATE INDEX IF NOT EXISTS").replace("CREATE UNIQUE INDEX", "CREATE UNIQUE INDEX IF NOT EXISTS"));
      } catch {
        // índice já existe, ignora
      }
    }
  }

  // Migra dados tabela por tabela
  for (const table of tables) {
    const rows = await source.execute(`SELECT * FROM "${table}"`);

    if (rows.rows.length === 0) {
      console.log(`  ${table}: 0 registros`);
      continue;
    }

    const cols = rows.columns;
    const placeholders = cols.map(() => "?").join(", ");
    const colList = cols.map((c) => `"${c}"`).join(", ");

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

  console.log("\nMigração concluída!");
}

migrate().catch((e) => {
  console.error("Erro na migração:", e);
  process.exit(1);
});
