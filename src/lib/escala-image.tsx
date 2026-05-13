import { ImageResponse } from "next/og";
import { readFileSync } from "fs";
import { join } from "path";

const DOW = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
const FOLGA_TURNOS = new Set(["FOLGA", "FOLGA_B", "FERIAS", "ATESTADO", "AUSENTE"]);

export interface ScheduleEntryForImage {
  funcionarioNome: string;
  setor: string;
  data: string; // YYYY-MM-DD
  turno: string;
}

interface DayGroup {
  folga: string[];
  almoco: string[];
  jantar: string[];
}

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
  // ── Group schedules by day → folga / almoço / jantar ─────────────
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

  // ── Dimensions ───────────────────────────────────────────────────
  const W = 700;
  const PAD = 24;
  const TITLE_H = 64;
  const DIA_W = 106;
  const COL_W = Math.floor((W - PAD * 2 - DIA_W) / 3);
  const CELL_PAD = 8;
  const NAME_H = 22;
  const HEADER_H = 44;

  const rowHeights = dias.map(d => {
    const g = byDay.get(d)!;
    const maxNames = Math.max(g.folga.length, g.almoco.length, g.jantar.length, 1);
    return maxNames * NAME_H + CELL_PAD * 2;
  });
  const tableH = HEADER_H + rowHeights.reduce((a, b) => a + b, 0);
  const totalH = PAD + TITLE_H + 12 + tableH + PAD + 24;

  // ── Font ─────────────────────────────────────────────────────────
  let fontData: ArrayBuffer | undefined;
  try {
    fontData = readFileSync(
      join(process.cwd(), "node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf"),
    ).buffer;
  } catch { /* use built-in fallback */ }

  const cols = [
    { label: "Folga",  emoji: "😴", headerBg: "#F3F4F6", nameBg: "#F9FAFB", nameColor: "#6B7280" },
    { label: "Almoço", emoji: "🍽️", headerBg: "#DBEAFE", nameBg: "#EFF6FF", nameColor: "#1D4ED8" },
    { label: "Jantar", emoji: "🌙", headerBg: "#EDE9FE", nameBg: "#F5F3FF", nameColor: "#7C3AED" },
  ];

  const response = new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: W,
          height: totalH,
          background: "#F8FAFC",
          fontFamily: "Geist, sans-serif",
          padding: PAD,
        }}
      >
        {/* Title bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            background: "white",
            borderRadius: 10,
            padding: "12px 18px",
            marginBottom: 12,
            border: "1.5px solid #E5E7EB",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              background: "#EEF2FF",
              borderRadius: 9,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
            }}
          >
            📅
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <span style={{ fontSize: 17, fontWeight: 700, color: "#111827" }}>
              Escala Semanal — {semanaLabel}
            </span>
            {restauranteNome && (
              <span style={{ fontSize: 12, color: "#6B7280" }}>{restauranteNome}</span>
            )}
          </div>
        </div>

        {/* Table */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            background: "white",
            borderRadius: 10,
            border: "1.5px solid #E5E7EB",
            overflow: "hidden",
          }}
        >
          {/* Header row */}
          <div
            style={{
              display: "flex",
              borderBottom: "2px solid #E2E8F0",
            }}
          >
            <div
              style={{
                width: DIA_W,
                padding: "10px 14px",
                fontSize: 11,
                fontWeight: 700,
                color: "#94A3B8",
                textTransform: "uppercase",
                letterSpacing: 1,
                background: "#F8FAFC",
              }}
            >
              DIA
            </div>
            {cols.map((c, i) => (
              <div
                key={i}
                style={{
                  width: COL_W,
                  padding: "10px 0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 5,
                  borderLeft: "1.5px solid #E2E8F0",
                  background: c.headerBg,
                }}
              >
                <span style={{ fontSize: 15 }}>{c.emoji}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: c.nameColor }}>{c.label}</span>
              </div>
            ))}
          </div>

          {/* Day rows */}
          {dias.map((d, di) => {
            const g = byDay.get(d)!;
            const nameCols = [g.folga, g.almoco, g.jantar];
            return (
              <div
                key={d}
                style={{
                  display: "flex",
                  borderBottom: di < dias.length - 1 ? "1px solid #F1F5F9" : "none",
                  minHeight: rowHeights[di],
                }}
              >
                {/* Day label */}
                <div
                  style={{
                    width: DIA_W,
                    padding: "10px 14px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    background: "#FAFAFA",
                    borderRight: "1px solid #F1F5F9",
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>{DOW[di]}</span>
                  <span style={{ fontSize: 11, color: "#94A3B8", marginTop: 2 }}>{fmtShort(d)}</span>
                </div>

                {/* Shift cells */}
                {nameCols.map((names, ci) => (
                  <div
                    key={ci}
                    style={{
                      width: COL_W,
                      padding: `${CELL_PAD}px 12px`,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                      gap: 2,
                      borderLeft: "1px solid #F1F5F9",
                      background: names.length > 0 ? cols[ci].nameBg : "transparent",
                    }}
                  >
                    {names.length === 0 ? (
                      <span style={{ color: "#D1D5DB", fontSize: 12 }}>—</span>
                    ) : (
                      names.map((n, ni) => (
                        <span
                          key={ni}
                          style={{ fontSize: 13, fontWeight: 600, color: cols[ci].nameColor, lineHeight: 1.5 }}
                        >
                          {n}
                        </span>
                      ))
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginTop: 8,
            fontSize: 10,
            color: "#9CA3AF",
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

  return Buffer.from(await response.arrayBuffer());
}
