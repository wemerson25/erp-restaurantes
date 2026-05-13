export type AlertaTipo =
  | "SETOR_DESCOBERTO"
  | "FUNCIONARIO_EM_FERIAS"
  | "FUNCIONARIO_AUSENTE"
  | "CONFLITO_HORARIO"
  | "FUNCIONARIO_DEMITIDO";

export interface Alerta {
  tipo: AlertaTipo;
  mensagem: string;
  data?: string;
  setor?: string;
  funcionarioNome?: string;
}

export interface ScheduleEntryLite {
  id: string;
  funcionarioId: string;
  funcionarioNome: string;
  funcionarioStatus: string;
  restauranteId: string;
  data: string; // YYYY-MM-DD
  setor: string;
  turno: string;
}

interface PeriodoFuncionario {
  funcionarioId: string;
  dataInicio: string;
  dataFim: string;
  status: string;
}

interface Requisito {
  setor: string;
  turno: string;
  minimoFuncionarios: number;
}

const WORK_TURNOS = new Set(["ALMOCO", "JANTAR", "INTEGRAL"]);

function inRange(date: string, start: string, end: string) {
  return date >= start.slice(0, 10) && date <= end.slice(0, 10);
}

export function validarEscala(
  schedules: ScheduleEntryLite[],
  ferias: PeriodoFuncionario[],
  ausencias: PeriodoFuncionario[],
  requisitos: Requisito[],
): Alerta[] {
  const alertas: Alerta[] = [];

  for (const s of schedules) {
    if (!WORK_TURNOS.has(s.turno)) continue;

    if (s.funcionarioStatus !== "ATIVO") {
      alertas.push({
        tipo: "FUNCIONARIO_DEMITIDO",
        mensagem: `${s.funcionarioNome} está inativo mas aparece na escala de ${s.data}.`,
        data: s.data,
        funcionarioNome: s.funcionarioNome,
      });
      continue;
    }

    if (ferias.some((f) => f.funcionarioId === s.funcionarioId && inRange(s.data, f.dataInicio, f.dataFim))) {
      alertas.push({
        tipo: "FUNCIONARIO_EM_FERIAS",
        mensagem: `${s.funcionarioNome} está em férias no dia ${s.data}.`,
        data: s.data,
        funcionarioNome: s.funcionarioNome,
      });
    }

    if (ausencias.some((a) => a.funcionarioId === s.funcionarioId && inRange(s.data, a.dataInicio, a.dataFim))) {
      alertas.push({
        tipo: "FUNCIONARIO_AUSENTE",
        mensagem: `${s.funcionarioNome} possui ausência registrada no dia ${s.data}.`,
        data: s.data,
        funcionarioNome: s.funcionarioNome,
      });
    }
  }

  // Conflito: same employee in DIFFERENT sectors on the same day
  const byFuncDate = new Map<string, { entry: ScheduleEntryLite; setores: Set<string> }>();
  for (const s of schedules) {
    if (!WORK_TURNOS.has(s.turno)) continue;
    const key = `${s.funcionarioId}|${s.data}`;
    const existing = byFuncDate.get(key);
    if (!existing) byFuncDate.set(key, { entry: s, setores: new Set([s.setor]) });
    else existing.setores.add(s.setor);
  }
  for (const { entry, setores } of byFuncDate.values()) {
    if (setores.size > 1) {
      alertas.push({
        tipo: "CONFLITO_HORARIO",
        mensagem: `${entry.funcionarioNome} está escalado em múltiplos setores (${[...setores].join(", ")}) no dia ${entry.data}.`,
        data: entry.data,
        funcionarioNome: entry.funcionarioNome,
      });
    }
  }

  // Setor descoberto per requisito
  if (requisitos.length > 0) {
    const counts = new Map<string, number>();
    for (const s of schedules) {
      if (!WORK_TURNOS.has(s.turno)) continue;
      const key = `${s.data}|${s.setor}|${s.turno}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const allDates = [...new Set(schedules.map((s) => s.data))];
    for (const date of allDates) {
      for (const req of requisitos) {
        const count = counts.get(`${date}|${req.setor}|${req.turno}`) ?? 0;
        if (count < req.minimoFuncionarios) {
          alertas.push({
            tipo: "SETOR_DESCOBERTO",
            mensagem: `${req.setor} · ${req.turno} em ${date}: ${count}/${req.minimoFuncionarios} funcionário(s).`,
            data: date,
            setor: req.setor,
          });
        }
      }
    }
  }

  return alertas;
}
