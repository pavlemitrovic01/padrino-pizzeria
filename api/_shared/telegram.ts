/**
 * The kitchen's Telegram message for an order — format, claim and send (B24).
 *
 * Before B24 the format lived twice (api/telegram-new-order.ts and the admin
 * resend in api/admin-orders.ts) and every notification was a self-HTTP call
 * from create-order / bankart-callback / bankart-order-status to the
 * telegram-new-order endpoint, guarded by a shared secret and awaited for up
 * to 12 s — long enough for a client timeout + retry to create a duplicate
 * order. Now each handler calls notifyNewOrder() directly with its own
 * service-role client; the endpoint and its secret are gone.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { isPlainObject, normalizeText, safeInt } from "./parsing.js";
import { getEnv } from "./env.js";

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

export type OrderRow = {
  id?: unknown;
  customer_name?: unknown;
  customer_phone?: unknown;
  customer_address?: unknown;
  status?: unknown;
  total_eur_cents?: unknown;
  total_price?: unknown;
  items?: unknown;
  note?: unknown;
};

const TELEGRAM_FETCH_TIMEOUT_MS = 7000;

function toTrimmedString(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (v == null) return "";
  try {
    return String(v).trim();
  } catch {
    return "";
  }
}


function formatTotalFromCents(cents: number) {
  const n = Number.isFinite(cents) ? Math.trunc(cents) : 0;
  return (n / 100).toFixed(2);
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

function isMetaRow(it: unknown) {
  if (!isPlainObject(it)) return false;

  const cartId = normalizeText(toTrimmedString(it.cart_id));
  const name = normalizeText(toTrimmedString(it.name));
  const cat = normalizeText(toTrimmedString(it.category));

  return cartId === "meta" || name === "meta" || cat === "meta";
}

function isDrinkRow(it: unknown) {
  if (!isPlainObject(it)) return false;
  const c = normalizeText(toTrimmedString(it.category));
  return c.includes("pica") || c.includes("pice") || c.includes("napici") || c.includes("napitci");
}

function addonEmoji(name: string) {
  const n = normalizeText(name);

  if (n.includes("sos") || n.includes("kecap") || n.includes("kečap") || n.includes("majonez")) return "🧄";
  if (n.includes("sir") || n.includes("mozz") || n.includes("kačk") || n.includes("kack")) return "🧀";
  if (n.includes("krof") || n.includes("donut")) return "🍩";
  if (n.includes("pecur") || n.includes("šamp") || n.includes("samp")) return "🍄";
  if (n.includes("masl") || n.includes("olive")) return "🫒";
  if (n.includes("sunka") || n.includes("prsut") || n.includes("slanina")) return "🥓";

  return "➕";
}

type ParsedMeta = {
  zone: string;
  delivery: string;
  payment: string;
  extraNote: string;
};

function splitNoteLines(note: string): string[] {
  return String(note ?? "")
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseMetaFromNote(note: string): ParsedMeta {
  const lines = splitNoteLines(note);
  let zone = "";
  let delivery = "";
  let payment = "";

  const extra: string[] = [];

  for (const line of lines) {
    const norm = normalizeText(line);
    let usedAsMeta = false;

    if (norm.includes("zona:") || norm.includes("dostava:") || norm.includes("placanje:")) {
      if (!zone && norm.includes("zona:")) {
        const mZone = line.match(/Zona\s*:\s*([^,]+)\s*,?/i);
        if (mZone && typeof mZone[1] === "string") {
          zone = mZone[1].trim();
          usedAsMeta = true;
        }
      }

      if (!delivery && norm.includes("dostava:")) {
        const mFeeNum = line.match(/Dostava\s*:\s*([0-9]+(?:[.,][0-9]+)?)\s*€?/i);
        if (mFeeNum && typeof mFeeNum[1] === "string") {
          delivery = `${mFeeNum[1].trim()} €`;
          usedAsMeta = true;
        } else {
          const mFeeAny = line.match(/Dostava\s*:\s*([^,]+)$/i);
          if (mFeeAny && typeof mFeeAny[1] === "string") {
            delivery = mFeeAny[1].trim();
            usedAsMeta = true;
          }
        }
      }

      if (!payment && norm.includes("placanje:")) {
        const mPay = line.match(/Pla[cć]anje\s*:\s*(.+)$/i);
        if (mPay && typeof mPay[1] === "string") {
          payment = mPay[1].trim();
          usedAsMeta = true;
        }
      }
    }

    if (!usedAsMeta) extra.push(line);
  }

  return { zone, delivery, payment, extraNote: extra.join("\n").trim() };
}

function paymentIcon(payment: string): string {
  const p = normalizeText(payment);
  if (p.includes("kart")) return "💳";
  if (p.includes("gotov") || p.includes("kes") || p.includes("cash")) return "💵";
  return "💳";
}

function extractOrderNote(order: OrderRow, items: CartItem[]) {
  const direct = toTrimmedString(order?.note);
  if (direct) return direct;

  const meta = items.find((it) => isMetaRow(it));
  return meta ? toTrimmedString(meta.note) : "";
}

export function formatOrderForTelegram(order: OrderRow) {
  const id = toTrimmedString(order?.id);
  const name = toTrimmedString(order?.customer_name) || "-";
  const phone = toTrimmedString(order?.customer_phone) || "-";
  const address = toTrimmedString(order?.customer_address) || "-";
  const status = toTrimmedString(order?.status) || "pending";

  const itemsAll = parseItems(order?.items);
  const noteRaw = extractOrderNote(order, itemsAll);
  const meta = parseMetaFromNote(noteRaw);

  const realItems = itemsAll.filter((it) => isPlainObject(it) && toTrimmedString(it.cart_id) && !isMetaRow(it));
  const pizzas = realItems.filter((it) => !isDrinkRow(it));
  const drinks = realItems.filter((it) => isDrinkRow(it));

  const totalCents =
    Math.max(0, safeInt(order?.total_eur_cents, 0)) ||
    Math.max(0, Math.round((Number(order?.total_price) || 0) * 100));

  const total = formatTotalFromCents(totalCents);

  const lines: string[] = [];

  lines.push("📪📬📭 Nova porudžbina:");
  if (id) lines.push(`🆔 ID: ${id}`);
  lines.push(`🙅‍♂️ Ime: ${name}`);
  lines.push(`☎️ Telefon: ${phone}`);
  lines.push(`🏠 Adresa: ${address}`);
  lines.push(`🕒 Status: ${status}`);

  if (meta.zone) lines.push(`📍 Zona: ${meta.zone}`);
  if (meta.delivery) lines.push(`🚚 Dostava: ${meta.delivery}`);
  if (meta.payment) lines.push(`${paymentIcon(meta.payment)} Plaćanje: ${meta.payment}`);

  lines.push("");
  lines.push("🔊🔊 LISTA PROIZVODA:");

  for (const it of pizzas) {
    const nm = toTrimmedString(it?.name) || "Proizvod";
    const qty = Math.max(1, safeInt(it?.quantity, 1));
    const sizeRaw = toTrimmedString(it?.size);
    const size = sizeRaw ? ` (${sizeRaw})` : "";

    lines.push(`🍕 ● ${qty}x ${nm}${size}`);

    const addonsRaw = it?.addons;
    const addons: CartAddon[] = Array.isArray(addonsRaw) ? (addonsRaw as CartAddon[]) : [];

    if (addons.length > 0) {
      lines.push("🍄● Dodaci:");
      for (const a of addons) {
        const an = toTrimmedString(a?.name);
        if (!an) continue;
        const aq = Math.max(1, safeInt(a?.quantity, 1));
        lines.push(` ${addonEmoji(an)}● ${aq}x ${an}`);
      }
    }

    const itemNote = toTrimmedString(it?.note);
    if (itemNote) lines.push(`🚨 ● NAPOMENA: ${itemNote}`);

    lines.push("");
  }

  if (drinks.length > 0) {
    lines.push("🥤● Piće:");
    for (const it of drinks) {
      const nm = toTrimmedString(it?.name) || "Piće";
      const qty = Math.max(1, safeInt(it?.quantity, 1));
      lines.push(`  - ${qty}x ${nm}`);
    }
    lines.push("");
  }

  if (meta.extraNote) {
    lines.push(`🚨 ● NAPOMENA: ${meta.extraNote}`);
    lines.push("");
  }

  lines.push(`💸 ● Ukupno: ${total} €`);
  return lines.join("\n").trim();
}

async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function sendTelegramMessage(text: string): Promise<{ ok: boolean; error?: string }> {
  const token = getEnv("TELEGRAM_BOT_TOKEN");
  const chatId = getEnv("TELEGRAM_CHAT_ID");

  if (!token || !chatId) {
    return { ok: false, error: "Missing TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID" };
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  try {
    const r = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          disable_web_page_preview: true,
        }),
      },
      TELEGRAM_FETCH_TIMEOUT_MS,
    );

    if (!r.ok) return { ok: false, error: `Telegram HTTP ${r.status}` };
    return { ok: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const m = msg.trim() ? msg.trim() : "Telegram request failed";
    const isAbort = m.toLowerCase().includes("abort");
    return { ok: false, error: isAbort ? `Telegram timeout (${TELEGRAM_FETCH_TIMEOUT_MS}ms)` : m };
  }
}

export type NotifyResult = "sent" | "already_sent" | "failed";

/**
 * Sends the kitchen message for an order exactly once.
 *
 * Card orders can reach this from up to 3 places for the same order
 * (create-order FINISHED, bankart-callback, bankart-order-status poll), so the
 * send is claimed first with a conditional UPDATE on telegram_notified_at
 * (B18): only the caller that flips it NULL → now() sends. A claim error fails
 * open (send anyway — never "the restaurant gets no order"); a failed send
 * releases the claim so a later caller or the admin resend can deliver.
 *
 * Never throws: a notification problem must not fail the order or the payment.
 */
export async function notifyNewOrder(supabase: SupabaseClient, orderId: string): Promise<NotifyResult> {
  try {
    // The claim returns the row, so a send costs one round trip and a caller
    // that loses the claim reads nothing.
    const { data: claimed, error: claimErr } = await supabase
      .from("orders")
      .update({ telegram_notified_at: new Date().toISOString() })
      .eq("id", orderId)
      .is("telegram_notified_at", null)
      .select("*");

    let order: unknown;
    let claimedOwnership = false;
    if (claimErr) {
      console.error("[telegram] claim failed, sending anyway", { orderId, error: claimErr.message });
      const { data, error: readErr } = await supabase.from("orders").select("*").eq("id", orderId).single();
      if (readErr || !data) {
        console.error("[telegram] order read failed", { orderId, error: readErr?.message ?? "not found" });
        return "failed";
      }
      order = data;
    } else if (!Array.isArray(claimed) || claimed.length === 0) {
      return "already_sent"; // sent earlier — or no such order: nothing to send either way
    } else {
      order = claimed[0];
      claimedOwnership = true;
    }

    const sent = await sendTelegramMessage(formatOrderForTelegram(order as OrderRow));
    if (sent.ok) return "sent";

    console.error("[telegram] send failed", { orderId, error: sent.error ?? "Telegram failed" });
    if (claimedOwnership) {
      const { error: resetErr } = await supabase
        .from("orders")
        .update({ telegram_notified_at: null })
        .eq("id", orderId);
      if (resetErr) console.error("[telegram] claim release failed", { orderId, error: resetErr.message });
    }
    return "failed";
  } catch (err: unknown) {
    console.error("[telegram] notify threw", { orderId, error: err instanceof Error ? err.message : String(err) });
    return "failed";
  }
}
