function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  if (digits.length >= 10 && digits.length <= 11) return `55${digits}`;
  return digits;
}

async function evolutionRequest(
  endpoint: string,
  body: unknown,
): Promise<{ ok: boolean; error?: string }> {
  const baseUrl  = (process.env.EVOLUTION_API_URL ?? "").replace(/\/$/, "");
  const apiKey   = process.env.EVOLUTION_API_KEY;
  const instance = process.env.EVOLUTION_INSTANCE;

  if (!baseUrl || !apiKey || !instance) {
    return {
      ok: false,
      error: "Evolution API não configurada (EVOLUTION_API_URL / EVOLUTION_API_KEY / EVOLUTION_INSTANCE ausentes)",
    };
  }

  try {
    const res = await fetch(`${baseUrl}/${endpoint}/${instance}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    let data: Record<string, unknown> = {};
    try { data = JSON.parse(text); } catch { /* not JSON */ }

    if (!res.ok) {
      const msg = (data.message ?? data.error ?? `HTTP ${res.status}: ${text.slice(0, 200)}`) as string;
      return { ok: false, error: Array.isArray(msg) ? (msg as string[]).join(", ") : msg };
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro de rede" };
  }
}

export async function sendWhatsAppText(
  to: string,
  message: string,
): Promise<{ ok: boolean; error?: string }> {
  const number = formatPhone(to);
  if (number.length < 12) return { ok: false, error: `Número inválido: ${to}` };
  return evolutionRequest("message/sendText", {
    number,
    textMessage: { text: message },
  });
}

export async function sendWhatsAppImage(
  to: string,
  imageBuffer: Buffer,
  caption?: string,
): Promise<{ ok: boolean; error?: string }> {
  const number = formatPhone(to);
  if (number.length < 12) return { ok: false, error: `Número inválido: ${to}` };
  return evolutionRequest("message/sendMedia", {
    number,
    mediaMessage: {
      mediatype: "image",
      mimetype:  "image/png",
      caption:   caption ?? "",
      media:     imageBuffer.toString("base64"),
    },
  });
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
