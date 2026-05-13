import { ImageResponse } from "next/og";
import { readFileSync } from "fs";
import { join } from "path";

const DOW = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
const FOLGA_TURNOS = new Set(["FOLGA", "FOLGA_B", "FERIAS", "ATESTADO", "AUSENTE"]);

const DAY_COLOR = ["#3B82F6","#059669","#D97706","#DC2626","#7C3AED","#DB2777","#64748B"];

export interface ScheduleEntryForImage {
  funcionarioNome: string;
  setor: string;
  data: string; // YYYY-MM-DD
  turno: string;
}

interface DayGroup { folga: string[]; almoco: string[]; jantar: string[] }

function fmtShort(iso: string) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function firstName(nome: string) {
  return nome.split(" ")[0];
}

export async function generateEscalaImage(
  schedules: ScheduleEntryForImage[],
  dias: string[],
  semanaLabel: string,
  restauranteNome?: string,
): Promise<Buffer> {
  // ── Group by day ─────────────────────────────────────────────────
  const byDay = new Map<string, DayGroup>();
  for (const d of dias) byDay.set(d, { folga: [], almoco: [], jantar: [] });

  for (const s of schedules) {
    const day = s.data.slice(0, 10);
    const g = byDay.get(day);
    if (!g) continue;
    const name = firstName(s.funcionarioNome);
    if (FOLGA_TURNOS.has(s.turno)) {
      if (!g.folga.includes(name)) g.folga.push(name);
    } else if (s.turno === "ALMOCO") {
      if (!g.almoco.includes(name)) g.almoco.push(name);
    } else if (s.turno === "JANTAR") {
      if (!g.jantar.includes(name)) g.jantar.push(name);
    } else if (s.turno === "INTEGRAL") {
      if (!g.almoco.includes(name)) g.almoco.push(name);
      if (!g.jantar.includes(name)) g.jantar.push(name);
    }
  }

  // ── Layout constants (1080px wide — sharp on any phone) ──────────
  const W        = 1080;
  const PAD      = 36;
  const CARD_W   = W - PAD * 2;
  const COL_W    = Math.floor(CARD_W / 3);
  const HDR_H    = 58;    // colored day header
  const LABEL_H  = 26;    // shift-label row
  const CHIP_H   = 36;    // name chip height
  const CHIP_GAP = 7;     // gap between chips
  const BODY_PAD = 18;    // vertical padding in body
  const CARD_GAP = 12;

  const cardHeights = dias.map(d => {
    const g = byDay.get(d)!;
    const maxN = Math.max(g.almoco.length, g.jantar.length, g.folga.length, 1);
    const bodyH = BODY_PAD + LABEL_H + 6 + maxN * (CHIP_H + CHIP_GAP) - CHIP_GAP + BODY_PAD;
    return HDR_H + bodyH;
  });

  const totalCardsH = cardHeights.reduce((a, b) => a + b, 0) + CARD_GAP * (dias.length - 1);
  const TITLE_H = 94;
  const totalH  = PAD + TITLE_H + 16 + totalCardsH + PAD + 36;

  // ── Font ─────────────────────────────────────────────────────────
  let fontData: ArrayBuffer | undefined;
  try {
    fontData = readFileSync(
      join(process.cwd(), "node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf"),
    ).buffer;
  } catch { /* built-in fallback */ }

  const COLS = [
    { key: "almoco", label: "🍽  Almoço", lColor: "#B45309", chipBg: "#FFF7ED", chipBdr: "#FED7AA", chipTxt: "#92400E" },
    { key: "jantar", label: "🌙  Jantar",  lColor: "#6D28D9", chipBg: "#EDE9FE", chipBdr: "#C4B5FD", chipTxt: "#5B21B6" },
    { key: "folga",  label: "😴  Folga",   lColor: "#6B7280", chipBg: "#F3F4F6", chipBdr: "#D1D5DB", chipTxt: "#6B7280" },
  ] as const;

  const resp = new ImageResponse(
    (
      <div
        style={{
          display: "flex", flexDirection: "column",
          width: W, height: totalH,
          background: "#EEF2F7",
          fontFamily: "Geist, sans-serif",
          padding: PAD,
          gap: 0,
        }}
      >
        {/* ── TITLE BAR ── */}
        <div
          style={{
            display: "flex", alignItems: "center",
            height: TITLE_H,
            background: "white", borderRadius: 16,
            padding: "0 26px", marginBottom: 16,
            border: "1.5px solid #E2E8F0", gap: 18,
          }}
        >
          <div
            style={{
              width: 54, height: 54, background: "#EEF2FF",
              borderRadius: 14, display: "flex",
              alignItems: "center", justifyContent: "center", fontSize: 28,
            }}
          >
            📅
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: 26, fontWeight: 700, color: "#0F172A" }}>
              Escala Semanal — {semanaLabel}
            </span>
            {restauranteNome && (
              <span style={{ fontSize: 15, color: "#64748B" }}>{restauranteNome}</span>
            )}
          </div>
        </div>

        {/* ── DAY CARDS ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: CARD_GAP }}>
          {dias.map((d, di) => {
            const g = byDay.get(d)!;
            const namesByCol: Record<string, string[]> = {
              almoco: g.almoco, jantar: g.jantar, folga: g.folga,
            };
            const maxN = Math.max(g.almoco.length, g.jantar.length, g.folga.length, 1);

            return (
              <div
                key={d}
                style={{
                  display: "flex", flexDirection: "column",
                  background: "white", borderRadius: 14,
                  overflow: "hidden",
                  border: "1.5px solid #E2E8F0",
                  width: CARD_W,
                  height: cardHeights[di],
                }}
              >
                {/* Colored day header */}
                <div
                  style={{
                    display: "flex", alignItems: "center",
                    height: HDR_H,
                    background: DAY_COLOR[di],
                    padding: "0 24px", gap: 12,
                  }}
                >
                  <span style={{ fontSize: 20, fontWeight: 700, color: "white", letterSpacing: 0.4 }}>
                    {DOW[di]}
                  </span>
                  <span style={{ fontSize: 17, color: "rgba(255,255,255,0.78)", fontWeight: 500 }}>
                    {fmtShort(d)}
                  </span>
                </div>

                {/* Body: 3 columns */}
                <div
                  style={{
                    display: "flex",
                    flex: 1,
                    padding: `${BODY_PAD}px 0`,
                  }}
                >
                  {COLS.map((col, ci) => {
                    const names = namesByCol[col.key];
                    return (
                      <div
                        key={col.key}
                        style={{
                          display: "flex", flexDirection: "column",
                          width: COL_W,
                          padding: `0 ${BODY_PAD}px`,
                          borderLeft: ci > 0 ? "1.5px solid #F1F5F9" : "none",
                        }}
                      >
                        {/* Shift label */}
                        <span
                          style={{
                            fontSize: 14, fontWeight: 700,
                            color: col.lColor,
                            height: LABEL_H,
                            marginBottom: 6,
                          }}
                        >
                          {col.label}
                        </span>

                        {/* Name chips */}
                        <div style={{ display: "flex", flexDirection: "column", gap: CHIP_GAP }}>
                          {names.length === 0 ? (
                            <span style={{ fontSize: 14, color: "#CBD5E1", height: CHIP_H, display: "flex", alignItems: "center" }}>
                              —
                            </span>
                          ) : (
                            names.map((name, ni) => (
                              <div
                                key={ni}
                                style={{
                                  display: "flex", alignItems: "center",
                                  height: CHIP_H,
                                  background: col.chipBg,
                                  border: `1.5px solid ${col.chipBdr}`,
                                  borderRadius: 9,
                                  padding: "0 14px",
                                  alignSelf: "flex-start",
                                }}
                              >
                                <span style={{ fontSize: 15, fontWeight: 700, color: col.chipTxt }}>
                                  {name}
                                </span>
                              </div>
                            ))
                          )}
                          {names.length < maxN && names.length > 0 && (
                            <div style={{ display: "flex", height: (maxN - names.length) * (CHIP_H + CHIP_GAP) }} />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── FOOTER ── */}
        <div
          style={{
            display: "flex", justifyContent: "flex-end",
            marginTop: 14, fontSize: 13, color: "#94A3B8",
          }}
        >
          ERP Restaurantes — RH
        </div>
      </div>
    ),
    {
      width: W,
      height: totalH,
      ...(fontData ? { fonts: [{ name: "Geist", data: fontData, weight: 400 }] } : {}),
    },
  );

  return Buffer.from(await resp.arrayBuffer());
}
