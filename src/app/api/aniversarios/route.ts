import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = parseInt(searchParams.get("month") ?? String(new Date().getUTCMonth() + 1));

  const funcionarios = await prisma.funcionario.findMany({
    where: { status: "ATIVO" },
    select: {
      id: true,
      nome: true,
      dataNascimento: true,
      cargo: { select: { nome: true } },
      restaurante: { select: { nome: true } },
    },
  });

  const today = new Date();
  const todayDay = today.getUTCDate();
  const todayMonth = today.getUTCMonth() + 1;

  const aniversariantes = funcionarios
    .map((f) => {
      const d = new Date(f.dataNascimento);
      return { ...f, dia: d.getUTCDate(), mes: d.getUTCMonth() + 1 };
    })
    .filter((f) => f.mes === month)
    .sort((a, b) => a.dia - b.dia)
    .map((f) => ({
      id: f.id,
      nome: f.nome,
      dia: f.dia,
      mes: f.mes,
      cargo: f.cargo.nome,
      restaurante: f.restaurante.nome,
      isToday: f.dia === todayDay && f.mes === todayMonth,
    }));

  return NextResponse.json(aniversariantes);
}
