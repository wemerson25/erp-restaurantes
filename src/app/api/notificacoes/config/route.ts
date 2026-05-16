import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAllEventConfigs, updateEventConfig, ensureNotificacaoConfigTable } from "@/lib/notificacao-config";
import { ensureGestorTable } from "@/lib/gestor-setup";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  await ensureGestorTable();
  const [configs, gestores] = await Promise.all([
    getAllEventConfigs(),
    prisma.$queryRawUnsafe<{ id: string; nome: string; ativo: number }[]>(
      `SELECT id, nome, ativo FROM "Gestor" ORDER BY nome ASC`,
    ),
  ]);

  return NextResponse.json({
    configs,
    gestores: gestores.map(g => ({ ...g, ativo: g.ativo === 1 })),
  });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  await ensureNotificacaoConfigTable();
  const body = await req.json() as {
    evento: string;
    ativo?: boolean;
    incluiColaborador?: boolean;
    gestorIds?: string[];
  };

  if (!body.evento) return NextResponse.json({ error: "evento obrigatório" }, { status: 400 });

  await updateEventConfig(body.evento, {
    ativo: body.ativo,
    incluiColaborador: body.incluiColaborador,
    gestorIds: body.gestorIds,
  });

  return NextResponse.json({ ok: true });
}
