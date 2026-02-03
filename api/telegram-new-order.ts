import type { VercelRequest, VercelResponse } from "@vercel/node";

type OrderRow = {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  currency: string | null;
  total_eur_cents: number | null;
  status: string | null;
  items: any; // jsonb
};

function env(name: string) {
  const v = process.env[name];
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

function buildTelegramText(order: OrderRow) {
  const name = safeStr(order.customer_name) || "—";
  const phone = safeStr(order.customer_phone) || "—";
  const address = safeStr(order.customer_address) || "—";
  const status = safeStr(order.status) || "—";
  const totalCents = safeInt(order.total_eur_cents, 0);

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

  // preskačemo meta na [0]
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

async function fetchOrderById(orderId: string): Promise<OrderRow | null> {
  const SUPABASE_URL = env("SUPABASE_URL");
  const SERVICE_ROLE = env("SUPABASE_SERVICE_ROLE_KEY");

  const url =
    `${SUPABASE_URL}/rest/v1/orders` +
    `?select=id,customer_name,customer_phone,customer_address,currency,total_eur_cents,status,items` +
    `&id=eq.${encodeURIComponent(orderId)}` +
    `&limit=1`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Supabase fetch order failed: ${res.status} ${txt}`);
  }

  const data = (await res.json()) as OrderRow[];
  return data?.[0] ?? null;
}

async function sendTelegram(text: string) {
  const token = env("TELEGRAM_BOT_TOKEN");
  const chatId = env("TELEGRAM_CHAT_ID");

  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "Markdown",
      disable_web_page_preview: true,
    }),
  });

  const json = await res.json().catch(() => null);

  if (!res.ok || !json?.ok) {
    throw new Error(`Telegram send failed: ${res.status} ${JSON.stringify(json)}`);
  }

  return json;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") {
      res.status(405).json({ ok: false, error: "Method not allowed" });
      return;
    }

    const body = req.body ?? {};
    const orderId = safeStr((body as any).order_id).trim();

    if (!orderId) {
      res.status(400).json({ ok: false, error: "Missing order_id" });
      return;
    }

    const order = await fetchOrderById(orderId);
    if (!order) {
      res.status(404).json({ ok: false, error: "Order not found" });
      return;
    }

    const text = buildTelegramText(order);
    const sent = await sendTelegram(text);

    res.status(200).json({ ok: true, telegram: sent?.result ? true : true });
  } catch (e: any) {
    const msg = e instanceof Error ? e.message : String(e);
    res.status(500).json({ ok: false, error: msg });
  }
}
