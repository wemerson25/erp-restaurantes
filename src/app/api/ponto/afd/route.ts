import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

interface Punch {
  pis: string;
  dateStr: string; // YYYY-MM-DD
  timeStr: string; // HH:MM
  timestamp: number;
}

function parseAFD(text: string): Punch[] {
  const punches: Punch[] = [];
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    if (line.length < 33) continue;
    const tipo = line[9];
    if (tipo !== "3") continue;

    const dd = line.substring(10, 12);
    const mm = line.substring(12, 14);
    const yyyy = line.substring(14, 18);
    const hh = line.substring(18, 20);
    const min = line.substring(20, 22);
    const pis = line.substring(22, 33).trim();

    if (!pis || pis === "00000000000") continue;

    const dateStr = `${yyyy}-${mm}-${dd}`;
    const timeStr = `${hh}:${min}`;
    const timestamp = new Date(`${dateStr}T${timeStr}:00`).getTime();

    punches.push({ pis, dateStr, timeStr, timestamp });
  }

  return punches;
}

function calcHours(entrada?: Date, saidaAlmoco?: Date, retornoAlmoco?: Date, saida?: Date): number {
  if (!entrada || !saida) return 0;
  let total = (saida.getTime() - entrada.getTime()) / 3600000;
  if (saidaAlmoco && retornoAlmoco) {
    total -= (retornoAlmoco.getTime() - saidaAlmoco.getTime()) / 3600000;
  }
  return Math.max(0, Math.round(total * 100) / 100);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  let text: string;
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 });
    text = await file.text();
  } else {
    text = await req.text();
  }

  const punches = parseAFD(text);
  if (punches.length === 0) {
    return NextResponse.json({ error: "Nenhum registro tipo 3 encontrado no arquivo" }, { status: 400 });
  }

  // Group by PIS + date
  const groups = new Map<string, Punch[]>();
  for (const p of punches) {
    const key = `${p.pis}|${p.dateStr}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }

  // Sort each group by timestamp
  for (const list of groups.values()) {
    list.sort((a, b) => a.timestamp - b.timestamp);
  }

  // Get all employees with PIS
  const funcionarios = await prisma.funcionario.findMany({
    where: { pisPassep: { not: null }, status: "ATIVO" },
    select: { id: true, nome: true, pisPassep: true },
  });
  const pisByFuncionario = new Map(funcionarios.map((f) => [f.pisPassep!.replace(/\D/g, ""), f]));

  let imported = 0;
  let updated = 0;
  const unmatched = new Set<string>();

  for (const [key, list] of groups.entries()) {
    const [pis, dateStr] = key.split("|");
    const pisClean = pis.replace(/\D/g, "");
    const funcionario = pisByFuncionario.get(pisClean);

    if (!funcionario) {
      unmatched.add(pis);
      continue;
    }

    const toDate = (timeStr: string) => new Date(`${dateStr}T${timeStr}:00`);

    const entrada = list[0] ? toDate(list[0].timeStr) : undefined;
    const saidaAlmoco = list[1] ? toDate(list[1].timeStr) : undefined;
    const retornoAlmoco = list[2] ? toDate(list[2].timeStr) : undefined;
    const saida = list[3] ? toDate(list[3].timeStr) : list[1] && !list[2] ? toDate(list[1].timeStr) : undefined;

    // 2-punch day: entrada + saida (no lunch)
    const entradaFinal = entrada;
    const saidaAlmocoFinal = list.length >= 4 ? saidaAlmoco : undefined;
    const retornoAlmocoFinal = list.length >= 4 ? retornoAlmoco : undefined;
    const saidaFinal = list.length >= 4 ? saida : list.length === 2 ? saidaAlmoco : undefined;

    const horasTrabalhadas = calcHours(entradaFinal, saidaAlmocoFinal, retornoAlmocoFinal, saidaFinal);
    const horasExtras = Math.max(0, horasTrabalhadas - 8);
    const ocorrencia = horasTrabalhadas === 0 ? "FALTA" : horasExtras > 0 ? "NORMAL" : "NORMAL";

    const dataDate = new Date(`${dateStr}T00:00:00`);
    const existing = await prisma.registroPonto.findFirst({
      where: { funcionarioId: funcionario.id, data: dataDate },
    });

    const payload = {
      funcionarioId: funcionario.id,
      data: dataDate,
      entrada: entradaFinal ?? null,
      saidaAlmoco: saidaAlmocoFinal ?? null,
      retornoAlmoco: retornoAlmocoFinal ?? null,
      saida: saidaFinal ?? null,
      horasTrabalhadas,
      horasExtras,
      ocorrencia,
    };

    if (existing) {
      await prisma.registroPonto.update({ where: { id: existing.id }, data: payload });
      updated++;
    } else {
      await prisma.registroPonto.create({ data: payload });
      imported++;
    }
  }

  return NextResponse.json({
    imported,
    updated,
    unmatched: Array.from(unmatched),
    total: imported + updated,
  });
}
