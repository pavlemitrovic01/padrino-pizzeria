type OrderRow = {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  currency: string | null;

  total_eur_cents: number | null;
  total_price?: number | null;

  status: string | null;
  items: any; // jsonb
};

type TelegramStatus = "sent" | "failed";

function env(name: string): string {
  let v = process.env[name];

  // fallback samo za Supabase
  if (!v && name === "SUPABASE_URL") v = process.env["VITE_SUPABASE_URL"];
  if (!v && name === "SUPABASE_SERVICE_ROLE_KEY") v = process.env["VITE_SUPABASE_ANON_KEY"];

  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function safeStr(v: unknown) {
  return typeof v === "string" ? v : "";
}

function safeInt(v: unknown, fallback = 0) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function formatMoneyEURFromCents(cents: number) {
  const value = (cents / 100).toFixed(2);
  return `${value} €`;
}

function extractOrderId(body: any): string {
  const direct = safeStr(body?.order_id).trim();
  if (direct) return direct;

  const recordId = safeStr(body?.record?.id).trim();
  if (recordId) return recordId;

  const newRecordId = safeStr(body?.new_record?.id).trim();
  if (newRecordId) return newRecordId;

  const id = safeStr(body?.id).trim();
  if (id) return id;

  return "";
}

function computeTotalCents(order: OrderRow): number {
  const eurCents = safeInt(order.total_eur_cents, 0);
  if (eurCents > 0) return eurCents;

  const legacy = safeInt((order as any).total_price, 0);
  if (legacy > 0) return legacy;

  return 0;
}

function buildTelegramText(order: OrderRow) {
  const name = safeStr(order.customer_name) || "—";
  const phone = safeStr(order.customer_phone) || "—";
  const address = safeStr(order.customer_address) || "—";
  const status = safeStr(order.status) || "—";
  const totalCents = computeTotalCents(order);

  const items = Array.isArray(order.items) ? order.items : [];
  const meta = items.length > 0 && typeof items[0] === "object" ? items[0] : null;

  const orderNote =
    meta && typeof meta.order_note === "string" && meta.order_note.trim().length
      ? meta.order_note.trim()
      : null;

  const lines: string[] = [];
  lines.push("🍕 *Nova porudžbina*");
  lines.push(`🧾 ID: \`${order.id}\``);
  lines.push(`👤 ${name}`);
  lines.push(`📞 ${phone}`);
  lines.push(`📍 ${address}`);
  if (orderNote) lines.push(`📝 Napomena: ${orderNote}`);
  lines.push(`📌 Status: ${status}`);
  lines.push("");
  lines.push("*Stavke:*");

  const realItems = items.slice(meta ? 1 : 0);

  for (const it of realItems) {
    const qty = Math.max(1, safeInt(it?.quantity, 1));
    const itemName = safeStr(it?.name) || "Stavka";
    const size = safeStr(it?.size);
    const pricePerItem = safeInt(it?.price_per_item, 0);

    let line = `• x${qty} ${itemName}`;
    if (size) line += ` (${size})`;
    if (pricePerItem > 0) line += ` — ${formatMoneyEURFromCents(pricePerItem * qty)}`;
    lines.push(line);

    const addons = Array.isArray(it?.addons) ? it.addons : [];
    for (const a of addons) {
      const aq = Math.max(1, safeInt(a?.quantity, 1));
      const an = safeStr(a?.name) || "Dodatak";
      const ap = safeInt(a?.price, 0);
      let al = `   ◦ + x${aq} ${an}`;
      if (ap > 0) al += ` — ${formatMoneyEURFromCents(ap * aq)}`;
      lines.push(al);
    }

    const note = safeStr(it?.note).trim();
    if (note) lines.push(`   ◦ 📝 ${note}`);
  }

  lines.push("");
  lines.push(`💶 Ukupno: *${formatMoneyEURFromCents(totalCents)}*`);

  return lines.join("\n");
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

async function fetchOrderById(orderId: string): Promise<OrderRow | null> {
  const SUPABASE_URL = env("SUPABASE_URL");
  const SERVICE_ROLE = env("SUPABASE_SERVICE_ROLE_KEY");

  const url =
    `${SUPABASE_URL}/rest/v1/orders` +
    `?select=id,customer_name,customer_phone,customer_address,currency,total_eur_cents,total_price,status,items` +
    `&id=eq.${encodeURIComponent(orderId)}` +
    `&limit=1`;

  const res = await fetchWithTimeout(
    url,
    {
      method: "GET",
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
        "Content-Type": "application/json",
      },
    },
    5000
  );

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Supabase fetch order failed: ${res.status} ${txt}`);
  }

  const data = (await res.json()) as OrderRow[];
  return data?.[0] ?? null;
}

function assertGroupChatId(chatId: string) {
  if (!chatId.startsWith("-")) {
    throw new Error("Misconfigured TELEGRAM_CHAT_ID: must be a group/supergroup id (negative)");
  }
}

async function sendTelegramBestEffort(orderId: string, text: string): Promise<TelegramStatus> {
  try {
    const token = env("TELEGRAM_BOT_TOKEN");
    const chatId = env("TELEGRAM_CHAT_ID");
    assertGroupChatId(chatId);

    const url = `https://api.telegram.org/bot${token}/sendMessage`;

    const res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "Markdown",
          disable_web_page_preview: true,
        }),
      },
      5000
    );

    const json = await res.json().catch(() => null);

    if (!res.ok || !json?.ok) {
      console.error("[telegram] FAILED", { orderId, status: res.status, body: json });
      return "failed";
    }

    console.log("[telegram] SENT", { orderId });
    return "sent";
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[telegram] FAILED", { orderId, error: msg });
    return "failed";
  }
}

/**
 * CORS (minimalno, bez rizika):
 * - Dozvoljavamo samo localhost dev origin-e da mogu da gađaju PROD endpoint iz browsera.
 * - U produkciji normalno radi same-origin, ali ovo ne smeta.
 */
function applyCors(req: any, res: any) {
  const origin = typeof req?.headers?.origin === "string" ? req.headers.origin : "";

  const allowed = new Set<string>([
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ]);

  if (allowed.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  // (ne šaljemo cookies, pa credentials ne treba)
}

export default async function handler(req: any, res: any) {
  try {
    applyCors(req, res);

    // Preflight
    if (req?.method === "OPTIONS") {
      res.status(204).end();
      return;
    }

    if (req?.method !== "POST") {
      res.status(405).json({ ok: false, error: "Method not allowed" });
      return;
    }

    const body = req?.body && typeof req.body === "object" ? req.body : {};
    const orderId = extractOrderId(body);

    if (!orderId) {
      res.status(400).json({
        ok: false,
        error:
          "Missing order id in body. Expected: { order_id } or { record: { id } } or { new_record: { id } } or { id }",
      });
      return;
    }

    const order = await fetchOrderById(orderId);
    if (!order) {
      res.status(404).json({ ok: false, error: "Order not found" });
      return;
    }

    const text = buildTelegramText(order);

    // Best-effort: nikad SPOF
    const telegram = await sendTelegramBestEffort(orderId, text);

    res.status(200).json({ ok: true, telegram });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ ok: false, error: msg });
  }
}
