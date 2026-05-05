export interface FeriadoLite { data: string; recorrente: boolean }

function parseUTC(dateStr: string) {
  // dateStr is ISO from DB, e.g. "2026-07-09T12:00:00.000Z"
  const d = new Date(dateStr);
  return { m: d.getUTCMonth() + 1, d: d.getUTCDate(), y: d.getUTCFullYear() };
}

function parseDateStr(dateStr: string) {
  // dateStr like "YYYY-MM-DD"
  const [y, m, d] = dateStr.split("-").map(Number);
  return { y, m, d };
}

export function isHolidayDate(dateStr: string, feriados: FeriadoLite[]): boolean {
  const { y, m, d } = parseDateStr(dateStr);
  return feriados.some((f) => {
    const fd = parseUTC(f.data);
    return f.recorrente ? fd.m === m && fd.d === d : fd.y === y && fd.m === m && fd.d === d;
  });
}

export function isEveOfHoliday(dateStr: string, feriados: FeriadoLite[]): boolean {
  const [y, m, d] = dateStr.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  const nextStr = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
  return isHolidayDate(nextStr, feriados);
}

export function validateFolgaDay(
  dateStr: string,
  feriados: FeriadoLite[]
): { valid: boolean; reason?: string } {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sun 1=Mon … 6=Sat
  if (dow === 0 || dow === 5 || dow === 6)
    return { valid: false, reason: "A folga só pode ser usada de segunda a quinta-feira." };
  if (isHolidayDate(dateStr, feriados))
    return { valid: false, reason: "Essa data é um feriado." };
  if (isEveOfHoliday(dateStr, feriados))
    return { valid: false, reason: "Esse dia é véspera de feriado." };
  return { valid: true };
}
