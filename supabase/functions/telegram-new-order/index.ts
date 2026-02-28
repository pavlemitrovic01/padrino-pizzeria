import type {} from "../deno.d.ts";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

type InsertOrderPayload = {
  id?: string;
  created_at?: string;
  status?: string | null;

  customer_name?: string;
  customer_phone?: string;
  customer_address?: string;

  // legacy
  total_price?: number;

  // EUR
  currency?: string | null;
  total_eur_cents?: number | null;
  fx_rsd_per_eur?: number | null;

  items?: unknown;
  note?: string | null;
};

type WebhookBody =
  | {
      type?: string;
      table?: string;
      schema?: string;
      record?: InsertOrderPayload;
      old_record?: unknown;
    }
  | InsertOrderPayload;

type CartAddon = {
  name?: unknown;
  quantity?: unknown;
};

type CartItem = {
  cart_id?: unknown;
  name?: unknown;
  category?: unknown;
  quantity?: unknown;
  size?: unknown;
  addons?: unknown;
  note?: unknown;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function safeString(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (v == null) return "";
  try {
    return String(v).trim();
  } catch {
    return "";
  }
}

function safeNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}

function normalizeText(value: string) {
  return String(value ?? "")
    .toLowerCase()
    .replaceAll("č", "c")
    .replaceAll("ć", "c")
    .replaceAll("š", "s")
    .replaceAll("ž", "z")
    .replaceAll("đ", "dj")
    .replace(/\s+/g, " ")
    .trim();
}

function isDrinkCategory(category: string) {
  const c = normalizeText(category);
  return c.includes("pica") || c.includes("pice") || c.includes("napici") || c.includes("napitci");
}

function isMetaRow(it: unknown) {
  if (!isRecord(it)) return false;

  const cartId = normalizeText(safeString(it["cart_id"]));
  const name = normalizeText(safeString(it["name"]));
  const cat = normalizeText(safeString(it["category"]));

  return cartId === "meta" || name === "meta" || cat === "meta";
}

function addonEmoji(name: string) {
  const n = normalizeText(name);

  if (n.includes("sos") || n.includes("kecap") || n.includes("kečap") || n.includes("majonez")) return "🧄";
  if (n.includes("sir") || n.includes("mozz") || n.includes("kack") || n.includes("kačk")) return "🧀";
  if (n.includes("krof") || n.includes("donut")) return "🍩";
  if (n.includes("pecur") || n.includes("samp") || n.includes("šamp")) return "🍄";
  if (n.includes("sunka") || n.includes("prsut") || n.includes("slanina")) return "🥓";

  return "➕";
}

function formatTotalEURFromCents(cents: number) {
  const safe = Number.isFinite(cents) ? Math.trunc(cents) : 0;
  return (safe / 100).toFixed(2);
}

function parseItems(raw: unknown): CartItem[] {
  if (Array.isArray(raw)) return raw as CartItem[];

  if (typeof raw === "string") {
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as CartItem[]) : [];
    } catch {
      return [];
    }
  }

  return [];
}

function extractOrderNote(order: InsertOrderPayload, items: CartItem[]) {
  // 1) prefer order.note ako postoji
  const direct = safeString(order?.note);
  if (direct) return direct;

  // 2) meta stavka (createOrder ubaci META sa note)
  const meta = items.find((it) => isMetaRow(it));
  const metaNote = meta ? safeString(meta.note) : "";
  return metaNote;
}

function formatTelegramMessage(order: InsertOrderPayload) {
  const name = safeString(order.customer_name) || "-";
  const phone = safeString(order.customer_phone) || "-";
  const address = safeString(order.customer_address) || "-";
  const status = safeString(order.status) || "pending";

  const itemsAll = parseItems(order.items);
  const orderNote = extractOrderNote(order, itemsAll);

  // pravi items bez META
  const items = itemsAll.filter((it) => {
    const cartId = safeString(it?.cart_id);
    return Boolean(cartId) && !isMetaRow(it);
  });

  const pizzas = items.filter((it) => !isDrinkCategory(safeString(it?.category)));
  const drinks = items.filter((it) => isDrinkCategory(safeString(it?.category)));

  const lines: string[] = [];

  lines.push("📪📬📭 Nova porudžbina:");
  lines.push(`🙅‍♂️ Ime: ${name}`);
  lines.push(`☎️ Telefon: ${phone}`);
  lines.push(`🏠 Adresa: ${address}`);
  lines.push(`🕒 Status: ${status}`);
  lines.push("");
  lines.push("🔊🔊 LISTA PROIZVODA:");

  // Pizze + dodaci + napomene
  for (const it of pizzas) {
    const nm = safeString(it?.name) || "Proizvod";
    const qty = Math.max(1, Math.trunc(safeNumber(it?.quantity) ?? 1));
    const size = safeString(it?.size);
    const sizeSuffix = size ? ` (${size})` : "";

    lines.push(`🍕 ● ${qty}x ${nm}${sizeSuffix}`);

    const addonsRaw = it?.addons;
    const addons: CartAddon[] = Array.isArray(addonsRaw) ? (addonsRaw as CartAddon[]) : [];

    if (addons.length > 0) {
      lines.push("🍄● Dodaci:");
      for (const a of addons) {
        const an = safeString(a?.name);
        if (!an) continue;
        const aq = Math.max(1, Math.trunc(safeNumber(a?.quantity) ?? 1));
        lines.push(` ${addonEmoji(an)}● ${aq}x ${an}`);
      }
    }

    const itemNote = safeString(it?.note);
    if (itemNote) {
      lines.push(`🚨 ● NAPOMENA: ${itemNote}`);
    }

    lines.push("");
  }

  // Pića
  if (drinks.length > 0) {
    lines.push("🥤● Piće:");
    for (const it of drinks) {
      const nm = safeString(it?.name) || "Piće";
      const qty = Math.max(1, Math.trunc(safeNumber(it?.quantity) ?? 1));
      lines.push(`  - ${qty}x ${nm}`);
    }
    lines.push("");
  }

  // Napomena za porudžbinu
  if (orderNote) {
    lines.push(`🚨 ● NAPOMENA: ${orderNote}`);
    lines.push("");
  }

  const totalCents = Math.max(0, Math.trunc(safeNumber(order.total_eur_cents) ?? 0));
  lines.push(`💸 ● Ukupno: ${formatTotalEURFromCents(totalCents)} €`);

  return lines.join("\n").trim();
}

async function sendTelegramMessage(text: string) {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
  const chatId = Deno.env.get("TELEGRAM_CHAT_ID") ?? "";

  if (!token || !chatId) {
    return { ok: false, error: "Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID" };
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        // plain text -> emoji + format stabilno
        disable_web_page_preview: true,
      }),
    });

    const json: unknown = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, json };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

function extractOrderFromWebhookBody(payload: WebhookBody): InsertOrderPayload | null {
  // Supabase webhook body: { record: {...} } ili direktno record
  if (!isRecord(payload)) return null;

  const maybeRecord = payload["record"];
  if (isRecord(maybeRecord)) {
    return maybeRecord as InsertOrderPayload;
  }

  return payload as InsertOrderPayload;
}

serve(async (req) => {
  try {
    // optional secret guard
    const expected = safeString(Deno.env.get("TELEGRAM_WEBHOOK_SECRET"));
    if (expected) {
      const got = safeString(req.headers.get("x-telegram-secret"));
      if (!got || got !== expected) {
        return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
          status: 401,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      }
    }

    const payload: WebhookBody = (await req.json().catch(() => ({}))) as WebhookBody;
    const order = extractOrderFromWebhookBody(payload);

    if (!order || !order.id) {
      return new Response(JSON.stringify({ ok: false, error: "Missing order in payload" }), {
        status: 400,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }

    const message = formatTelegramMessage(order);
    const result = await sendTelegramMessage(message);

    return new Response(JSON.stringify({ ok: true, telegram: result }), {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
});