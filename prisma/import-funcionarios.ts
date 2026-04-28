import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter } as never);

const cargosData = [
  { nome: "Garçom",              departamento: "Atendimento", salarioBase: 1412 },
  { nome: "Maître",              departamento: "Atendimento", salarioBase: 1800 },
  { nome: "Auxiliar de bar",     departamento: "Atendimento", salarioBase: 1412 },
  { nome: "Auxiliar de cozinha", departamento: "Cozinha",     salarioBase: 1412 },
  { nome: "Cozinheira",          departamento: "Cozinha",     salarioBase: 1600 },
  { nome: "Chefe de cozinha",    departamento: "Cozinha",     salarioBase: 2500 },
  { nome: "Sushiman",            departamento: "Sushibar",    salarioBase: 1800 },
  { nome: "Auxiliar de sushiman",departamento: "Sushibar",    salarioBase: 1412 },
  { nome: "Sushiman chefe",      departamento: "Sushibar",    salarioBase: 2800 },
  { nome: "Chapeiro",            departamento: "Cozinha",     salarioBase: 1412 },
  { nome: "Gerente",             departamento: "Gerencia",    salarioBase: 2500 },
  { nome: "Gerente Geral",       departamento: "Gerencia",    salarioBase: 3500 },
  { nome: "Analista",            departamento: "Administração",salarioBase: 2500 },
  { nome: "Estagiário",          departamento: "Administração",salarioBase: 800  },
  { nome: "Auxiliar",            departamento: "Administração",salarioBase: 1412 },
  { nome: "Sócio",               departamento: "Diretoria",   salarioBase: 5000 },
];

// Employees extracted from Notion (EMP) Membros database
const funcionariosData = [
  { nome: "ADEMILSON JOSÉ DA SILVA",             cargo: "Garçom",              loja: "Deck",                sexo: "M", dataNasc: "2002-11-25", dataAdm: "2025-08-21", tel: "15996992064",  email: "ademilson.jose.silva15@gmail.com", status: "ATIVO"    },
  { nome: "ROSENILDA ARAÚJO PEREIRA",            cargo: "Garçom",              loja: "Deck",                sexo: "F", dataNasc: "2006-08-19", dataAdm: "2025-07-12", tel: "74988100736",  email: "rosenildaaraujo190@gmail.com",     status: "ATIVO"    },
  { nome: "LAÍSE DE JESUS BRUNO",                cargo: "Garçom",              loja: "Deck",                sexo: "F", dataNasc: "1995-09-21", dataAdm: "2026-01-18", tel: "7498059032",   email: "laysesilvabruno71@gmail.com",      status: "ATIVO"    },
  { nome: "BRUNA APOLÔNIO PEREIRA DOS SANTOS",   cargo: "Auxiliar de cozinha", loja: "Deck",                sexo: "F", dataNasc: "2008-10-27", dataAdm: "2026-01-01", tel: "74998189862",  email: "",                                 status: "ATIVO"    },
  { nome: "CAMILA PEREIRA SILVA",                cargo: "Auxiliar de cozinha", loja: "Deck",                sexo: "F", dataNasc: "1994-07-08", dataAdm: "2025-01-25", tel: "74981319694",  email: "pereirasilvacamila23@gmail.com",   status: "ATIVO"    },
  { nome: "FRANCIANE ALVES CORREIA",             cargo: "Gerente",             loja: "Deck",                sexo: "F", dataNasc: "1998-04-03", dataAdm: "2020-12-16", tel: "74997400278",  email: "annehastingsac@gmail.com",         status: "ATIVO"    },
  { nome: "LUDMYLLA LOPES ARAÚJO",               cargo: "Auxiliar de cozinha", loja: "Ykedin Jacobina",     sexo: "F", dataNasc: "2005-04-04", dataAdm: "2025-09-16", tel: "74998000049",  email: "ludecamilla03@gmail.com",          status: "ATIVO"    },
  { nome: "IAGO GRIGORIO DE ANDRADE",            cargo: "Analista",            loja: "Ykedin Jacobina",     sexo: "M", dataNasc: "2000-05-16", dataAdm: "2019-03-22", tel: "74998103149",  email: "iago-andrade35@hotmail.com",       status: "ATIVO"    },
  { nome: "HÉRICA SANTOS SILVA",                 cargo: "Garçom",              loja: "Ykedin Jacobina",     sexo: "F", dataNasc: "2006-07-11", dataAdm: "2024-08-01", tel: "74998059060",  email: "hericas500@gmail.com",             status: "ATIVO"    },
  { nome: "RAQUEL RIOS SILVA",                   cargo: "Garçom",              loja: "Ykedin Jacobina",     sexo: "F", dataNasc: "2004-12-17", dataAdm: "2025-08-17", tel: "74981326300",  email: "",                                 status: "ATIVO"    },
  { nome: "NILMA ARAUJO SANTOS DE SENA",         cargo: "Chefe de cozinha",    loja: "Ykedin Jacobina",     sexo: "F", dataNasc: "1964-06-11", dataAdm: "2017-08-24", tel: "74991481062",  email: "",                                 status: "ATIVO"    },
  { nome: "MATEUS DE LIMA CRUZ",                 cargo: "Sushiman chefe",      loja: "Ykedin Jacobina",     sexo: "M", dataNasc: "1999-01-12", dataAdm: "2020-12-16", tel: "74998145805",  email: "mt-lima-cruz@hotmail.com",         status: "ATIVO"    },
  { nome: "KAILANE OLIVEIRA DE JESUS",           cargo: "Garçom",              loja: "Ykedin Jacobina",     sexo: "F", dataNasc: "2005-11-18", dataAdm: "2026-01-15", tel: "74981283629",  email: "Kayllaneoliver7470@gmail.com",     status: "ATIVO"    },
  { nome: "ELIZANDRA GUEDES DA SILVA",           cargo: "Cozinheira",          loja: "Ykedin Jacobina",     sexo: "F", dataNasc: "1987-07-02", dataAdm: "2022-08-14", tel: "74998147252",  email: "zandraguedes@gmail.com",           status: "ATIVO"    },
  { nome: "MARCOS VITOR GOMES OLIVEIRA CANDIDO", cargo: "Sushiman",            loja: "Ykedin Jacobina",     sexo: "M", dataNasc: "2002-12-02", dataAdm: "2021-07-24", tel: "74981300639",  email: "marcosvitor1249@gmail.com",        status: "ATIVO"    },
  { nome: "LUIZ ALBERTO FERREIRA DE OLIVEIRA",   cargo: "Sushiman chefe",      loja: "Ykedin Jacobina",     sexo: "M", dataNasc: "1994-03-30", dataAdm: "2017-08-10", tel: "71998064802",  email: "betinho199416@hotmail.com",        status: "AFASTADO" },
  { nome: "CARLOS DE JESUS",                     cargo: "Sushiman chefe",      loja: "Ykedin Capim Grosso", sexo: "M", dataNasc: "1997-01-08", dataAdm: "2020-12-11", tel: "74999948552",  email: "jeguemaster23@gmail.com",          status: "ATIVO"    },
  { nome: "FERNANDA SOUSA SANTOS",               cargo: "Auxiliar de cozinha", loja: "Ykedin Capim Grosso", sexo: "F", dataNasc: "2004-11-19", dataAdm: "2023-12-12", tel: "74999038651",  email: "nandazsnand@gmail.com",            status: "ATIVO"    },
  { nome: "TAIZA SILVA DE PAULA",                cargo: "Garçom",              loja: "Ykedin Capim Grosso", sexo: "F", dataNasc: "2008-05-13", dataAdm: "2025-07-27", tel: "74991422190",  email: "",                                 status: "ATIVO"    },
];

function cpfFake(n: number): string {
  const s = String(n).padStart(9, "0");
  return `${s.slice(0,3)}.${s.slice(3,6)}.${s.slice(6,9)}-00`;
}

function matricula(n: number): string {
  return `YK${String(n).padStart(4, "0")}`;
}

async function main() {
  console.log("Importando funcionários do Notion...\n");

  // 1. Garantir cargos
  const cargoMap = new Map<string, string>();
  for (const c of cargosData) {
    const existing = await (prisma as any).cargo.findFirst({ where: { nome: c.nome } });
    if (existing) {
      cargoMap.set(c.nome, existing.id);
      console.log(`Cargo existente: ${c.nome}`);
    } else {
      const created = await (prisma as any).cargo.create({ data: c });
      cargoMap.set(c.nome, created.id);
      console.log(`Cargo criado: ${c.nome}`);
    }
  }

  // 2. Buscar restaurantes
  const restaurantes = await (prisma as any).restaurante.findMany();
  const findRestaurante = (loja: string): string | null => {
    const lower = loja.toLowerCase();
    const keyword = lower.includes("capim") ? "capim"
                  : lower.includes("jacobina") ? "ykedin"
                  : "deck";
    const match = restaurantes.find((r: any) => {
      const rNome = r.nome.toLowerCase();
      if (keyword === "ykedin") return rNome.includes("ykedin") && !rNome.includes("capim");
      return rNome.includes(keyword);
    });
    return match?.id ?? null;
  };

  // 3. Criar funcionários
  let count = 0;
  let skip = 0;
  for (let i = 0; i < funcionariosData.length; i++) {
    const f = funcionariosData[i];
    const cargoId = cargoMap.get(f.cargo);
    const restauranteId = findRestaurante(f.loja);

    if (!cargoId) { console.error(`Cargo não encontrado: ${f.cargo}`); continue; }
    if (!restauranteId) { console.error(`Restaurante não encontrado para: ${f.loja}`); continue; }

    const exists = await (prisma as any).funcionario.findFirst({ where: { nome: f.nome } });
    if (exists) {
      console.log(`Já existe: ${f.nome}`);
      skip++;
      continue;
    }

    const salario = (await (prisma as any).cargo.findUnique({ where: { id: cargoId } })).salarioBase;
    const cidade = f.loja.includes("Capim") ? "Capim Grosso" : "Jacobina";

    await (prisma as any).funcionario.create({
      data: {
        matricula: matricula(i + 1),
        nome: f.nome,
        cpf: cpfFake(i + 1),
        dataNascimento: new Date(f.dataNasc),
        sexo: f.sexo,
        estadoCivil: "SOLTEIRO",
        email: f.email || null,
        telefone: f.tel,
        endereco: "A preencher",
        cidade,
        estado: "BA",
        cep: "44700-000",
        dataAdmissao: new Date(f.dataAdm),
        salario,
        tipoContrato: "CLT",
        status: f.status,
        turno: "MISTO",
        cargoId,
        restauranteId,
      },
    });
    console.log(`✓ ${f.nome}`);
    count++;
  }

  console.log(`\nImportação concluída: ${count} criados, ${skip} já existiam.`);
}

main()
  .catch(console.error)
  .finally(() => (prisma as any).$disconnect());
