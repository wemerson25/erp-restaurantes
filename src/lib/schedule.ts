export const TOLERANCE_MINUTES = 10;

// Deck SteakHouse daily load: 7h20min every day
const DECK_HOURS = 7 + 20 / 60;

/** Returns the contractual daily work hours for a given restaurant and date. */
export function getCargaDiaria(restauranteNome: string, date: Date): number {
  if (/deck|steak/i.test(restauranteNome)) return DECK_HOURS;
  // Ykedin (Oriental, Capim Grosso, etc.): weekdays 8h, weekends 6h
  const day = date.getUTCDay();
  return day === 0 || day === 6 ? 6 : 8;
}

type DaySchedule = { entry: string; standardHours: number };

// Morning shift (Ykedin Oriental weekdays)
const MORNING:  DaySchedule = { entry: "11:00", standardHours: 8 };
// Evening shift — any employee whose entry is at or after 14:00
const EVENING:  DaySchedule = { entry: "17:30", standardHours: 7.33 };
// Weekend morning shift
const WEEKEND:  DaySchedule = { entry: "17:30", standardHours: 6 };

function getSchedule(date: Date, entrada?: Date): DaySchedule {
  if (entrada) {
    // Detect shift by actual entry hour (UTC)
    const hour = entrada.getUTCHours();
    if (hour >= 14) return EVENING;
  }
  const day = date.getUTCDay(); // 0=Sun, 6=Sat
  return day === 0 || day === 6 ? WEEKEND : MORNING;
}

export function detectOcorrencia(
  entrada: Date | undefined,
  date: Date,
  horasTrabalhadas: number
): string {
  if (!entrada) return "FALTA";

  const sched = getSchedule(date, entrada);
  const [eh, em] = sched.entry.split(":").map(Number);
  const expectedMin = eh * 60 + em;
  const actualMin   = entrada.getUTCHours() * 60 + entrada.getUTCMinutes();

  if (actualMin > expectedMin + TOLERANCE_MINUTES) return "ATRASO";
  if (horasTrabalhadas > 0 && horasTrabalhadas < sched.standardHours - 1) return "SAIDA_ANTECIPADA";
  return "NORMAL";
}

// Sum work blocks from a sorted punch array — handles midnight crossing
export function calcHoursFromPunches(punches: Date[]): number {
  let total = 0;
  for (let i = 0; i + 1 < punches.length; i += 2) {
    let diff = punches[i + 1].getTime() - punches[i].getTime();
    // If exit appears before entry in clock time, the exit is past midnight
    if (diff < 0) diff += 24 * 3_600_000;
    total += diff / 3_600_000;
  }
  return Math.max(0, Math.round(total * 100) / 100);
}
