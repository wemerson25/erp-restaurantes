import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ensureEscalaTables } from "@/lib/escala-setup";
import { validarEscala } from "@/lib/validar-escala";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    await ensureEscalaTables();

    const { searchParams } = new URL(req.url);
    const semanaInicio = searchParams.get("semanaInicio"); // YYYY-MM-DD (Monday)
    const restauranteId = searchParams.get("restauranteId");

    if (!semanaInicio || !restauranteId)
      return NextResponse.json({ error: "semanaInicio e restauranteId são obrigatórios" }, { status: 400 });

    const inicio = new Date(`${semanaInicio}T00:00:00Z`);
    const fim = new Date(inicio);
    fim.setUTCDate(fim.getUTCDate() + 6);
    fim.setUTCHours(23, 59, 59, 999);

    const [schedules, ferias, ausencias, funcionarios, requisitos, funcSetores] = await Promise.all([
      prisma.schedule.findMany({
        where: { restauranteId, data: { gte: inicio, lte: fim } },
        include: { funcionario: { select: { id: true, nome: true, status: true } } },
        orderBy: { data: "asc" },
      }),
      prisma.ferias.findMany({
        where: {
          funcionario: { restauranteId },
          status: { in: ["AGENDADA", "EM_ANDAMENTO", "CONCLUIDA"] },
          dataInicio: { lte: fim },
          dataFim: { gte: inicio },
        },
        select: { funcionarioId: true, dataInicio: true, dataFim: true, status: true },
      }),
      prisma.ausencia.findMany({
        where: {
          funcionario: { restauranteId },
          status: { in: ["APROVADA", "PENDENTE"] },
          dataInicio: { lte: fim },
          dataFim: { gte: inicio },
        },
        select: { funcionarioId: true, dataInicio: true, dataFim: true, status: true },
      }),
      prisma.funcionario.findMany({
        where: { restauranteId, status: "ATIVO" },
        select: { id: true, nome: true, cargo: { select: { nome: true } } },
        orderBy: { nome: "asc" },
      }),
      prisma.scheduleRequirement.findMany({ where: { restauranteId } }),
      prisma.funcionarioSetor.findMany({
        where: { funcionario: { restauranteId } },
        select: { funcionarioId: true, setor: true },
      }),
    ]);

    const scheduleEntries = schedules.map((s) => ({
      id: s.id,
      funcionarioId: s.funcionarioId,
      funcionarioNome: s.funcionario.nome,
      funcionarioStatus: s.funcionario.status,
      restauranteId: s.restauranteId,
      data: s.data.toISOString().slice(0, 10),
      setor: s.setor,
      turno: s.turno,
      horarioEntrada: s.horarioEntrada,
      horarioSaida: s.horarioSaida,
      observacao: s.observacao,
    }));

    const alertas = validarEscala(
      scheduleEntries,
      ferias.map((f) => ({ funcionarioId: f.funcionarioId, dataInicio: f.dataInicio.toISOString(), dataFim: f.dataFim.toISOString(), status: f.status })),
      ausencias.map((a) => ({ funcionarioId: a.funcionarioId, dataInicio: a.dataInicio.toISOString(), dataFim: a.dataFim.toISOString(), status: a.status })),
      requisitos.map((r) => ({ setor: r.setor, turno: r.turno, minimoFuncionarios: r.minimoFuncionarios })),
    );

    return NextResponse.json({
      schedules: scheduleEntries,
      alertas,
      funcionarios,
      requisitos,
      funcionarioSetores: funcSetores,
      semanaInicio,
      semanaFim: fim.toISOString().slice(0, 10),
    });
  } catch (e) {
    return NextResponse.json({ error: "Erro ao buscar escala", detail: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    await ensureEscalaTables();

    const { funcionarioId, restauranteId, data, setor, turno, horarioEntrada, horarioSaida, observacao } = await req.json();

    if (!funcionarioId || !restauranteId || !data || !setor || !turno)
      return NextResponse.json({ error: "Campos obrigatórios: funcionarioId, restauranteId, data, setor, turno" }, { status: 400 });

    const schedule = await prisma.schedule.create({
      data: {
        funcionarioId,
        restauranteId,
        data: new Date(`${data}T12:00:00Z`),
        setor,
        turno,
        horarioEntrada: horarioEntrada || null,
        horarioSaida: horarioSaida || null,
        observacao: observacao || null,
      },
    });

    return NextResponse.json(schedule, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: "Erro ao criar entrada de escala", detail: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
