// Work schedule configuration — edit here to match each restaurant's hours
export const TOLERANCE_MINUTES = 10;

type DaySchedule = { entry: string; standardHours: number };

const WEEKDAY: DaySchedule = { entry: "11:00", standardHours: 8 };
const WEEKEND: DaySchedule = { entry: "17:30", standardHours: 6 };

function getSchedule(date: Date): DaySchedule {
  const day = date.getDay(); // 0=Sun, 6=Sat
  return day === 0 || day === 6 ? WEEKEND : WEEKDAY;
}

export function detectOcorrencia(entrada: Date | undefined, date: Date, horasTrabalhadas: number): string {
  if (!entrada) return "FALTA";

  const sched = getSchedule(date);
  const [eh, em] = sched.entry.split(":").map(Number);
  const expectedMinutes = eh * 60 + em;
  const actualMinutes = entrada.getHours() * 60 + entrada.getMinutes();

  if (actualMinutes > expectedMinutes + TOLERANCE_MINUTES) return "ATRASO";
  if (horasTrabalhadas < sched.standardHours - 1) return "SAIDA_ANTECIPADA";
  return "NORMAL";
}

// Sum all work blocks from an even-length sorted array of punch times
export function calcHoursFromPunches(punches: Date[]): number {
  let total = 0;
  for (let i = 0; i + 1 < punches.length; i += 2) {
    total += (punches[i + 1].getTime() - punches[i].getTime()) / 3600000;
  }
  return Math.max(0, Math.round(total * 100) / 100);
}
