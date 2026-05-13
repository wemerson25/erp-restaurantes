import { prisma } from "./prisma";

let tableReady = false;

export async function ensureBeneficioExtraTable() {
  if (tableReady) return;

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "FolgaBeneficioExtra" (
      "id"            TEXT NOT NULL PRIMARY KEY,
      "funcionarioId" TEXT NOT NULL,
      "motivo"        TEXT NOT NULL,
      "dataConcessao" DATETIME NOT NULL,
      "dataValidade"  DATETIME,
      "dataUso"       DATETIME,
      "status"        TEXT NOT NULL DEFAULT 'DISPONIVEL',
      "observacoes"   TEXT,
      "createdAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY ("funcionarioId") REFERENCES "Funcionario"("id")
    )
  `);

  tableReady = true;
}
