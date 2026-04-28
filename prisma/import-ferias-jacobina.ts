import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter } as never);

// ── Férias históricas Ykedin Jacobina (extraídas do Drive) ─────────────────
// Fonte: FERIAS YKEDIN.xlsx e FÉRIAS GRUPO YKEDIN - 2025.docx
// Todos os registros são CONCLUÍDOS (datas já passadas, referência: 27/04/2026)
// "10 dias vendidos" = abono pecuniário (1/3 das férias convertido em $)
const feriasData = [
  // ── 2023 ──────────────────────────────────────────────────────────────
  { nome: "IAGO GRIGORIO DE ANDRADE",            inicio: "2023-02-20", fim: "2023-03-11", dias: 20, obs: "10 dias vendidos (abono pecuniário)" },
  { nome: "WEMERSON DO NASCIMENTO PETALA",        inicio: "2023-04-03", fim: "2023-04-22", dias: 20, obs: "10 dias vendidos (abono pecuniário)" },
  { nome: "MATEUS DE LIMA CRUZ",                 inicio: "2023-06-14", fim: "2023-07-03", dias: 20, obs: "10 dias vendidos (abono pecuniário)" },
  { nome: "NILMA ARAUJO SANTOS DE SENA",         inicio: "2023-07-03", fim: "2023-07-22", dias: 20, obs: "10 dias vendidos (abono pecuniário)" },
  { nome: "MARCOS VITOR GOMES OLIVEIRA CANDIDO", inicio: "2023-09-04", fim: "2023-09-23", dias: 20, obs: "10 dias vendidos (abono pecuniário)" },

  // ── 2024 ──────────────────────────────────────────────────────────────
  { nome: "IAGO GRIGORIO DE ANDRADE",            inicio: "2024-01-15", fim: "2024-02-13", dias: 30, obs: null },
  { nome: "MARCOS VITOR GOMES OLIVEIRA CANDIDO", inicio: "2024-02-07", fim: "2024-02-26", dias: 20, obs: "10 dias vendidos (abono pecuniário)" },
  { nome: "WEMERSON DO NASCIMENTO PETALA",        inicio: "2024-03-01", fim: "2024-03-20", dias: 20, obs: "10 dias vendidos (abono pecuniário)" },
  { nome: "NILMA ARAUJO SANTOS DE SENA",         inicio: "2024-04-01", fim: "2024-04-20", dias: 20, obs: "10 dias vendidos (abono pecuniário)" },
  { nome: "MATEUS DE LIMA CRUZ",                 inicio: "2024-06-25", fim: "2024-07-14", dias: 20, obs: "10 dias vendidos (abono pecuniário)" },
  { nome: "ELIZANDRA GUEDES DA SILVA",           inicio: "2024-07-15", fim: "2024-08-03", dias: 20, obs: "10 dias vendidos (abono pecuniário)" },

  // ── 2025 ──────────────────────────────────────────────────────────────
  { nome: "IAGO GRIGORIO DE ANDRADE",            inicio: "2025-03-17", fim: "2025-04-15", dias: 30, obs: null },
  { nome: "MARCOS VITOR GOMES OLIVEIRA CANDIDO", inicio: "2025-03-18", fim: "2025-04-06", dias: 20, obs: "10 dias vendidos (abono pecuniário)" },
  { nome: "WEMERSON DO NASCIMENTO PETALA",        inicio: "2025-05-05", fim: "2025-05-24", dias: 20, obs: "10 dias vendidos (abono pecuniário)" },
  { nome: "MATEUS DE LIMA CRUZ",                 inicio: "2025-06-16", fim: "2025-07-15", dias: 30, obs: null },
  { nome: "HÉRICA SANTOS SILVA",                 inicio: "2025-08-04", fim: "2025-09-02", dias: 30, obs: null },
  { nome: "WEMERSON DO NASCIMENTO PETALA",        inicio: "2025-09-23", fim: "2025-10-02", dias: 10, obs: "10 dias vendidos (abono pecuniário)" },
  { nome: "ELIZANDRA GUEDES DA SILVA",           inicio: "2025-10-06", fim: "2025-11-04", dias: 30, obs: null },
  { nome: "NILMA ARAUJO SANTOS DE SENA",         inicio: "2025-12-26", fim: "2026-01-24", dias: 30, obs: null },
];

async function main() {
  console.log("=== Importação de Férias — Ykedin Jacobina ===\n");

  // 1. Restaurante Jacobina
  const restaurantes = await (prisma as any).restaurante.findMany();
  const jacobina = restaurantes.find((r: any) =>
    r.nome.toLowerCase().includes("ykedin") && !r.nome.toLowerCase().includes("capim")
  );
  if (!jacobina) { console.error("Restaurante Jacobina não encontrado!"); return; }
  console.log(`Restaurante: ${jacobina.nome} (${jacobina.id})\n`);

  // 2. Cadastrar Wemerson Petala se não existir
  const wemersonExiste = await (prisma as any).funcionario.findFirst({
    where: { nome: { contains: "WEMERSON" } },
  });

  if (wemersonExiste) {
    console.log(`Wemerson já cadastrado: ${wemersonExiste.nome}\n`);
  } else {
    const cargoGG = await (prisma as any).cargo.findFirst({ where: { nome: "Gerente Geral" } });
    await (prisma as any).funcionario.create({
      data: {
        matricula: "YK0020",
        nome: "WEMERSON DO NASCIMENTO PETALA",
        cpf: "000.000.020-00",             // ⚠ provisório — atualizar com CPF real
        dataNascimento: new Date("1990-01-01"), // ⚠ provisório — atualizar com data real
        sexo: "M",
        estadoCivil: "SOLTEIRO",
        email: "wemersonpetala@gmail.com",
        telefone: "74000000000",            // ⚠ provisório
        endereco: "A preencher",
        cidade: "Jacobina",
        estado: "BA",
        cep: "44700-000",
        dataAdmissao: new Date("2019-11-17"), // estimado via vencimento 16/11/2023 (3º período)
        salario: 3500,
        tipoContrato: "CLT",
        status: "ATIVO",
        turno: "MISTO",
        cargoId: cargoGG.id,
        restauranteId: jacobina.id,
      },
    });
    console.log("✓ Wemerson do Nascimento Petala cadastrado (dados provisórios marcados)\n");
  }

  // 3. Importar férias
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

    // Evitar duplicatas (mesma dataInicio + funcionario)
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

  // 4. Resumo por funcionário
  console.log("\n── Resumo por colaborador ─────────────────────");
  const funcs = ["IAGO GRIGORIO DE ANDRADE", "WEMERSON DO NASCIMENTO PETALA", "MATEUS DE LIMA CRUZ",
    "NILMA ARAUJO SANTOS DE SENA", "MARCOS VITOR GOMES OLIVEIRA CANDIDO",
    "ELIZANDRA GUEDES DA SILVA", "HÉRICA SANTOS SILVA"];

  for (const nome of funcs) {
    const func = await (prisma as any).funcionario.findFirst({ where: { nome } });
    if (!func) continue;
    const ferias = await (prisma as any).ferias.findMany({ where: { funcionarioId: func.id }, orderBy: { dataInicio: "asc" } });
    const totalDias = ferias.filter((x: any) => x.status === "CONCLUIDA").reduce((s: number, x: any) => s + x.diasCorridos, 0);
    const primeiroNome = nome.split(" ")[0];
    console.log(`  ${primeiroNome}: ${ferias.length} período(s), ${totalDias} dias concluídos`);
  }
}

main()
  .catch(console.error)
  .finally(() => (prisma as any).$disconnect());
