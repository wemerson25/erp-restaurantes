import { prisma } from "./prisma";

let tablesReady = false;

export async function ensureEscalaTables() {
  if (tablesReady) return;

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Schedule" (
      "id"             TEXT NOT NULL PRIMARY KEY,
      "funcionarioId"  TEXT NOT NULL,
      "restauranteId"  TEXT NOT NULL,
      "data"           DATETIME NOT NULL,
      "setor"          TEXT NOT NULL,
      "turno"          TEXT NOT NULL,
      "horarioEntrada" TEXT,
      "horarioSaida"   TEXT,
      "observacao"     TEXT,
      "status"         TEXT NOT NULL DEFAULT 'PLANEJADA',
      "createdAt"      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("funcionarioId") REFERENCES "Funcionario"("id"),
      FOREIGN KEY ("restauranteId") REFERENCES "Restaurante"("id")
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ScheduleRequirement" (
      "id"                 TEXT NOT NULL PRIMARY KEY,
      "restauranteId"      TEXT NOT NULL,
      "setor"              TEXT NOT NULL,
      "turno"              TEXT NOT NULL,
      "minimoFuncionarios" INTEGER NOT NULL DEFAULT 1,
      "createdAt"          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("restauranteId") REFERENCES "Restaurante"("id"),
      UNIQUE ("restauranteId", "setor", "turno")
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "FuncionarioSetor" (
      "id"            TEXT NOT NULL PRIMARY KEY,
      "funcionarioId" TEXT NOT NULL,
      "setor"         TEXT NOT NULL,
      "createdAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("funcionarioId") REFERENCES "Funcionario"("id") ON DELETE CASCADE,
      UNIQUE ("funcionarioId", "setor")
    )
  `);

  tablesReady = true;
}
