import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { detectOcorrencia, calcHoursFromPunches } from "@/lib/schedule";

interface Punch {
  pis: string;
  dateStr: string; // YYYY-MM-DD
  timeStr: string; // HH:MM
  timestamp: number;
}

function parseAFD(text: string): Punch[] {
  const punches: Punch[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (line.length < 33 || line[9] !== "3") continue;
    const dd = line.substring(10, 12);
    const mm = line.substring(12, 14);
    const yyyy = line.substring(14, 18);
    const hh = line.substring(18, 20);
    const min = line.substring(20, 22);
    const pis = line.substring(22, 33).trim();
    if (!pis || pis === "00000000000") continue;
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const timeStr = `${hh}:${min}`;
    punches.push({ pis, dateStr, timeStr, timestamp: new Date(`${dateStr}T${timeStr}:00`).getTime() });
  }
  return punches;
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

  // Group by PIS + date, sorted by time
  const groups = new Map<string, Punch[]>();
  for (const p of punches) {
    const key = `${p.pis}|${p.dateStr}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }
  for (const list of groups.values()) list.sort((a, b) => a.timestamp - b.timestamp);

  const funcionarios = await prisma.funcionario.findMany({
    where: { pisPassep: { not: null }, status: "ATIVO" },
    select: { id: true, pisPassep: true },
  });
  const byPis = new Map(funcionarios.map((f) => [f.pisPassep!.replace(/\D/g, ""), f]));

  let imported = 0;
  let updated = 0;
  const unmatched = new Set<string>();

  for (const [key, list] of groups.entries()) {
    const [pis, dateStr] = key.split("|");
    const funcionario = byPis.get(pis.replace(/\D/g, ""));
    if (!funcionario) { unmatched.add(pis); continue; }

    const toDate = (t: string) => new Date(`${dateStr}T${t}:00`);
    const dates = list.map((p) => toDate(p.timeStr));

    // Ensure even number of punches (drop last if odd — incomplete pair)
    const paired = dates.length % 2 === 0 ? dates : dates.slice(0, -1);

    const entrada   = paired[0] ?? null;
    // Store first exit and last entry in the two middle fields for display
    const saidaAlmoco    = paired.length >= 2 ? paired[1] : null;
    const retornoAlmoco  = paired.length >= 4 ? paired[paired.length - 2] : null;
    const saida          = paired.length >= 2 ? paired[paired.length - 1] : null;

    const horasTrabalhadas = calcHoursFromPunches(paired);
    const horasExtras = Math.max(0, horasTrabalhadas - 8);
    const dataDate = new Date(`${dateStr}T00:00:00`);
    const ocorrencia = detectOcorrencia(entrada ?? undefined, dataDate, horasTrabalhadas);

    const payload = {
      funcionarioId: funcionario.id,
      data: dataDate,
      entrada,
      saidaAlmoco,
      retornoAlmoco,
      saida,
      horasTrabalhadas,
      horasExtras,
      ocorrencia,
    };

    const existing = await prisma.registroPonto.findFirst({
      where: { funcionarioId: funcionario.id, data: dataDate },
    });

    if (existing) {
      await prisma.registroPonto.update({ where: { id: existing.id }, data: payload });
      updated++;
    } else {
      await prisma.registroPonto.create({ data: payload });
      imported++;
    }
  }

  return NextResponse.json({ imported, updated, unmatched: Array.from(unmatched), total: imported + updated });
}
