import { createClient } from "@supabase/supabase-js";
import { getAdminFromDb } from "./_shared/admin-auth";

type Json = Record<string, unknown>;

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

type MenuCategory = "pizza" | "pica" | "sosovi" | "dodaci";

type AdminMenuRow = {
  id: string;
  name: string;
  description: string | null;
  category: MenuCategory;
  image: string | null;
  price: number | null;
  price_eur_cents: number;
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

function toTrimmedString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function headerString(req: ReqLike, key: string): string {
  const raw = req.headers?.[key];
  if (typeof raw === "string") return raw.trim();
  if (Array.isArray(raw) && typeof raw[0] === "string") return raw[0].trim();
  return "";
}

function setCors(req: ReqLike, res: ResLike) {
  const origin = headerString(req, "origin");
  res.setHeader("Access-Control-Allow-Origin", origin || "*");
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type, x-requested-with, authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
}

function json(res: ResLike, status: number, body: Json) {
  res.status(status);
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.send(JSON.stringify(body));
}

function getEnv(name: string): string {
  return toTrimmedString(process.env[name]);
}

function buildSupabaseAdmin() {
  const SUPABASE_URL = getEnv("SUPABASE_URL") || getEnv("VITE_SUPABASE_URL");
  const SERVICE_ROLE =
    getEnv("SUPABASE_SERVICE_ROLE_KEY") || getEnv("SUPABASE_SERVICE_KEY") || getEnv("SUPABASE_SERVICE_ROLE");

  if (!SUPABASE_URL || !SERVICE_ROLE) {
    throw new Error("Missing env: SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { "X-Client-Info": "padrino-vercel-api/admin-menu" } },
  });
}

const supabase = buildSupabaseAdmin();

function normalizeEmail(v: string) {
  return v.trim().toLowerCase();
}

function getBearerToken(req: ReqLike): string {
  const h = headerString(req, "authorization") || headerString(req, "Authorization");
  if (!h) return "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : "";
}

function normalizeCategory(value: unknown): MenuCategory | null {
  const s = toTrimmedString(value).toLowerCase();

  if (s === "pizza") return "pizza";
  if (s === "pica") return "pica";
  if (s === "dodaci") return "dodaci";
  if (s === "sosovi" || s === "sosevi" || s === "sos") return "sosovi";

  return null;
}

function toNullableTrimmedString(v: unknown): string | null {
  const s = toTrimmedString(v);
  return s ? s : null;
}

function toSafeInt(v: unknown, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return Math.trunc(n);
  }
  return fallback;
}

function parsePositiveCents(v: unknown): number | null {
  const n = toSafeInt(v, Number.NaN);
  if (!Number.isFinite(n)) return null;
  if (n < 0) return null;
  return n;
}

function parseOptionalBoolean(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true") return true;
    if (s === "false") return false;
  }
  return null;
}

function parseOptionalSortOrder(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  const n = toSafeInt(v, Number.NaN);
  if (!Number.isFinite(n)) return null;
  if (n < 0) return null;
  return n;
}

function parseJsonBody(req: ReqLike): Record<string, unknown> | null {
  if (isPlainObject(req.body)) return req.body;

  if (typeof req.body === "string") {
    try {
      const parsed = JSON.parse(req.body) as unknown;
      return isPlainObject(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  return null;
}

function normalizeMenuRow(raw: unknown): AdminMenuRow | null {
  if (!isPlainObject(raw)) return null;

  const id = toTrimmedString(raw.id);
  const name = toTrimmedString(raw.name);
  const description = toNullableTrimmedString(raw.description);
  const category = normalizeCategory(raw.category);
  const image = toNullableTrimmedString(raw.image);
  const createdAt = toTrimmedString(raw.created_at);

  const centsRaw = raw.price_eur_cents;
  const priceCents = parsePositiveCents(centsRaw);

  const legacyPriceRaw = raw.price;
  const legacyPrice =
    typeof legacyPriceRaw === "number" && Number.isFinite(legacyPriceRaw)
      ? Math.trunc(legacyPriceRaw)
      : typeof legacyPriceRaw === "string" && legacyPriceRaw.trim() !== "" && Number.isFinite(Number(legacyPriceRaw))
        ? Math.trunc(Number(legacyPriceRaw))
        : null;

  const isActive = parseOptionalBoolean(raw.is_active);
  const sortOrder = parseOptionalSortOrder(raw.sort_order);
  if (!id) return null;
  if (!name) return null;
  if (!category) return null;
  if (priceCents === null) return null;
  if (isActive === null) return null;
  if (sortOrder === null) return null;

  return {
    id,
    name,
    description,
    category,
    image,
    price: legacyPrice,
    price_eur_cents: priceCents,
    sort_order: sortOrder,
    is_active: isActive,
    created_at: createdAt,
  };
}

export default async function handler(req: ReqLike, res: ResLike) {
  setCors(req, res);

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    const token = getBearerToken(req);
    if (!token) return json(res, 401, { ok: false, error: "Missing auth token" });

    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) return json(res, 401, { ok: false, error: "Invalid session" });

    const actorEmailRaw = typeof userData.user.email === "string" ? userData.user.email : "";
    const actorEmail = normalizeEmail(actorEmailRaw);
    if (!actorEmail) return json(res, 401, { ok: false, error: "Invalid session" });

    const actor = await getAdminFromDb(supabase, actorEmail);
    if (!actor.isAdmin) return json(res, 403, { ok: false, error: "Not authorized" });

    if (req.method === "GET") {
      const { data, error } = await supabase
        .from("menu_items")
        .select("id, name, description, category, image, price, price_eur_cents, sort_order, is_active, created_at")
        .order("sort_order", { ascending: true })
        .order("category", { ascending: true })
        .order("name", { ascending: true });

      if (error) {
        return json(res, 500, { ok: false, error: "DB select failed" });
      }

      const items = Array.isArray(data)
        ? data.map(normalizeMenuRow).filter((x): x is AdminMenuRow => Boolean(x))
        : [];

      return json(res, 200, {
        ok: true,
        actor: { email: actorEmail, role: actor.role ?? "staff" },
        items,
      });
    }

    if (actor.role !== "owner") {
      return json(res, 403, { ok: false, error: "Owner required" });
    }

    const body = parseJsonBody(req);
    if (!body) return json(res, 400, { ok: false, error: "Invalid JSON body" });

    const id = toTrimmedString(body.id);
    const name = toTrimmedString(body.name);
    const description = toNullableTrimmedString(body.description);
    const category = normalizeCategory(body.category);
    const image = toNullableTrimmedString(body.image);

    const priceCents =
      parsePositiveCents(body.price_eur_cents) ??
      parsePositiveCents(body.priceEurCents) ??
      parsePositiveCents(body.price);

    const isActive = parseOptionalBoolean(body.is_active ?? body.isActive);
    const sortOrder = parseOptionalSortOrder(body.sort_order ?? body.sortOrder);

    if (!id) {
      if (!name) return json(res, 400, { ok: false, error: "Name is required" });
      if (name.length > 120) return json(res, 400, { ok: false, error: "Name is too long" });

      if (description && description.length > 2000) {
        return json(res, 400, { ok: false, error: "Description is too long" });
      }

      if (!category) return json(res, 400, { ok: false, error: "Invalid category" });

      if (priceCents === null) {
        return json(res, 400, { ok: false, error: "Invalid price_eur_cents" });
      }

      if (image && image.length > 500) {
        return json(res, 400, { ok: false, error: "Image path is too long" });
      }

      const insertPayload: Record<string, unknown> = {
        name,
        description,
        category,
        image,
        price: priceCents,
        price_eur_cents: priceCents,
      };

      if (sortOrder !== null) {
        insertPayload.sort_order = sortOrder;
      }

      if (isActive !== null) {
        insertPayload.is_active = isActive;
      }

      const { data, error } = await supabase
        .from("menu_items")
        .insert(insertPayload)
        .select("id, name, description, category, image, price, price_eur_cents, sort_order, is_active, created_at")
        .single();

      if (error) {
        return json(res, 500, { ok: false, error: "DB insert failed" });
      }

      const item = normalizeMenuRow(data);
      if (!item) {
        return json(res, 500, { ok: false, error: "Inserted row is invalid" });
      }

      return json(res, 200, {
        ok: true,
        actor: { email: actorEmail, role: actor.role ?? "owner" },
        item,
      });
    }

    const updatePayload: Record<string, unknown> = {};

    if ("name" in body) {
      if (!name) return json(res, 400, { ok: false, error: "Name is required" });
      if (name.length > 120) return json(res, 400, { ok: false, error: "Name is too long" });
      updatePayload.name = name;
    }

    if ("description" in body) {
      if (description && description.length > 2000) {
        return json(res, 400, { ok: false, error: "Description is too long" });
      }
      updatePayload.description = description;
    }

    if ("category" in body) {
      if (!category) return json(res, 400, { ok: false, error: "Invalid category" });
      updatePayload.category = category;
    }

    if ("image" in body) {
      if (image && image.length > 500) {
        return json(res, 400, { ok: false, error: "Image path is too long" });
      }
      updatePayload.image = image;
    }

    if ("price_eur_cents" in body || "priceEurCents" in body || "price" in body) {
      if (priceCents === null) {
        return json(res, 400, { ok: false, error: "Invalid price_eur_cents" });
      }
      updatePayload.price = priceCents;
      updatePayload.price_eur_cents = priceCents;
    }

    if ("sort_order" in body || "sortOrder" in body) {
      if (sortOrder === null) {
        return json(res, 400, { ok: false, error: "Invalid sort_order" });
      }
      updatePayload.sort_order = sortOrder;
    }

    if ("is_active" in body || "isActive" in body) {
      if (isActive === null) {
        return json(res, 400, { ok: false, error: "Invalid is_active" });
      }
      updatePayload.is_active = isActive;
    }

    if (Object.keys(updatePayload).length === 0) {
      return json(res, 400, { ok: false, error: "No fields to update" });
    }

    const { data, error } = await supabase
      .from("menu_items")
      .update(updatePayload)
      .eq("id", id)
      .select("id, name, description, category, image, price, price_eur_cents, sort_order, is_active, created_at")
      .single();

    if (error) {
      return json(res, 500, { ok: false, error: "DB update failed" });
    }

    const item = normalizeMenuRow(data);
    if (!item) {
      return json(res, 500, { ok: false, error: "Updated row is invalid" });
    }

    return json(res, 200, {
      ok: true,
      actor: { email: actorEmail, role: actor.role ?? "owner" },
      item,
    });
  } catch {
    return json(res, 500, { ok: false, error: "Internal server error" });
  }
}