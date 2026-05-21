import { createClient } from "@supabase/supabase-js";
import { getAdminFromDb } from "./_shared/admin-auth.js";
import { isPlainObject } from "./_shared/parsing.js";
import { applyCors } from "./_shared/cors.js";

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

type SiteSettingsRow = {
  id: number;
  phone_display: string;
  phone_e164: string;
  email: string;
  address_line: string;
  hours_display: string;
  maps_url: string;
  instagram_url: string;
  whatsapp_url: string;
  viber_url: string;
  default_city: string;
  default_postcode: string;
  created_at: string;
  updated_at: string;
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
    global: { headers: { "X-Client-Info": "padrino-vercel-api/admin-settings" } },
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

function toSafeString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function isValidOptionalEmail(v: string): boolean {
  if (!v) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function isValidOptionalUrl(v: string): boolean {
  if (!v) return true;
  if (v.startsWith("viber://")) return true;
  try {
    const u = new URL(v);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeSiteSettingsRow(raw: unknown): SiteSettingsRow | null {
  if (!isPlainObject(raw)) return null;

  const id =
    typeof raw.id === "number" && Number.isFinite(raw.id)
      ? Math.trunc(raw.id)
      : typeof raw.id === "string" && raw.id.trim() !== "" && Number.isFinite(Number(raw.id))
        ? Math.trunc(Number(raw.id))
        : NaN;

  if (!Number.isFinite(id) || id !== 1) return null;

  return {
    id,
    phone_display: toSafeString(raw.phone_display),
    phone_e164: toSafeString(raw.phone_e164),
    email: toSafeString(raw.email),
    address_line: toSafeString(raw.address_line),
    hours_display: toSafeString(raw.hours_display),
    maps_url: toSafeString(raw.maps_url),
    instagram_url: toSafeString(raw.instagram_url),
    whatsapp_url: toSafeString(raw.whatsapp_url),
    viber_url: toSafeString(raw.viber_url),
    default_city: toSafeString(raw.default_city),
    default_postcode: toSafeString(raw.default_postcode),
    created_at: toSafeString(raw.created_at),
    updated_at: toSafeString(raw.updated_at),
  };
}

function getSelectableColumns() {
  return [
    "id",
    "phone_display",
    "phone_e164",
    "email",
    "address_line",
    "hours_display",
    "maps_url",
    "instagram_url",
    "whatsapp_url",
    "viber_url",
    "default_city",
    "default_postcode",
    "created_at",
    "updated_at",
  ].join(", ");
}

async function ensureSingletonRow() {
  const { data, error } = await supabase.from("site_settings").select(getSelectableColumns()).eq("id", 1).maybeSingle();

  if (error) return { data: null as SiteSettingsRow | null, error };

  const normalized = normalizeSiteSettingsRow(data);
  if (normalized) return { data: normalized, error: null as null };

  const { data: inserted, error: insertError } = await supabase
    .from("site_settings")
    .upsert({ id: 1 }, { onConflict: "id" })
    .select(getSelectableColumns())
    .single();

  if (insertError) return { data: null as SiteSettingsRow | null, error: insertError };

  return { data: normalizeSiteSettingsRow(inserted), error: null as null };
}

export default async function handler(req: ReqLike, res: ResLike) {
  applyCors(req, res, { methods: "GET, POST", allowHeaders: "content-type, x-requested-with, authorization" });

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
      const ensured = await ensureSingletonRow();
      if (ensured.error) {
        return json(res, 500, { ok: false, error: "DB select failed" });
      }

      if (!ensured.data) {
        return json(res, 500, { ok: false, error: "site_settings row is invalid" });
      }

      return json(res, 200, {
        ok: true,
        actor: { email: actorEmail, role: actor.role ?? "staff" },
        settings: ensured.data,
      });
    }

    if (actor.role !== "owner") {
      return json(res, 403, { ok: false, error: "Owner required" });
    }

    const body = parseJsonBody(req);
    if (!body) return json(res, 400, { ok: false, error: "Invalid JSON body" });

    const updatePayload: Record<string, unknown> = { id: 1 };

    if ("phone_display" in body || "phoneDisplay" in body) {
      const v = toSafeString(body.phone_display ?? body.phoneDisplay);
      if (v.length > 120) return json(res, 400, { ok: false, error: "phone_display is too long" });
      updatePayload.phone_display = v;
    }

    if ("phone_e164" in body || "phoneE164" in body) {
      const v = toSafeString(body.phone_e164 ?? body.phoneE164);
      if (v.length > 32) return json(res, 400, { ok: false, error: "phone_e164 is too long" });
      updatePayload.phone_e164 = v;
    }

    if ("email" in body) {
      const v = toSafeString(body.email);
      if (v.length > 200) return json(res, 400, { ok: false, error: "email is too long" });
      if (!isValidOptionalEmail(v)) return json(res, 400, { ok: false, error: "Invalid email" });
      updatePayload.email = v;
    }

    if ("address_line" in body || "addressLine" in body) {
      const v = toSafeString(body.address_line ?? body.addressLine);
      if (v.length > 300) return json(res, 400, { ok: false, error: "address_line is too long" });
      updatePayload.address_line = v;
    }

    if ("hours_display" in body || "hoursDisplay" in body) {
      const v = toSafeString(body.hours_display ?? body.hoursDisplay);
      if (v.length > 200) return json(res, 400, { ok: false, error: "hours_display is too long" });
      updatePayload.hours_display = v;
    }

    if ("maps_url" in body || "mapsUrl" in body) {
      const v = toSafeString(body.maps_url ?? body.mapsUrl);
      if (v.length > 1000) return json(res, 400, { ok: false, error: "maps_url is too long" });
      if (!isValidOptionalUrl(v)) return json(res, 400, { ok: false, error: "Invalid maps_url" });
      updatePayload.maps_url = v;
    }

    if ("instagram_url" in body || "instagramUrl" in body) {
      const v = toSafeString(body.instagram_url ?? body.instagramUrl);
      if (v.length > 1000) return json(res, 400, { ok: false, error: "instagram_url is too long" });
      if (!isValidOptionalUrl(v)) return json(res, 400, { ok: false, error: "Invalid instagram_url" });
      updatePayload.instagram_url = v;
    }

    if ("whatsapp_url" in body || "whatsappUrl" in body) {
      const v = toSafeString(body.whatsapp_url ?? body.whatsappUrl);
      if (v.length > 1000) return json(res, 400, { ok: false, error: "whatsapp_url is too long" });
      if (!isValidOptionalUrl(v)) return json(res, 400, { ok: false, error: "Invalid whatsapp_url" });
      updatePayload.whatsapp_url = v;
    }

    if ("viber_url" in body || "viberUrl" in body) {
      const v = toSafeString(body.viber_url ?? body.viberUrl);
      if (v.length > 1000) return json(res, 400, { ok: false, error: "viber_url is too long" });
      if (!isValidOptionalUrl(v)) return json(res, 400, { ok: false, error: "Invalid viber_url" });
      updatePayload.viber_url = v;
    }

    if ("default_city" in body || "defaultCity" in body) {
      const v = toSafeString(body.default_city ?? body.defaultCity);
      if (v.length > 120) return json(res, 400, { ok: false, error: "default_city is too long" });
      updatePayload.default_city = v;
    }

    if ("default_postcode" in body || "defaultPostcode" in body) {
      const v = toSafeString(body.default_postcode ?? body.defaultPostcode);
      if (v.length > 40) return json(res, 400, { ok: false, error: "default_postcode is too long" });
      updatePayload.default_postcode = v;
    }

    if (Object.keys(updatePayload).length === 1) {
      return json(res, 400, { ok: false, error: "No fields to update" });
    }

    const { data, error } = await supabase
      .from("site_settings")
      .upsert(updatePayload, { onConflict: "id" })
      .select(getSelectableColumns())
      .single();

    if (error) {
      return json(res, 500, { ok: false, error: "DB update failed" });
    }

    const settings = normalizeSiteSettingsRow(data);
    if (!settings) {
      return json(res, 500, { ok: false, error: "Updated row is invalid" });
    }

    return json(res, 200, {
      ok: true,
      actor: { email: actorEmail, role: actor.role ?? "owner" },
      settings,
    });
  } catch {
    return json(res, 500, { ok: false, error: "Internal server error" });
  }
}