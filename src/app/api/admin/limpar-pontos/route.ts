import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { confirm } = await req.json();
  if (confirm !== "APAGAR_TUDO") {
    return NextResponse.json({ error: "Confirmação inválida" }, { status: 400 });
  }

  const erros: string[] = [];

  // 1. Add new columns if they don't exist yet (idempotent)
  for (const col of ["saida1", "entrada2"]) {
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE "RegistroPonto" ADD COLUMN "${col}" DATETIME`);
    } catch {
      // column already exists — safe to ignore
    }
  }

  // 2. Delete all records
  const [pontos, ausencias] = await Promise.all([
    prisma.registroPonto.deleteMany({}).catch((e) => { erros.push(`ponto: ${e.message}`); return { count: 0 }; }),
    prisma.ausencia.deleteMany({}).catch((e) => { erros.push(`ausencia: ${e.message}`); return { count: 0 }; }),
  ]);

  return NextResponse.json({
    ok: true,
    pontosApagados: pontos.count,
    ausenciasApagadas: ausencias.count,
    erros,
  });
}
