import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getCargaDiaria } from "@/lib/schedule";
import ExcelJS from "exceljs";

// ─── helpers ────────────────────────────────────────────────────────────────

const DAYS_PT = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const MONTHS_PT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

function toHHMM(date: Date | null | undefined): string {
  if (!date) return "";
  const h = date.getUTCHours();
  const m = date.getUTCMinutes();
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function minutesToHHMM(min: number): string {
  if (min <= 0) return "00:00";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function hoursToHHMM(h: number): string {
  return minutesToHHMM(Math.round(h * 60));
}

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatCNPJ(cnpj: string): string {
  const n = cnpj.replace(/\D/g, "");
  if (n.length !== 14) return cnpj;
  return `${n.slice(0,2)}.${n.slice(2,5)}.${n.slice(5,8)}/${n.slice(8,12)}-${n.slice(12)}`;
}

// ─── Styles ────────────────────────────────────────────────────────────────

type Align = "left" | "center" | "right";

function hdr(wb: ExcelJS.Workbook, ws: ExcelJS.Worksheet, row: number, col: number, value: string, opts?: { bold?: boolean; align?: Align; bg?: string; border?: boolean; size?: number }) {
  const cell = ws.getCell(row, col);
  cell.value = value;
  cell.font = { bold: opts?.bold ?? false, size: opts?.size ?? 10, name: "Arial" };
  cell.alignment = { horizontal: opts?.align ?? "left", vertical: "middle" };
  if (opts?.bg) {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: opts.bg } };
  }
  if (opts?.border) {
    cell.border = {
      top: { style: "thin" }, bottom: { style: "thin" },
      left: { style: "thin" }, right: { style: "thin" },
    };
  }
  return cell;
  void wb;
}

function setThinBorder(cell: ExcelJS.Cell) {
  cell.border = {
    top: { style: "thin" }, bottom: { style: "thin" },
    left: { style: "thin" }, right: { style: "thin" },
  };
}

// ─── GET ───────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const funcionarioId = searchParams.get("funcionarioId");
  const month = searchParams.get("month"); // YYYY-MM

  if (!funcionarioId || !month) {
    return NextResponse.json({ error: "funcionarioId e month são obrigatórios" }, { status: 400 });
  }

  const [year, mon] = month.split("-").map(Number);
  const monthStart = new Date(Date.UTC(year, mon - 1, 1));
  const monthEnd   = new Date(Date.UTC(year, mon, 0, 23, 59, 59));

  const func = await prisma.funcionario.findUnique({
    where: { id: funcionarioId },
    include: { cargo: true, restaurante: true },
  });
  if (!func) return NextResponse.json({ error: "Funcionário não encontrado" }, { status: 404 });

  const [registros, ausencias, ferias] = await Promise.all([
    prisma.registroPonto.findMany({
      where: { funcionarioId, data: { gte: monthStart, lte: monthEnd } },
      orderBy: { data: "asc" },
    }),
    prisma.ausencia.findMany({
      where: { funcionarioId, dataInicio: { lte: monthEnd }, dataFim: { gte: monthStart } },
    }),
    prisma.ferias.findMany({
      where: { funcionarioId, dataInicio: { lte: monthEnd }, dataFim: { gte: monthStart } },
    }),
  ]);

  // Build lookup maps
  const registroByDay = new Map(registros.map((r) => [dateStr(r.data), r]));
  const ausenciaByDay = new Map<string, typeof ausencias[0]>();
  for (const a of ausencias) {
    const cur = new Date(a.dataInicio);
    while (cur <= a.dataFim) {
      ausenciaByDay.set(dateStr(cur), a);
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
  }
  const feriasByDay = new Set<string>();
  for (const f of ferias) {
    const cur = new Date(f.dataInicio);
    while (cur <= f.dataFim) {
      feriasByDay.add(dateStr(cur));
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
  }

  const ausenciaTipoLabel: Record<string, string> = {
    ATESTADO_MEDICO: "ATESTA",
    LICENCA_MATERNIDADE: "MAT",
    LICENCA_PATERNIDADE: "PAT",
    ACIDENTE_TRABALHO: "ACID",
    LICENCA_MEDICA: "ATESTA",
    FALTA_JUSTIFICADA: "FALTA",
    FALTA_NAO_JUSTIFICADA: "FALTA",
    OUTROS: "AUSEN",
  };

  // ─── Build workbook ───────────────────────────────────────────────────────

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Cartão Ponto");

  // Column widths (A-M = cols 1-13)
  ws.getColumn(1).width  = 18; // Data
  ws.getColumn(2).width  = 8;  // Ent. 1
  ws.getColumn(3).width  = 8;  // Saí. 1
  ws.getColumn(4).width  = 8;  // Ent. 2
  ws.getColumn(5).width  = 8;  // Saí. 2
  ws.getColumn(6).width  = 9;  // Normais
  ws.getColumn(7).width  = 7;  // ExNot
  ws.getColumn(8).width  = 7;  // Faltas
  ws.getColumn(9).width  = 7;  // Not.
  ws.getColumn(10).width = 7;  // DSR
  ws.getColumn(11).width = 7;  // Carga
  ws.getColumn(12).width = 7;  // Extras
  ws.getColumn(13).width = 7;  // Ajuste

  // Row heights
  ws.getRow(1).height = 18;
  ws.getRow(2).height = 14;
  ws.getRow(15).height = 14;
  ws.getRow(16).height = 14;

  const bgGray  = "FFD9D9D9";
  const bgBlue  = "FFBDD7EE";
  const bgTitle = "FF1F3864";

  // ─── Row 1: CARTÃO PONTO ─────────────────────────────────────────────────
  ws.mergeCells("A1:M1");
  const r1 = ws.getCell("A1");
  r1.value = "CARTÃO PONTO";
  r1.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" }, name: "Arial" };
  r1.alignment = { horizontal: "center", vertical: "middle" };
  r1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgTitle } };

  // ─── Row 2: Period ───────────────────────────────────────────────────────
  ws.mergeCells("A2:M2");
  const daysInMonth = new Date(year, mon, 0).getDate();
  const r2 = ws.getCell("A2");
  r2.value = `De: 01/${String(mon).padStart(2,"0")}/${year} até ${daysInMonth}/${String(mon).padStart(2,"0")}/${year}`;
  r2.font = { bold: true, size: 10, name: "Arial" };
  r2.alignment = { horizontal: "left", vertical: "middle" };

  // ─── Row 3: empty ────────────────────────────────────────────────────────

  // ─── Row 4: Empresa + Horário de Trabalho header ─────────────────────────
  hdr(wb, ws, 4, 1, "Empresa", { bold: true, bg: bgGray });
  ws.mergeCells(4, 2, 4, 6);
  const empresaCell = ws.getCell(4, 2);
  empresaCell.value = func.restaurante.nome;
  empresaCell.font = { bold: false, size: 10, name: "Arial" };

  ws.mergeCells(4, 7, 4, 13);
  const htCell = ws.getCell(4, 7);
  htCell.value = "Horário de Trabalho";
  htCell.font = { bold: true, size: 10, name: "Arial" };
  htCell.alignment = { horizontal: "center", vertical: "middle" };
  htCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgBlue } };

  // ─── Row 5: CNPJ + schedule headers ─────────────────────────────────────
  hdr(wb, ws, 5, 1, "CNPJ", { bold: true, bg: bgGray });
  ws.getCell(5, 2).value = formatCNPJ(func.restaurante.cnpj);
  ws.getCell(5, 2).font = { size: 10, name: "Arial" };

  ["", "Ent1", "Sai1", "Ent2", "Sai2", "Ent3", "Sai3"].forEach((v, i) => {
    const c = ws.getCell(5, 7 + i);
    c.value = v;
    c.font = { bold: true, size: 9, name: "Arial" };
    c.alignment = { horizontal: "center" };
    if (i > 0) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgGray } };
  });

  // ─── Rows 6-12: Info + schedule per day ──────────────────────────────────
  const infoRows: [string, string, string, string][] = [
    ["Inscrição", "", "", ""],
    ["", "", "", ""],
    ["Nome", func.nome, "", ""],
    ["Nº Folha", func.matricula, "Nº PIS#", func.pisPassep ?? ""],
    ["CTPS", func.ctps ?? "", "Admiss", func.dataAdmissao.toLocaleDateString("pt-BR")],
    ["Função", func.cargo.nome, "", ""],
    ["Departamento", func.cargo.departamento, "", ""],
  ];
  const schedDays = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];

  infoRows.forEach(([label, val, label2, val2], i) => {
    const r = 6 + i;
    if (label) hdr(wb, ws, r, 1, label, { bold: true, bg: bgGray });
    if (val)   { ws.getCell(r, 2).value = val; ws.getCell(r, 2).font = { size: 10, name: "Arial" }; }
    if (label2){ ws.getCell(r, 3).value = label2; ws.getCell(r, 3).font = { bold: true, size: 10, name: "Arial" }; }
    if (val2)  { ws.getCell(r, 4).value = val2; ws.getCell(r, 4).font = { size: 10, name: "Arial" }; }
    // Schedule columns
    ws.getCell(r, 7).value = schedDays[i];
    ws.getCell(r, 7).font = { bold: true, size: 9, name: "Arial" };
    ws.getCell(r, 7).alignment = { horizontal: "center" };
  });

  // ─── Row 15: Column headers ───────────────────────────────────────────────
  const colHeaders = ["Data","Ent. 1","Saí. 2","Ent. 3","Saí. 3","Normais","ExNot","Faltas","Not.","DSR","Carga","Extras","Ajuste"];
  colHeaders.forEach((h, i) => {
    const cell = ws.getCell(15, i + 1);
    cell.value = h;
    cell.font = { bold: true, size: 9, name: "Arial" };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgGray } };
    setThinBorder(cell);
  });

  // ─── Daily rows ───────────────────────────────────────────────────────────
  let totalNormais = 0;
  let totalExtras  = 0;
  let totalFaltas  = 0;
  let totalCarga   = 0;

  const dataRows: (string | number)[][] = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const dayDate = new Date(Date.UTC(year, mon - 1, d));
    const dayKey  = dateStr(dayDate);
    const dow     = dayDate.getUTCDay(); // 0=dom, 1=seg...
    const dowLabel = DAYS_PT[dow];
    const dateLabel = `${String(d).padStart(2,"0")}/${String(mon).padStart(2,"0")}/${String(year).slice(2)} - ${dowLabel.toLowerCase()}`;

    const reg     = registroByDay.get(dayKey);
    const ausencia = ausenciaByDay.get(dayKey);
    const isFeria  = feriasByDay.has(dayKey);

    const row: (string | number)[] = [dateLabel, "", "", "", "", "", "", "", "", "", "", "", ""];

    if (reg) {
      // Columns: Ent.1=entrada, Saí.2=saidaAlmoco, Ent.3=retornoAlmoco, Saí.3=saida
      row[1] = toHHMM(reg.entrada ?? null);
      row[2] = toHHMM(reg.saidaAlmoco ?? null);
      row[3] = toHHMM(reg.retornoAlmoco ?? null);
      row[4] = toHHMM(reg.saida ?? null);

      const cargaDiariaMin = Math.round(getCargaDiaria(func.restaurante.nome, dayDate) * 60);
      if (reg.ocorrencia === "FALTA") {
        row[7] = hoursToHHMM(cargaDiariaMin / 60);
        totalFaltas += cargaDiariaMin;
      } else {
        const worked = reg.horasTrabalhadas ?? 0;
        const normais = Math.min(worked, cargaDiariaMin / 60);
        const extras  = reg.horasExtras ?? 0;
        row[5]  = hoursToHHMM(normais);
        row[10] = minutesToHHMM(cargaDiariaMin);
        row[11] = extras > 0 ? hoursToHHMM(extras) : "";
        totalNormais += Math.round(normais * 60);
        totalExtras  += Math.round(extras * 60);
        totalCarga   += cargaDiariaMin;
      }
    } else if (isFeria) {
      row[1] = "FÉRIAS"; row[2] = "FÉRIAS"; row[3] = "FÉRIAS"; row[4] = "FÉRIAS";
    } else if (ausencia) {
      const label = ausenciaTipoLabel[ausencia.tipo] ?? "AUSEN";
      row[1] = label; row[2] = label; row[3] = label; row[4] = label;
    }

    dataRows.push(row);
  }

  // ─── Row 16: Totals ───────────────────────────────────────────────────────
  const totalsRow = [
    "",
    "", "", "", "",
    minutesToHHMM(totalNormais),
    "00:00",
    minutesToHHMM(totalFaltas),
    "00:00",
    "00:00",
    minutesToHHMM(totalCarga),
    minutesToHHMM(totalExtras),
    "00:00",
  ];
  const tr = ws.addRow(totalsRow); // row 16
  tr.eachCell((cell) => {
    cell.font = { bold: true, size: 9, name: "Arial" };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: bgGray } };
    setThinBorder(cell);
  });

  // ─── Add daily rows ───────────────────────────────────────────────────────
  dataRows.forEach((rowData) => {
    const r = ws.addRow(rowData);
    r.eachCell({ includeEmpty: true }, (cell, colNum) => {
      cell.font = { size: 9, name: "Arial" };
      cell.alignment = { horizontal: colNum === 1 ? "left" : "center", vertical: "middle" };
      setThinBorder(cell);
      // Red background for FALTA/ATRASO rows (if any punch col has "FALTA")
      const val = String(cell.value ?? "");
      if (colNum === 1 && (rowData[7] || rowData[1] === "FALTA")) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFC7CE" } };
      }
      if (["FÉRIAS","ATESTA","FALTA","AUSEN","MAT","PAT","ACID"].includes(val) && colNum > 1 && colNum <= 5) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFE699" } };
        cell.font = { bold: true, size: 9, name: "Arial" };
      }
    });
  });

  // ─── Footer notes ─────────────────────────────────────────────────────────
  const footerRowNum = 16 + daysInMonth + 2;
  ws.mergeCells(footerRowNum, 1, footerRowNum, 4);
  ws.getCell(footerRowNum, 1).value = "(*) - Batida lançada manualmente";
  ws.getCell(footerRowNum, 1).font = { size: 8, italic: true, name: "Arial" };
  ws.mergeCells(footerRowNum, 5, footerRowNum, 8);
  ws.getCell(footerRowNum, 5).value = "(*) - Abono Parcial";
  ws.getCell(footerRowNum, 5).font = { size: 8, italic: true, name: "Arial" };
  ws.mergeCells(footerRowNum, 9, footerRowNum, 13);
  ws.getCell(footerRowNum, 9).value = "(*) - Pré Assinalado";
  ws.getCell(footerRowNum, 9).font = { size: 8, italic: true, name: "Arial" };

  // ─── Signature row ────────────────────────────────────────────────────────
  const sigRowNum = footerRowNum + 3;
  ws.mergeCells(sigRowNum, 1, sigRowNum, 5);
  const sigEmp = ws.getCell(sigRowNum, 1);
  sigEmp.value = func.nome;
  sigEmp.font = { bold: true, size: 10, name: "Arial" };
  sigEmp.alignment = { horizontal: "center" };
  sigEmp.border = { top: { style: "thin" } };

  ws.mergeCells(sigRowNum, 8, sigRowNum, 13);
  const sigAdm = ws.getCell(sigRowNum, 8);
  sigAdm.value = "_________________________________";
  sigAdm.font = { size: 10, name: "Arial" };
  sigAdm.alignment = { horizontal: "center" };

  ws.getRow(sigRowNum + 1).getCell(1).value = "Funcionário";
  ws.getRow(sigRowNum + 1).getCell(1).font = { size: 8, name: "Arial" };
  ws.getRow(sigRowNum + 1).getCell(8).value = "Responsável";
  ws.getRow(sigRowNum + 1).getCell(8).font = { size: 8, name: "Arial" };

  // ─── Print settings ───────────────────────────────────────────────────────
  ws.pageSetup.orientation = "portrait";
  ws.pageSetup.fitToPage = true;
  ws.pageSetup.fitToWidth = 1;

  // ─── Return file ─────────────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();
  const nomeMes = MONTHS_PT[mon - 1];
  const filename = `cartao_ponto_${func.nome.replace(/\s+/g, "_")}_${nomeMes}_${year}.xlsx`;

  return new NextResponse(new Uint8Array(buffer as ArrayBuffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
