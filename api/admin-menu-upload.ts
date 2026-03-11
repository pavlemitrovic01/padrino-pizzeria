import { createClient } from "@supabase/supabase-js";

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

type AdminRole = "owner" | "staff";

const FALLBACK_ADMIN_EMAILS = new Set<string>(["pavlemitrovic01@gmail.com"]);
const MENU_IMAGES_BUCKET = "menu-images";

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
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
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
  const supabaseUrl = getEnv("SUPABASE_URL") || getEnv("VITE_SUPABASE_URL");
  const serviceRole =
    getEnv("SUPABASE_SERVICE_ROLE_KEY") || getEnv("SUPABASE_SERVICE_KEY") || getEnv("SUPABASE_SERVICE_ROLE");

  if (!supabaseUrl || !serviceRole) {
    throw new Error("Missing env: SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { "X-Client-Info": "padrino-vercel-api/admin-menu-upload" } },
  });
}

const supabase = buildSupabaseAdmin();

function normalizeEmail(v: string): string {
  return v.trim().toLowerCase();
}

function getBearerToken(req: ReqLike): string {
  const h = headerString(req, "authorization") || headerString(req, "Authorization");
  if (!h) return "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : "";
}

function looksLikeMissingTable(err: unknown): boolean {
  const msg =
    typeof (err as { message?: unknown })?.message === "string"
      ? (err as { message: string }).message
      : "";
  const s = msg.toLowerCase();
  return s.includes("admin_users") && (s.includes("does not exist") || s.includes("relation"));
}

function isAdminRole(v: unknown): v is AdminRole {
  return v === "owner" || v === "staff";
}

async function getAdminFromDb(
  email: string,
): Promise<{ table: "ok" | "missing" | "error"; isAdmin: boolean; role: AdminRole | null }> {
  const e = normalizeEmail(email);
  if (!e) return { table: "ok", isAdmin: false, role: null };

  const { data, error } = await supabase
    .from("admin_users")
    .select("email, role, enabled")
    .eq("email", e)
    .maybeSingle();

  if (error) {
    if (looksLikeMissingTable(error)) {
      const fallback = FALLBACK_ADMIN_EMAILS.has(e);
      return { table: "missing", isAdmin: fallback, role: fallback ? "owner" : null };
    }
    return { table: "error", isAdmin: false, role: null };
  }

  const enabled = typeof data?.enabled === "boolean" ? data.enabled : false;
  const role = isAdminRole(data?.role) ? data.role : null;

  if (!enabled) return { table: "ok", isAdmin: false, role: null };
  return { table: "ok", isAdmin: true, role: role ?? "staff" };
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

function decodeBase64Payload(input: string): Buffer | null {
  const cleaned = input.trim();
  if (!cleaned) return null;

  const dataPart = cleaned.startsWith("data:") ? cleaned.split(",", 2)[1] ?? "" : cleaned;
  if (!dataPart) return null;

  try {
    const buffer = Buffer.from(dataPart, "base64");
    return buffer.length > 0 ? buffer : null;
  } catch {
    return null;
  }
}

function detectExtension(contentType: string, fallbackName: string): string {
  const normalizedType = contentType.trim().toLowerCase();

  if (normalizedType === "image/jpeg" || normalizedType === "image/jpg") return "jpg";
  if (normalizedType === "image/png") return "png";
  if (normalizedType === "image/webp") return "webp";
  if (normalizedType === "image/gif") return "gif";

  const file = fallbackName.trim().toLowerCase();
  if (file.endsWith(".jpg") || file.endsWith(".jpeg")) return "jpg";
  if (file.endsWith(".png")) return "png";
  if (file.endsWith(".webp")) return "webp";
  if (file.endsWith(".gif")) return "gif";

  return "bin";
}

function sanitizeBaseName(value: string): string {
  const raw = value.trim().toLowerCase();
  const safe = raw
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return safe || "menu-item";
}

export default async function handler(req: ReqLike, res: ResLike) {
  setCors(req, res);

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  try {
    const token = getBearerToken(req);
    if (!token) {
      return json(res, 401, { ok: false, error: "Missing auth token" });
    }

    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      return json(res, 401, { ok: false, error: "Invalid session" });
    }

    const actorEmailRaw = typeof userData.user.email === "string" ? userData.user.email : "";
    const actorEmail = normalizeEmail(actorEmailRaw);
    if (!actorEmail) {
      return json(res, 401, { ok: false, error: "Invalid session" });
    }

    const actor = await getAdminFromDb(actorEmail);
    if (!actor.isAdmin) {
      return json(res, 403, { ok: false, error: "Not authorized" });
    }

    if (actor.role !== "owner") {
      return json(res, 403, { ok: false, error: "Owner required" });
    }

    const body = parseJsonBody(req);
    if (!body) {
      return json(res, 400, { ok: false, error: "Invalid JSON body" });
    }

    const fileName = toTrimmedString(body.fileName);
    const contentType = toTrimmedString(body.contentType).toLowerCase();
    const base64 = toTrimmedString(body.base64);
    const itemName = toTrimmedString(body.itemName);

    if (!base64) {
      return json(res, 400, { ok: false, error: "Image payload is required" });
    }

    if (!contentType || !contentType.startsWith("image/")) {
      return json(res, 400, { ok: false, error: "Only image uploads are allowed" });
    }

    const bytes = decodeBase64Payload(base64);
    if (!bytes) {
      return json(res, 400, { ok: false, error: "Invalid base64 image payload" });
    }

    if (bytes.length > 5 * 1024 * 1024) {
      return json(res, 400, { ok: false, error: "Image is too large (max 5MB)" });
    }

    const ext = detectExtension(contentType, fileName);
    if (!["jpg", "png", "webp", "gif"].includes(ext)) {
      return json(res, 400, { ok: false, error: "Unsupported image format" });
    }

    const baseName = sanitizeBaseName(itemName || fileName || "menu-item");
    const path = `admin/${Date.now()}-${baseName}.${ext}`;

    const { error: uploadError } = await supabase.storage.from(MENU_IMAGES_BUCKET).upload(path, bytes, {
      contentType,
      upsert: false,
      cacheControl: "31536000",
    });

    if (uploadError) {
      const msg =
        typeof uploadError.message === "string" && uploadError.message.trim()
          ? uploadError.message.trim()
          : "Storage upload failed";
      return json(res, 500, { ok: false, error: msg });
    }

    const { data: publicUrlData } = supabase.storage.from(MENU_IMAGES_BUCKET).getPublicUrl(path);
    const publicUrl = typeof publicUrlData?.publicUrl === "string" ? publicUrlData.publicUrl.trim() : "";

    if (!publicUrl) {
      return json(res, 500, { ok: false, error: "Public URL generation failed" });
    }

    return json(res, 200, {
      ok: true,
      actor: { email: actorEmail, role: actor.role ?? "owner" },
      bucket: MENU_IMAGES_BUCKET,
      path,
      publicUrl,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return json(res, 500, { ok: false, error: msg || "Unknown error" });
  }
}