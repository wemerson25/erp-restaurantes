import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const restauranteId = searchParams.get("restauranteId");
  const status = searchParams.get("status");

  const funcionarios = await prisma.funcionario.findMany({
    where: {
      AND: [
        search ? { nome: { contains: search } } : {},
        restauranteId ? { restauranteId } : {},
        status ? { status } : {},
      ],
    },
    include: {
      restaurante: { select: { nome: true } },
      cargo: { select: { nome: true, departamento: true } },
    },
    orderBy: { nome: "asc" },
  });

  return NextResponse.json(funcionarios);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const data = await req.json();

  const count = await prisma.funcionario.count();
  const matricula = `F${String(count + 1).padStart(5, "0")}`;

  const funcionario = await prisma.funcionario.create({
    data: {
      ...data,
      matricula,
      dataNascimento: new Date(data.dataNascimento),
      dataAdmissao: new Date(data.dataAdmissao),
      salario: parseFloat(data.salario),
    },
    include: {
      restaurante: { select: { nome: true } },
      cargo: { select: { nome: true } },
    },
  });

  return NextResponse.json(funcionario, { status: 201 });
}
