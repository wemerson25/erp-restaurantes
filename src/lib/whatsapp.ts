function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  let number: string;
  if (digits.startsWith("55") && digits.length >= 12) number = digits;
  else if (digits.length >= 10 && digits.length <= 11) number = `55${digits}`;
  else number = digits;
  // Evolution API v2 requires the WhatsApp JID format
  return number.includes("@") ? number : `${number}@s.whatsapp.net`;
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
      const raw = data.message ?? data.error ?? `HTTP ${res.status}: ${text.slice(0, 400)}`;
      const msg = Array.isArray(raw) ? (raw as string[]).join(", ") : String(raw);
      return { ok: false, error: msg };
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
  return evolutionRequest("message/sendText", {
    number,
    text: message,
  });
}

export async function sendWhatsAppImage(
  to: string,
  imageBuffer: Buffer,
  caption?: string,
): Promise<{ ok: boolean; error?: string }> {
  const number = formatPhone(to);
  return evolutionRequest("message/sendMedia", {
    number,
    mediatype: "image",
    mimetype:  "image/png",
    caption:   caption ?? "",
    media:     imageBuffer.toString("base64"),
  });
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
