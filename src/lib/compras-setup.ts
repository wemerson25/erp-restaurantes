import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { seedProdutos } from "@/lib/seed-produtos";

let tablesReady = false;

export async function ensureComprasTables() {
  if (tablesReady) return;

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "RequisicaoCompra" (
      "id"          TEXT PRIMARY KEY,
      "titulo"      TEXT NOT NULL,
      "descricao"   TEXT NOT NULL DEFAULT '',
      "categoria"   TEXT NOT NULL DEFAULT 'OUTROS',
      "urgencia"    TEXT NOT NULL DEFAULT 'MEDIA',
      "status"      TEXT NOT NULL DEFAULT 'PENDENTE',
      "solicitante" TEXT NOT NULL,
      "restaurante" TEXT,
      "observacoes" TEXT,
      "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ItemRequisicao" (
      "id"            TEXT PRIMARY KEY,
      "requisicaoId"  TEXT NOT NULL,
      "nome"          TEXT NOT NULL,
      "quantidade"    REAL NOT NULL DEFAULT 1,
      "unidade"       TEXT NOT NULL DEFAULT 'un',
      "precoEstimado" REAL,
      "createdAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "RequisicaoServico" (
      "id"          TEXT PRIMARY KEY,
      "titulo"      TEXT NOT NULL,
      "descricao"   TEXT NOT NULL DEFAULT '',
      "categoria"   TEXT NOT NULL DEFAULT 'MANUTENCAO',
      "urgencia"    TEXT NOT NULL DEFAULT 'MEDIA',
      "status"      TEXT NOT NULL DEFAULT 'PENDENTE',
      "solicitante" TEXT NOT NULL,
      "restaurante" TEXT,
      "equipamento" TEXT,
      "observacoes" TEXT,
      "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ProdutoEstoque" (
      "id"               TEXT PRIMARY KEY,
      "nome"             TEXT NOT NULL,
      "categoria"        TEXT NOT NULL DEFAULT 'GERAL',
      "unidade"          TEXT NOT NULL DEFAULT 'un',
      "quantidadeAtual"  REAL NOT NULL DEFAULT 0,
      "quantidadeMinima" REAL NOT NULL DEFAULT 0,
      "createdAt"        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Extend ProdutoEstoque with columns from estoque-semanal workflow
  const extraCols = [
    `ALTER TABLE "ProdutoEstoque" ADD COLUMN "metaSemanal" REAL NOT NULL DEFAULT 0`,
    `ALTER TABLE "ProdutoEstoque" ADD COLUMN "qtdPorPacote" REAL NOT NULL DEFAULT 1`,
    `ALTER TABLE "ProdutoEstoque" ADD COLUMN "ilimitado" INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE "ProdutoEstoque" ADD COLUMN "sacaThresholdCheia" REAL`,
    `ALTER TABLE "ProdutoEstoque" ADD COLUMN "sacaThresholdMeia" REAL`,
    `ALTER TABLE "ProdutoEstoque" ADD COLUMN "restaurante" TEXT`,
    `ALTER TABLE "ProdutoEstoque" ADD COLUMN "ordemCategoria" INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE "ProdutoEstoque" ADD COLUMN "ativo" INTEGER NOT NULL DEFAULT 1`,
  ];
  for (const sql of extraCols) {
    try { await prisma.$executeRawUnsafe(sql); } catch { /* column already exists */ }
  }

  // Weekly count per product + week + restaurant
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ContagemSemanal" (
      "id"          TEXT PRIMARY KEY,
      "produtoId"   TEXT NOT NULL,
      "semanaRef"   TEXT NOT NULL,
      "restaurante" TEXT NOT NULL DEFAULT '',
      "qtdContada"  REAL NOT NULL DEFAULT 0,
      "qtdDeposito" REAL NOT NULL DEFAULT 0,
      "contadoEm"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE("produtoId","semanaRef","restaurante")
    )
  `);

  // Historical record (finalized after each week)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "HistoricoEstoque" (
      "id"             TEXT PRIMARY KEY,
      "produtoId"      TEXT NOT NULL,
      "semanaRef"      TEXT NOT NULL,
      "restaurante"    TEXT NOT NULL DEFAULT '',
      "estoqueInicial" REAL NOT NULL DEFAULT 0,
      "comprasDia"     REAL NOT NULL DEFAULT 0,
      "contagemFim"    REAL NOT NULL DEFAULT 0,
      "createdAt"      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE("produtoId","semanaRef","restaurante")
    )
  `);

  // Seed Wemerson admin user — upsert to avoid UNIQUE constraint errors on concurrent builds
  try {
    const hashed = await hashPassword("Ykedin@2025");
    await prisma.user.upsert({
      where: { email: "wemersonpetala@gmail.com" },
      update: {},
      create: {
        name: "Wemerson",
        email: "wemersonpetala@gmail.com",
        password: hashed,
        role: "ADMIN",
      },
    });
  } catch { /* parallel worker already seeded */ }

  // Auto-seed products on first run
  try { await seedProdutos(prisma); } catch { /* ignore */ }

  tablesReady = true;
}
