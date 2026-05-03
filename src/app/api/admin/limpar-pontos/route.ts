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

  const [pontos, ausencias] = await Promise.all([
    prisma.registroPonto.deleteMany({}),
    prisma.ausencia.deleteMany({}),
  ]);

  return NextResponse.json({
    ok: true,
    pontosApagados: pontos.count,
    ausenciasApagadas: ausencias.count,
  });
}
