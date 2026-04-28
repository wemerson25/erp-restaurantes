import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter } as never);

// ── Férias históricas Deck SteakHouse ─────────────────────────────────────────
// Fonte: FERIAS YKEDIN.xlsx (2023) e FÉRIAS GRUPO YKEDIN - 2025.docx (2025)
// Referência: 27/04/2026 — todos os registros são CONCLUIDOS
// Apenas funcionários ativos no ERP: FRANCIANE ALVES CORREIA (adm. 16/12/2020)
// Demais funcionários de 2025 (Wanderson, Márcio, Thaianara, Juliana, Iraiane,
// Iara, Lauana, Fernanda) já saíram da empresa — não cadastrados no ERP.
const feriasData = [
  // ── 2023 ──────────────────────────────────────────────────────────────────
  // FERIAS YKEDIN.xlsx: "FRANCIANE ALVES CORREIA, 6/19/2023–7/8/2023, 20d, 10 vendidos"
  // Período P2 concessivo (16/12/2022–15/12/2023)
  { nome: "FRANCIANE ALVES CORREIA", inicio: "2023-06-19", fim: "2023-07-08", dias: 20, obs: "10 dias vendidos (abono pecuniário)" },

  // ── 2025 ──────────────────────────────────────────────────────────────────
  // FÉRIAS GRUPO YKEDIN - 2025.docx: "Franciane – 3 a 12 de março (10 dias) 10 vendidos"
  // Período P4 concessivo (16/12/2024–15/12/2025) — 1ª fração
  { nome: "FRANCIANE ALVES CORREIA", inicio: "2025-03-03", fim: "2025-03-12", dias: 10, obs: "10 dias vendidos (abono pecuniário) — 1ª fração do P4" },

  // FÉRIAS GRUPO YKEDIN - 2025.docx: "Franciane – 1 a 20 de setembro (20 dias) 10 vendidos"
  // Período P4 concessivo (16/12/2024–15/12/2025) — 2ª fração (total P4: 10+20=30d ✓)
  { nome: "FRANCIANE ALVES CORREIA", inicio: "2025-09-01", fim: "2025-09-20", dias: 20, obs: "10 dias vendidos (abono pecuniário) — 2ª fração do P4" },
];

async function main() {
  console.log("=== Importação de Férias — Deck SteakHouse ===\n");

  const restaurantes = await (prisma as any).restaurante.findMany();
  const deck = restaurantes.find((r: any) => r.nome.toLowerCase().includes("deck"));
  if (!deck) { console.error("Restaurante Deck não encontrado!"); return; }
  console.log(`Restaurante: ${deck.nome} (${deck.id})\n`);

  let criadas = 0;
  let ignoradas = 0;

  for (const f of feriasData) {
    const func = await (prisma as any).funcionario.findFirst({
      where: { nome: f.nome },
    });

    if (!func) {
      console.log(`  ⚠ Funcionário não encontrado: ${f.nome}`);
      ignoradas++;
      continue;
    }

    const jaExiste = await (prisma as any).ferias.findFirst({
      where: {
        funcionarioId: func.id,
        dataInicio: new Date(f.inicio),
      },
    });

    if (jaExiste) {
      console.log(`  – Já existe: ${f.nome} ${f.inicio}`);
      ignoradas++;
      continue;
    }

    await (prisma as any).ferias.create({
      data: {
        funcionarioId: func.id,
        dataInicio: new Date(f.inicio),
        dataFim: new Date(f.fim),
        diasCorridos: f.dias,
        status: "CONCLUIDA",
        observacoes: f.obs,
      },
    });

    console.log(`  ✓ ${f.nome.split(" ")[0]} ${f.nome.split(" ").at(-1)} — ${f.inicio} (${f.dias}d)`);
    criadas++;
  }

  console.log(`\n✅ Concluído: ${criadas} registros criados, ${ignoradas} ignorados/pulados.`);

  // Resumo de períodos de Franciane
  console.log("\n── Situação de períodos — FRANCIANE ALVES CORREIA ──────────────");
  console.log("   Admissão: 16/12/2020");
  console.log("   P1: 16/12/2020–15/12/2021 | conc: 16/12/2021–15/12/2022 → sem férias = VENCIDO");
  console.log("   P2: 16/12/2021–15/12/2022 | conc: 16/12/2022–15/12/2023 → 20d + 10 vendidos = CONCEDIDO");
  console.log("   P3: 16/12/2022–15/12/2023 | conc: 16/12/2023–15/12/2024 → sem registro = VENCIDO");
  console.log("   P4: 16/12/2023–15/12/2024 | conc: 16/12/2024–15/12/2025 → 10d + 20d + 20 vendidos = 30d = CONCEDIDO");
  console.log("   P5: 16/12/2024–15/12/2025 | conc: 16/12/2025–15/12/2026 → sem férias = ADQUIRIDO");
}

main()
  .catch(console.error)
  .finally(() => (prisma as any).$disconnect());
