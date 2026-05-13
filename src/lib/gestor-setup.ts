import { prisma } from "@/lib/prisma";

let tableReady = false;

export async function ensureGestorTable() {
  if (tableReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Gestor" (
      "id"        TEXT PRIMARY KEY,
      "nome"      TEXT NOT NULL,
      "telefone"  TEXT NOT NULL,
      "ativo"     INTEGER NOT NULL DEFAULT 1,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  const rows = await prisma.$queryRawUnsafe<{ c: number }[]>(
    `SELECT COUNT(*) as c FROM "Gestor"`
  );
  if (Number(rows[0].c) === 0) {
    const seed = [
      { nome: "Quecia", telefone: "74988585163" },
      { nome: "Dine",   telefone: "71987274885" },
      { nome: "Pedro",  telefone: "71987690881" },
      { nome: "Luiz",   telefone: "74988639550" },
    ];
    const { randomUUID } = await import("crypto");
    for (const g of seed) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "Gestor" ("id","nome","telefone") VALUES (?,?,?)`,
        randomUUID(), g.nome, g.telefone,
      );
    }
  }
  tableReady = true;
}
