import { createClient } from "@supabase/supabase-js";
import { getAdminFromDb } from "./_shared/admin-auth.js";
import { isPlainObject } from "./_shared/parsing.js";

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

const MENU_IMAGES_BUCKET = "menu-images";
const ADMIN_PATH_PREFIX = "admin/";

function toTrimmedString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
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
    global: { headers: { "X-Client-Info": "padrino-vercel-api/admin-menu-image" } },
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

// ── Upload helpers ──

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

// ── Delete helpers ──

function extractStoragePath(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith(ADMIN_PATH_PREFIX) && !trimmed.startsWith("http")) {
    return trimmed;
  }

  const marker = `/storage/v1/object/public/${MENU_IMAGES_BUCKET}/`;
  const idx = trimmed.indexOf(marker);
  if (idx < 0) return null;

  const raw = trimmed.slice(idx + marker.length);
  if (!raw) return null;

  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function isValidAdminPath(path: string): boolean {
  if (!path.startsWith(ADMIN_PATH_PREFIX)) return false;
  if (path.includes("..")) return false;
  if (path.includes("//")) return false;

  const afterPrefix = path.slice(ADMIN_PATH_PREFIX.length);
  if (!afterPrefix || afterPrefix.length < 3) return false;

  return true;
}

// ── Action handlers ──

async function handleUpload(body: Record<string, unknown>, actorEmail: string, actorRole: string, res: ResLike) {
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
    return json(res, 500, { ok: false, error: "Storage upload failed" });
  }

  const { data: publicUrlData } = supabase.storage.from(MENU_IMAGES_BUCKET).getPublicUrl(path);
  const publicUrl = typeof publicUrlData?.publicUrl === "string" ? publicUrlData.publicUrl.trim() : "";

  if (!publicUrl) {
    return json(res, 500, { ok: false, error: "Public URL generation failed" });
  }

  return json(res, 200, {
    ok: true,
    actor: { email: actorEmail, role: actorRole },
    bucket: MENU_IMAGES_BUCKET,
    path,
    publicUrl,
  });
}

async function handleDelete(body: Record<string, unknown>, res: ResLike) {
  const rawInput =
    toTrimmedString(body.path) ||
    toTrimmedString(body.image) ||
    toTrimmedString(body.publicUrl);

  if (!rawInput) {
    return json(res, 400, { ok: false, error: "Missing path, image, or publicUrl" });
  }

  const storagePath = extractStoragePath(rawInput);
  if (!storagePath) {
    return json(res, 400, { ok: false, error: "Could not resolve storage path from input" });
  }

  if (!isValidAdminPath(storagePath)) {
    return json(res, 400, { ok: false, error: "Path is outside allowed admin/ prefix" });
  }

  const { error: removeError } = await supabase.storage
    .from(MENU_IMAGES_BUCKET)
    .remove([storagePath]);

  if (removeError) {
    return json(res, 500, { ok: false, error: "Storage delete failed" });
  }

  return json(res, 200, {
    ok: true,
    deleted: storagePath,
    bucket: MENU_IMAGES_BUCKET,
  });
}

// ── Main handler ──

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

    const actor = await getAdminFromDb(supabase, actorEmail);
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

    const action = toTrimmedString(body.action);

    if (action === "upload") {
      return await handleUpload(body, actorEmail, actor.role ?? "owner", res);
    }

    if (action === "delete") {
      return await handleDelete(body, res);
    }

    return json(res, 400, { ok: false, error: 'Missing or invalid action. Use "upload" or "delete".' });
  } catch {
    return json(res, 500, { ok: false, error: "Internal server error" });
  }
}
