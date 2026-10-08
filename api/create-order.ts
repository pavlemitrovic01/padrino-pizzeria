import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { resolvePublicBaseUrl } from "./_shared/public-url.js";
import { isPlainObject, safeInt } from "./_shared/parsing.js";
import { isWithinBusinessHours, nowMinutesInPodgorica } from "./_shared/business-hours.js";
import {
  deliveryFeeCents,
  findDeliveryZone,
  findDeliveryZoneByLabel,
  formatDeliveryFee,
  type DeliveryZone,
} from "./_shared/delivery-zones.js";
import { applyCors } from "./_shared/cors.js";
import { notifyNewOrder } from "./_shared/telegram.js";
import {
  BANKART_FALLBACK_EMAIL,
  BANKART_FALLBACK_CITY,
  BANKART_FALLBACK_POSTCODE,
} from "./_shared/config.js";
import { buildSupabaseAdmin, getEnv } from "./_shared/env.js";
import { json } from "./_shared/http.js";
import { isMetaRow, isPriceableItemRow, zoneLabelFromNote, withServerMetaRow, fetchMenuRows, findCrustSizeMismatch, sumAddonsCents, findMissingMenuItemIds, withMenuRowDisplay, safeTotalCentsFromBody } from "./_shared/order-items.js";
import { BankartInitError, getBankartConfig, bankartMetaSnapshot, buildBankartDebitRequest, startBankartDebit } from "./_shared/bankart-debit.js";

type PaymentMethod = "cash" | "card";

type HeaderValue = string | string[] | undefined;
type HeadersLike = Record<string, HeaderValue>;

type ReqLike = {
  method?: string;
  headers?: HeadersLike;
  body?: unknown;
};

type ResLike = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => ResLike;
  send: (body: string) => void;
};

function toTrimmedString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function headerString(req: ReqLike, key: string): string {
  const raw = req.headers?.[key];
  if (typeof raw === "string") return raw.trim();
  if (Array.isArray(raw) && typeof raw[0] === "string") return raw[0].trim();
  return "";
}

function headerStringCI(req: ReqLike, key: string): string {
  return (
    headerString(req, key) ||
    headerString(req, key.toLowerCase()) ||
    headerString(req, key.toUpperCase())
  );
}

const supabase = buildSupabaseAdmin("create-order");

function getClientIp(req: ReqLike): string {
  const forwarded = headerStringCI(req, "x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim() ?? "";
    if (first) return first;
  }

  return headerStringCI(req, "x-real-ip");
}

let ratelimitInstance: Ratelimit | null = null;

function getRatelimit(): Ratelimit | null {
  const url = getEnv("UPSTASH_REDIS_REST_URL");
  const token = getEnv("UPSTASH_REDIS_REST_TOKEN");
  if (!url || !token) return null;
  if (!ratelimitInstance) {
    ratelimitInstance = new Ratelimit({
      redis: new Redis({ url, token }),
      limiter: Ratelimit.fixedWindow(10, "60 s"),
      analytics: false,
    });
  }
  return ratelimitInstance;
}

/**
 * Sanitizes errors returned to the browser client. Never relays raw
 * Bankart/network/DB error text — those go to server logs only.
 *
 * kind="payment_init" is chosen for a BankartInitError (every throw in
 * api/_shared/bankart-debit.ts, a card decline included) and, as before, for
 * any error mentioning "bankart".
 */
export function clientSafeError(
  _err: unknown,
  kind: "order_create" | "payment_init",
): string {
  if (kind === "order_create") {
    return "Greška pri kreiranju porudžbine. Pokušajte ponovo.";
  }
  return "Plaćanje karticom trenutno nije moguće. Pokušajte ponovo ili izaberite plaćanje pouzećem.";
}

function buildBankartUrls(req: ReqLike, orderId: string) {
  const base = resolvePublicBaseUrl(req.headers);
  const encoded = encodeURIComponent(orderId);

  return {
    successUrl: `${base}/checkout/success?id=${encoded}&payment=card&bankart=success`,
    cancelUrl: `${base}/checkout/success?id=${encoded}&payment=card&bankart=cancel`,
    errorUrl: `${base}/checkout/success?id=${encoded}&payment=card&bankart=error`,
    callbackUrl: `${base}/api/bankart-callback`,
  };
}

/**
 * B24: one checkout attempt = one order. The cart sends a random key per
 * attempt (src/lib/createOrder.ts) and reuses it when it resends the same
 * order — e.g. after a timeout hid a response that had in fact succeeded — so
 * the retry gets the first order back instead of a second one in the kitchen.
 * Stored in the unique `orders.idempotency_key` (migration
 * 20261009120000_orders_idempotency_key.sql).
 */
function idempotencyKeyFrom(body: Record<string, unknown>): string | null {
  const key = toTrimmedString(body.idempotency_key);
  return /^[A-Za-z0-9_-]{16,100}$/.test(key) ? key : null;
}

type ExistingOrder = {
  id: string;
  payment_method: string | null;
  payment_status: string | null;
  payment_meta: unknown;
};

async function findOrderByIdempotencyKey(key: string): Promise<ExistingOrder | null> {
  const { data, error } = await supabase
    .from("orders")
    .select("id,payment_method,payment_status,payment_meta")
    .eq("idempotency_key", key);
  // An error here (e.g. the column is not migrated yet) means "no earlier
  // attempt known" — never a reason to refuse the order.
  if (error || !Array.isArray(data) || data.length === 0) return null;
  const row = data[0] as Record<string, unknown>;
  const id = toTrimmedString(row.id);
  if (!id) return null;
  return {
    id,
    payment_method: toTrimmedString(row.payment_method) || null,
    payment_status: toTrimmedString(row.payment_status) || null,
    payment_meta: row.payment_meta,
  };
}

function isUnknownIdempotencyColumn(err: { code?: unknown; message?: unknown } | null): boolean {
  if (!err) return false;
  const code = toTrimmedString(err.code);
  const message = toTrimmedString(err.message);
  return (code === "PGRST204" || code === "42703") && message.includes("idempotency_key");
}

/**
 * A failed card attempt is not repeated: its key moves to the retry, so a
 * later lost response of the retry is still deduplicated.
 */
async function releaseIdempotencyKey(orderId: string, key: string): Promise<void> {
  const { error } = await supabase
    .from("orders")
    .update({ idempotency_key: null })
    .eq("id", orderId)
    .eq("idempotency_key", key);
  if (error) console.warn("[create-order] could not release idempotency key:", error.message);
}

/** The response the first attempt gave (or would give now), for a repeated key. */
function replayExistingOrder(res: ResLike, existing: ExistingOrder) {
  const id = existing.id;
  const base = { ok: true, id, order_id: id, orderId: id, replayed: true };

  if (existing.payment_method !== "card") return json(res, 200, { ...base, flow: "cash" });

  if (existing.payment_status === "paid") {
    return json(res, 200, { ...base, payment_method: "card", payment_status: "paid", flow: "card_paid" });
  }

  if (existing.payment_status && existing.payment_status !== "pending") {
    // failed / refunded / cancelled: never report it as a pending payment.
    return json(res, 409, {
      ok: false,
      code: "payment_not_completed",
      id,
      error: "Plaćanje za ovu porudžbinu nije uspelo. Pokušaj ponovo ili izaberi plaćanje pouzećem.",
    });
  }

  const meta = isPlainObject(existing.payment_meta) ? existing.payment_meta : {};
  const response = isPlainObject(meta.response) ? meta.response : {};
  const redirectUrl = meta.phase === "redirect" ? toTrimmedString(response.redirectUrl) : "";
  return json(res, 200, {
    ...base,
    payment_method: "card",
    payment_status: "pending",
    flow: redirectUrl ? "card_redirect" : "card_pending",
    redirect_url: redirectUrl || null,
    redirectUrl: redirectUrl || null,
  });
}

/**
 * Fail-open by design: an unset or unreadable business-hours config must
 * never block a real order. Only an explicitly configured + parseable
 * window (both columns set) can produce `open: false`.
 */
async function checkOrdersOpen(): Promise<{ open: boolean; hoursDisplay: string }> {
  try {
    const { data, error } = await supabase
      .from("site_settings")
      .select("orders_open_time, orders_close_time, hours_display")
      .eq("id", 1)
      .single();

    if (error) {
      console.warn("[create-order] business-hours read failed, allowing order:", error);
      return { open: true, hoursDisplay: "" };
    }
    if (!isPlainObject(data)) return { open: true, hoursDisplay: "" };

    const open = isWithinBusinessHours(
      data.orders_open_time,
      data.orders_close_time,
      nowMinutesInPodgorica(),
    );
    return { open, hoursDisplay: toTrimmedString(data.hours_display) };
  } catch (err) {
    console.warn("[create-order] business-hours check threw, allowing order:", err);
    return { open: true, hoursDisplay: "" };
  }
}

export default async function handler(req: ReqLike, res: ResLike) {
  applyCors(req, res, { methods: "POST" });

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  const ratelimit = getRatelimit();
  if (!ratelimit) {
    console.warn("[create-order] Rate limiting not active: UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not set");
  } else {
    try {
      const ip = getClientIp(req);
      const result = await ratelimit.limit(ip);
      if (!result.success) {
        const retryAfter = result.reset && Number.isFinite(result.reset)
          ? Math.max(1, Math.ceil((result.reset - Date.now()) / 1000))
          : 60;
        res.status(429);
        res.setHeader("Retry-After", String(retryAfter));
        res.setHeader("content-type", "application/json; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        res.send(
          JSON.stringify({
            ok: false,
            error: `Previše zahteva. Pokušajte ponovo za ${retryAfter} sekundi.`,
          }),
        );
        return;
      }
    } catch (err) {
      console.warn("[create-order] Rate limit check failed, allowing request:", err);
    }
  }

  try {
    const body = isPlainObject(req.body) ? req.body : {};

    const customer_name = toTrimmedString(body.customer_name);
    const customer_phone = toTrimmedString(body.customer_phone);
    const customer_address = toTrimmedString(body.customer_address);
    const customer_email = toTrimmedString(body.customer_email) || BANKART_FALLBACK_EMAIL;
    const billing_city = toTrimmedString(body.billing_city) || BANKART_FALLBACK_CITY;
    const billing_postcode = toTrimmedString(body.billing_postcode) || BANKART_FALLBACK_POSTCODE;
    const cardholder = toTrimmedString(body.cardholder);
    const transaction_token = toTrimmedString(body.transaction_token);

    const rawItems: unknown[] = Array.isArray(body.items) ? body.items : [];

    // B23e: status and currency are the server's, whatever the request says
    // (a cash order sent as "done" used to be stored as done).
    const currency = "EUR";

    const pmRaw = toTrimmedString(body.payment_method) || toTrimmedString(body.paymentMethod);
    if (pmRaw && pmRaw !== "cash" && pmRaw !== "card") {
      return json(res, 400, { ok: false, error: "Invalid payment_method" });
    }
    const payment_method: PaymentMethod = pmRaw === "card" ? "card" : "cash";

    if (
      customer_name.length < 2 ||
      customer_phone.length < 6 ||
      customer_address.length < 5 ||
      rawItems.length === 0
    ) {
      return json(res, 400, { ok: false, error: "Invalid payload" });
    }

    for (const it of rawItems) {
      if (!isMetaRow(it) && !isPriceableItemRow(it)) {
        return json(res, 400, { ok: false, error: "Invalid item structure" });
      }
    }

    const zoneKey = toTrimmedString(body.delivery_zone);
    const zone: DeliveryZone | null = zoneKey
      ? findDeliveryZone(zoneKey)
      : findDeliveryZoneByLabel(zoneLabelFromNote(rawItems));
    if (!zone) {
      return json(res, 400, {
        ok: false,
        code: "invalid_delivery_zone",
        error: "Izaberi zonu dostave i pokušaj ponovo.",
      });
    }

    // B24: a repeated attempt gets its first order back — checked before the
    // business hours and the menu, so a retry after closing time (or after a
    // price change) still answers with the order that was placed. A card
    // attempt whose payment failed is not repeated: the retry is a new order
    // and takes over the key.
    const idempotencyKey = idempotencyKeyFrom(body);
    if (idempotencyKey) {
      const existing = await findOrderByIdempotencyKey(idempotencyKey);
      if (existing && existing.payment_method === "card" && existing.payment_status === "failed") {
        await releaseIdempotencyKey(existing.id, idempotencyKey);
      } else if (existing) {
        return replayExistingOrder(res, existing);
      }
    }

    const hours = await checkOrdersOpen();
    if (!hours.open) {
      const suffix = hours.hoursDisplay ? ` Radno vrijeme: ${hours.hoursDisplay}.` : "";
      return json(res, 409, {
        ok: false,
        code: "outside_business_hours",
        error: `Trenutno ne primamo porudžbine.${suffix}`,
      });
    }

    if (payment_method === "card") {
      getBankartConfig();
    }

    // Every row that is not meta is priced from menu_items — price_per_item is
    // the client's own figure and never decides whether a row is charged.
    const calcItems = rawItems.filter(
      (it): it is Record<string, unknown> => isPlainObject(it) && !isMetaRow(it),
    );

    if (calcItems.length === 0) {
      return json(res, 400, { ok: false, error: "Invalid item structure" });
    }

    const idsToFetch: string[] = [];
    for (const it of calcItems) {
      const menu_item_id = toTrimmedString(it.menu_item_id) || toTrimmedString(it.menuItemId);
      if (menu_item_id) idsToFetch.push(menu_item_id);

      const addons = Array.isArray(it.addons) ? it.addons : [];
      for (const a of addons) {
        if (!isPlainObject(a)) continue;
        const addonId = toTrimmedString(a.id);
        if (addonId) idsToFetch.push(addonId);
      }
    }

    const { prices: priceMap, names: menuNames } = await fetchMenuRows(supabase, idsToFetch);
    const missingIds = findMissingMenuItemIds(idsToFetch, priceMap);

    if (missingIds.length > 0) {
      return json(res, 400, { ok: false, error: "Inactive or invalid menu item" });
    }

    const crustMismatch = findCrustSizeMismatch(calcItems, menuNames);
    if (crustMismatch) {
      console.warn("[create-order] stuffed crust does not match pizza size:", crustMismatch);
      return json(res, 400, {
        ok: false,
        code: "crust_size_mismatch",
        error: "Punjene ivice ne odgovaraju veličini pice. Ukloni ih iz korpe i dodaj ponovo.",
      });
    }

    let subtotal_eur_cents = 0;

    for (const item of calcItems) {
      const q = safeInt(item.quantity, 1);
      const id = toTrimmedString(item.menu_item_id) || toTrimmedString(item.menuItemId);
      const baseCents = id ? priceMap.get(id) ?? 0 : 0;
      const addonsCents = sumAddonsCents(item.addons, priceMap);

      subtotal_eur_cents += q * baseCents + q * addonsCents;
    }

    if (subtotal_eur_cents <= 0) {
      return json(res, 400, { ok: false, error: "Invalid calculated subtotal" });
    }

    // B23e: the fee comes from the server's zone table and the subtotal it
    // priced — never from the client's note.
    const feeCents = deliveryFeeCents(zone, subtotal_eur_cents);
    const computedTotalCents = subtotal_eur_cents + feeCents;
    // A non-finite total is stored as NULL (Telegram: "Ukupno: 0,00 €").
    if (!Number.isSafeInteger(computedTotalCents)) {
      return json(res, 400, { ok: false, error: "Invalid calculated total" });
    }
    const bodyTotalCents = safeTotalCentsFromBody(body);

    if (bodyTotalCents > 0 && Math.abs(bodyTotalCents - computedTotalCents) > 1) {
      return json(res, 400, { ok: false, error: "Total mismatch" });
    }

    const insertRow: Record<string, unknown> = {
      customer_name,
      customer_phone,
      customer_address,
      items: withServerMetaRow(withMenuRowDisplay(rawItems, priceMap, menuNames), [
        `Plaćanje: ${payment_method === "cash" ? "Gotovina" : "Kartica"}`,
        `Zona: ${zone.label}, Dostava: ${formatDeliveryFee(feeCents)}`,
      ]),
      status: "pending",
      currency,
      total_eur_cents: computedTotalCents,
      payment_method,
      payment_status: payment_method === "card" ? "pending" : null,
      payment_provider: payment_method === "card" ? "bankart" : null,
      payment_reference: null,
      payment_meta:
        payment_method === "card"
          ? bankartMetaSnapshot({
              phase: "order_created",
              message: transaction_token
                ? "Order created before Bankart payment.js debit init"
                : "Order created before Bankart redirect init",
            })
          : null,
    };

    if (idempotencyKey) insertRow.idempotency_key = idempotencyKey;

    let { data: inserted, error: insErr } = await supabase
      .from("orders")
      .insert(insertRow)
      .select("id")
      .single();

    if (insErr && idempotencyKey && toTrimmedString(insErr.code) === "23505") {
      // Two identical attempts raced; the other one inserted first.
      const existing = await findOrderByIdempotencyKey(idempotencyKey);
      if (existing) return replayExistingOrder(res, existing);
    }

    if (insErr && isUnknownIdempotencyColumn(insErr)) {
      // Code deployed before its migration: take the order without the key.
      console.warn("[create-order] orders.idempotency_key missing — apply migration 20261009120000");
      delete insertRow.idempotency_key;
      ({ data: inserted, error: insErr } = await supabase.from("orders").insert(insertRow).select("id").single());
    }

    if (insErr || !inserted?.id) {
      console.error("[create-order] DB insert failed:", insErr);
      return json(res, 500, { ok: false, error: clientSafeError(insErr, "order_create") });
    }

    const orderId = toTrimmedString(inserted.id);

    if (payment_method === "cash") {
      await notifyNewOrder(supabase, orderId);

      return json(res, 200, {
        ok: true,
        id: orderId,
        order_id: orderId,
        orderId,
        flow: "cash",
      });
    }

    const bankartRequest = buildBankartDebitRequest(orderId, {
      urls: buildBankartUrls(req, orderId),
      clientIp: getClientIp(req),
      amountCents: computedTotalCents,
      currency,
      customerName: customer_name,
      bankartCustomerName: cardholder || customer_name,
      customerPhone: customer_phone,
      customerAddress: customer_address,
      customerEmail: customer_email,
      billingCity: billing_city,
      billingPostcode: billing_postcode,
      transactionToken: transaction_token || null,
    });

    const bankart = await startBankartDebit(supabase, orderId, bankartRequest);

    return json(res, 200, {
      ok: true,
      id: orderId,
      order_id: orderId,
      orderId,
      payment_method,
      payment_status: bankart.flow === "card_paid" ? "paid" : "pending",
      flow: bankart.flow,
      redirect_url: "redirectUrl" in bankart ? bankart.redirectUrl : null,
      redirectUrl: "redirectUrl" in bankart ? bankart.redirectUrl : null,
      bankart_uuid: bankart.bankartUuid,
      bankart_purchase_id: bankart.bankartPurchaseId,
      bankart_return_type: bankart.bankartReturnType,
    });
  } catch (err: unknown) {
    console.error("[create-order] order creation failed:", err);
    const kind: "order_create" | "payment_init" =
      err instanceof BankartInitError || (err instanceof Error && err.message.toLowerCase().includes("bankart"))
        ? "payment_init"
        : "order_create";
    return json(res, 500, { ok: false, error: clientSafeError(err, kind) });
  }
}