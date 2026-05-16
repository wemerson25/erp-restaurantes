import { prisma } from "./prisma";
import { sendWhatsAppText } from "./whatsapp";
import { ensureGestorTable } from "./gestor-setup";

let ready = false;

const DEFAULT_EVENTS = [
  { evento: "FOLGA_USADA", ativo: 1, incluiColaborador: 1, gestorIds: "[]" },
  { evento: "ADMISSAO",    ativo: 1, incluiColaborador: 0, gestorIds: "[]" },
  { evento: "DEMISSAO",    ativo: 1, incluiColaborador: 0, gestorIds: "[]" },
];

export async function ensureNotificacaoConfigTable() {
  if (ready) return;
  await ensureGestorTable();
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "NotificacaoConfig" (
      "evento"            TEXT PRIMARY KEY,
      "ativo"             INTEGER NOT NULL DEFAULT 1,
      "incluiColaborador" INTEGER NOT NULL DEFAULT 0,
      "gestorIds"         TEXT NOT NULL DEFAULT '[]'
    )
  `);
  for (const e of DEFAULT_EVENTS) {
    await prisma.$executeRawUnsafe(
      `INSERT OR IGNORE INTO "NotificacaoConfig" (evento,ativo,incluiColaborador,gestorIds) VALUES (?,?,?,?)`,
      e.evento, e.ativo, e.incluiColaborador, e.gestorIds,
    );
  }
  ready = true;
}

export async function getAllEventConfigs() {
  await ensureNotificacaoConfigTable();
  const rows = await prisma.$queryRawUnsafe<{
    evento: string; ativo: number; incluiColaborador: number; gestorIds: string;
  }[]>(`SELECT * FROM "NotificacaoConfig" ORDER BY evento`);
  return rows.map(r => ({
    evento: r.evento,
    ativo: r.ativo === 1,
    incluiColaborador: r.incluiColaborador === 1,
    gestorIds: JSON.parse(r.gestorIds ?? "[]") as string[],
  }));
}

export async function updateEventConfig(
  evento: string,
  patch: { ativo?: boolean; incluiColaborador?: boolean; gestorIds?: string[] },
) {
  await ensureNotificacaoConfigTable();
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (patch.ativo !== undefined)             { sets.push("ativo=?");             vals.push(patch.ativo ? 1 : 0); }
  if (patch.incluiColaborador !== undefined) { sets.push("incluiColaborador=?"); vals.push(patch.incluiColaborador ? 1 : 0); }
  if (patch.gestorIds !== undefined)         { sets.push("gestorIds=?");         vals.push(JSON.stringify(patch.gestorIds)); }
  if (sets.length === 0) return;
  vals.push(evento);
  await prisma.$executeRawUnsafe(
    `UPDATE "NotificacaoConfig" SET ${sets.join(",")} WHERE evento=?`,
    ...vals,
  );
}

// Fire-and-forget: never throws, never blocks the caller
export async function dispararEvento(
  evento: string,
  mensagem: string,
  telefoneColaborador?: string,
): Promise<void> {
  try {
    await ensureNotificacaoConfigTable();
    const rows = await prisma.$queryRawUnsafe<{
      ativo: number; incluiColaborador: number; gestorIds: string;
    }[]>(`SELECT ativo,incluiColaborador,gestorIds FROM "NotificacaoConfig" WHERE evento=?`, evento);

    const cfg = rows[0];
    if (!cfg || cfg.ativo !== 1) return;

    const ids: string[] = JSON.parse(cfg.gestorIds ?? "[]");
    let gestores: { telefone: string }[];

    if (ids.length > 0) {
      const ph = ids.map(() => "?").join(",");
      gestores = await prisma.$queryRawUnsafe<{ telefone: string }[]>(
        `SELECT telefone FROM "Gestor" WHERE ativo=1 AND id IN (${ph})`,
        ...ids,
      );
    } else {
      gestores = await prisma.$queryRawUnsafe<{ telefone: string }[]>(
        `SELECT telefone FROM "Gestor" WHERE ativo=1`,
      );
    }

    const tasks: Promise<unknown>[] = gestores.map(g => sendWhatsAppText(g.telefone, mensagem));
    if (cfg.incluiColaborador && telefoneColaborador) {
      tasks.push(sendWhatsAppText(telefoneColaborador, mensagem));
    }
    await Promise.allSettled(tasks);
  } catch {
    // never propagate — notifications are best-effort
  }
}
