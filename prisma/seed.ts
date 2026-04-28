import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";

const adapter = new PrismaBetterSqlite3({ url: "file:dev.db" });
const prisma = new PrismaClient({ adapter } as never);

async function main() {
  const adminPw = await bcrypt.hash("admin123", 10);
  await prisma.user.upsert({
    where: { email: "admin@restaurantes.com" },
    update: {},
    create: {
      name: "Administrador",
      email: "admin@restaurantes.com",
      password: adminPw,
      role: "ADMIN",
    },
  });

  const r1 = await prisma.restaurante.upsert({
    where: { cnpj: "12.345.678/0001-01" },
    update: {},
    create: {
      nome: "Restaurante Centro",
      cnpj: "12.345.678/0001-01",
      endereco: "Rua das Flores, 100",
      cidade: "São Paulo",
      estado: "SP",
      telefone: "(11) 3333-1111",
      email: "centro@restaurantes.com",
    },
  });

  const r2 = await prisma.restaurante.upsert({
    where: { cnpj: "12.345.678/0001-02" },
    update: {},
    create: {
      nome: "Restaurante Jardins",
      cnpj: "12.345.678/0001-02",
      endereco: "Av. Paulista, 500",
      cidade: "São Paulo",
      estado: "SP",
      telefone: "(11) 3333-2222",
      email: "jardins@restaurantes.com",
    },
  });

  const r3 = await prisma.restaurante.upsert({
    where: { cnpj: "12.345.678/0001-03" },
    update: {},
    create: {
      nome: "Restaurante Sul",
      cnpj: "12.345.678/0001-03",
      endereco: "Rua da Paz, 200",
      cidade: "São Paulo",
      estado: "SP",
      telefone: "(11) 3333-3333",
      email: "sul@restaurantes.com",
    },
  });

  const cargos = await Promise.all([
    prisma.cargo.upsert({
      where: { id: "cargo-gerente" },
      update: {},
      create: { id: "cargo-gerente", nome: "Gerente", departamento: "Gestão", salarioBase: 5500 },
    }),
    prisma.cargo.upsert({
      where: { id: "cargo-cozinheiro" },
      update: {},
      create: { id: "cargo-cozinheiro", nome: "Cozinheiro", departamento: "Cozinha", salarioBase: 3200 },
    }),
    prisma.cargo.upsert({
      where: { id: "cargo-garcom" },
      update: {},
      create: { id: "cargo-garcom", nome: "Garçom", departamento: "Salão", salarioBase: 1700 },
    }),
    prisma.cargo.upsert({
      where: { id: "cargo-caixa" },
      update: {},
      create: { id: "cargo-caixa", nome: "Operador de Caixa", departamento: "Financeiro", salarioBase: 2100 },
    }),
    prisma.cargo.upsert({
      where: { id: "cargo-auxiliar" },
      update: {},
      create: { id: "cargo-auxiliar", nome: "Auxiliar de Cozinha", departamento: "Cozinha", salarioBase: 1518 },
    }),
    prisma.cargo.upsert({
      where: { id: "cargo-host" },
      update: {},
      create: { id: "cargo-host", nome: "Host/Recepcionista", departamento: "Salão", salarioBase: 1900 },
    }),
  ]);

  const funcionariosData = [
    { nome: "Ana Paula Silva", cpf: "111.222.333-01", salario: 5500, cargoId: cargos[0].id, restauranteId: r1.id, turno: "MANHA" },
    { nome: "Carlos Eduardo Souza", cpf: "111.222.333-02", salario: 3200, cargoId: cargos[1].id, restauranteId: r1.id, turno: "TARDE" },
    { nome: "Mariana Costa", cpf: "111.222.333-03", salario: 1700, cargoId: cargos[2].id, restauranteId: r1.id, turno: "TARDE" },
    { nome: "João Pedro Lima", cpf: "111.222.333-04", salario: 1700, cargoId: cargos[2].id, restauranteId: r1.id, turno: "NOITE" },
    { nome: "Fernanda Oliveira", cpf: "111.222.333-05", salario: 2100, cargoId: cargos[3].id, restauranteId: r1.id, turno: "MANHA" },
    { nome: "Roberto Santos", cpf: "111.222.333-06", salario: 5500, cargoId: cargos[0].id, restauranteId: r2.id, turno: "MANHA" },
    { nome: "Juliana Ferreira", cpf: "111.222.333-07", salario: 3200, cargoId: cargos[1].id, restauranteId: r2.id, turno: "MANHA" },
    { nome: "Lucas Almeida", cpf: "111.222.333-08", salario: 1518, cargoId: cargos[4].id, restauranteId: r2.id, turno: "TARDE" },
    { nome: "Camila Rodrigues", cpf: "111.222.333-09", salario: 1900, cargoId: cargos[5].id, restauranteId: r2.id, turno: "MANHA" },
    { nome: "Pedro Henrique Melo", cpf: "111.222.333-10", salario: 5500, cargoId: cargos[0].id, restauranteId: r3.id, turno: "MANHA" },
    { nome: "Isabela Nunes", cpf: "111.222.333-11", salario: 1700, cargoId: cargos[2].id, restauranteId: r3.id, turno: "TARDE" },
    { nome: "Thiago Barbosa", cpf: "111.222.333-12", salario: 2100, cargoId: cargos[3].id, restauranteId: r3.id, turno: "NOITE" },
  ];

  for (let i = 0; i < funcionariosData.length; i++) {
    const f = funcionariosData[i];
    await prisma.funcionario.upsert({
      where: { cpf: f.cpf },
      update: {},
      create: {
        matricula: `F${String(i + 1).padStart(5, "0")}`,
        nome: f.nome,
        cpf: f.cpf,
        dataNascimento: new Date(1985 + i, i % 12, (i % 28) + 1),
        sexo: i % 2 === 0 ? "F" : "M",
        estadoCivil: "SOLTEIRO",
        telefone: `(11) 9${String(8000 + i).padStart(4, "0")}-${String(1000 + i).padStart(4, "0")}`,
        endereco: `Rua ${["das Flores", "do Sol", "da Paz", "das Acácias"][i % 4]}, ${100 + i * 10}`,
        cidade: "São Paulo",
        estado: "SP",
        cep: "01310-100",
        dataAdmissao: new Date(2022, i % 12, (i % 28) + 1),
        salario: f.salario,
        tipoContrato: "CLT",
        status: "ATIVO",
        turno: f.turno,
        restauranteId: f.restauranteId,
        cargoId: f.cargoId,
      },
    });
  }

  for (const v of [
    { titulo: "Garçom Experiente", descricao: "Atendimento ao cliente em restaurante premium", requisitos: "Experiência mínima de 1 ano, boa comunicação", tipoContrato: "CLT", salario: 1700, restauranteId: r1.id, status: "ABERTA" },
    { titulo: "Auxiliar de Cozinha", descricao: "Apoio na preparação de alimentos", requisitos: "Curso básico de manipulação de alimentos", tipoContrato: "CLT", salario: 1518, restauranteId: r2.id, status: "ABERTA" },
    { titulo: "Cozinheiro Chefe", descricao: "Gestão da cozinha e elaboração de cardápio", requisitos: "Formação em gastronomia, 3 anos de experiência", tipoContrato: "CLT", salario: 4500, restauranteId: r3.id, status: "ABERTA" },
  ]) {
    await prisma.vaga.create({ data: v });
  }

  console.log("✅ Seed concluído com sucesso!");
  console.log("Login: admin@restaurantes.com | Senha: admin123");
}

main().catch(console.error).finally(() => prisma.$disconnect());
