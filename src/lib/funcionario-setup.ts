import { prisma } from "./prisma";

let migrated = false;

export async function ensureFuncionarioColumns() {
  if (migrated) return;
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Funcionario" ADD COLUMN "tipoDemissao" TEXT`);
  } catch {
    // column already exists — no-op
  }
  migrated = true;
}
