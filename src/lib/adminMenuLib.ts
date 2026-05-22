import { getAdminApiBase } from "./adminApiBase";
import { supabaseAdminAuth } from "./supabaseAdminAuthClient";
import { isPlainObject as isRecord, normalizeText } from "./parsing";

// ─── Types ────────────────────────────────────────────────────────────────────

export type MenuCategory = "pizza" | "pica" | "sosovi" | "dodaci";
export type VisibilityFilter = "all" | "active" | "hidden";

export type AdminMenuRow = {
  id: string;
  name: string;
  description: string | null;
  category: MenuCategory;
  image: string | null;
  price_eur_cents: number;
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

export type AdminMenuGetOk = {
  ok: true;
  items: AdminMenuRow[];
};

export type AdminMenuGetErr = {
  ok: false;
  error: string;
};

export type AdminMenuGetResponse = AdminMenuGetOk | AdminMenuGetErr;

export type AdminMenuPostOk = {
  ok: true;
  item: AdminMenuRow;
};

export type AdminMenuPostErr = {
  ok: false;
  error: string;
};

export type AdminMenuPostResponse = AdminMenuPostOk | AdminMenuPostErr;

export type AdminMenuUploadOk = {
  ok: true;
  bucket: string;
  path: string;
  publicUrl: string;
};

export type AdminMenuUploadErr = {
  ok: false;
  error: string;
};

export type AdminMenuUploadResponse = AdminMenuUploadOk | AdminMenuUploadErr;

export type AdminMenuImageDeleteOk = {
  ok: true;
  deleted: string;
  bucket: string;
};

export type AdminMenuImageDeleteErr = {
  ok: false;
  error: string;
};

export type AdminMenuImageDeleteResponse = AdminMenuImageDeleteOk | AdminMenuImageDeleteErr;

export type EditorState = {
  id: string | null;
  name: string;
  description: string;
  category: MenuCategory;
  image: string;
  priceInput: string;
  isActive: boolean;
};

// ─── Constants ────────────────────────────────────────────────────────────────

export const ADMIN_API_BASE = getAdminApiBase();
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

export const CATEGORY_OPTIONS: Array<{ value: MenuCategory; label: string }> = [
  { value: "pizza", label: "Pizza" },
  { value: "pica", label: "Pića" },
  { value: "sosovi", label: "Sosevi" },
  { value: "dodaci", label: "Dodaci" },
];

export const VISIBILITY_OPTIONS: Array<{ value: VisibilityFilter; label: string }> = [
  { value: "all", label: "Sve stavke" },
  { value: "active", label: "Aktivne" },
  { value: "hidden", label: "Skrivene" },
];

export const EMPTY_EDITOR: EditorState = {
  id: null,
  name: "",
  description: "",
  category: "pizza",
  image: "",
  priceInput: "",
  isActive: true,
};

// ─── Pure helpers ─────────────────────────────────────────────────────────────

export function toStr(v: unknown): string {
  return typeof v === "string" ? v : "";
}

export function toNullableStr(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s : null;
}

export function toBool(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true") return true;
    if (s === "false") return false;
  }
  return null;
}

export function toNonNegativeInt(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) {
    return v >= 0 ? Math.trunc(v) : null;
  }

  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0) {
      return Math.trunc(n);
    }
  }

  return null;
}

export function normalizeCategory(value: string): MenuCategory {
  const s = normalizeText(value);
  if (s === "pica") return "pica";
  if (s === "sosovi" || s === "sosevi") return "sosovi";
  if (s === "dodaci") return "dodaci";
  return "pizza";
}

export function safeDateTime(value: string) {
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return "-";
  try {
    return new Intl.DateTimeFormat("sr-Latn-ME", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  } catch {
    return d.toLocaleString();
  }
}

export function centsToInput(cents: number): string {
  if (!Number.isFinite(cents)) return "";
  return (Math.max(0, cents) / 100).toFixed(2);
}

export function parseEuroInputToCents(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;
  if (!/^\d+([.]\d{1,2})?$/.test(normalized)) return null;

  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0) return null;

  return Math.round(amount * 100);
}

export function normalizeImageInput(value: string): string {
  return value.trim();
}

export function buildPreviewCandidates(image: string): string[] {
  const raw = image.trim();
  if (!raw) return [];

  const uniq = new Set<string>();
  uniq.add(raw);

  if (raw.startsWith("/")) {
    const file = raw.split("/").filter(Boolean).at(-1) ?? "";
    if (file) uniq.add(`/menu/${file}`);
  }

  return [...uniq];
}

export function isAdminStorageUrl(image: string): boolean {
  const t = image.trim();
  if (!t) return false;
  return t.includes("/storage/v1/object/public/menu-images/admin/");
}

export function normalizeMenuRow(raw: unknown): AdminMenuRow | null {
  if (!isRecord(raw)) return null;

  const id = toStr(raw.id).trim();
  const name = toStr(raw.name).trim();
  const description = toNullableStr(raw.description);
  const category = normalizeCategory(toStr(raw.category));
  const image = toNullableStr(raw.image);
  const created_at = toStr(raw.created_at).trim();

  const centsRaw = raw.price_eur_cents;
  const cents =
    typeof centsRaw === "number" && Number.isFinite(centsRaw)
      ? Math.round(centsRaw)
      : typeof centsRaw === "string" && centsRaw.trim() !== "" && Number.isFinite(Number(centsRaw))
        ? Math.round(Number(centsRaw))
        : null;

  const sortOrder = toNonNegativeInt(raw.sort_order);
  const isActive = toBool(raw.is_active);

  if (!id || !name || cents === null || sortOrder === null || isActive === null) return null;

  return {
    id,
    name,
    description,
    category,
    image,
    price_eur_cents: Math.max(0, cents),
    sort_order: sortOrder,
    is_active: isActive,
    created_at,
  };
}

// ─── API functions ────────────────────────────────────────────────────────────

export async function getSessionToken(): Promise<string> {
  const { data } = await supabaseAdminAuth.auth.getSession();
  const token = typeof data?.session?.access_token === "string" ? data.session.access_token.trim() : "";
  return token;
}

export async function apiGetMenuItems(token: string): Promise<AdminMenuGetResponse> {
  try {
    const res = await fetch(`${ADMIN_API_BASE}/api/admin-menu`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    const body: unknown = await res.json().catch(() => null);

    if (!res.ok) {
      const msg =
        isRecord(body) && typeof body.error === "string" && body.error.trim()
          ? body.error.trim()
          : `HTTP ${res.status}`;
      return { ok: false, error: msg };
    }

    if (isRecord(body) && body.ok === true && Array.isArray(body.items)) {
      const items = body.items.map(normalizeMenuRow).filter((x): x is AdminMenuRow => Boolean(x));
      return { ok: true, items };
    }

    return { ok: false, error: "Neočekivan odgovor sa admin-menu." };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Network request failed";
    return { ok: false, error: msg || "Network request failed" };
  }
}

export async function apiUpsertMenuItem(
  token: string,
  payload: {
    id?: string;
    name?: string;
    description?: string | null;
    category?: MenuCategory;
    image?: string | null;
    price_eur_cents?: number;
    sort_order?: number;
    is_active?: boolean;
  },
): Promise<AdminMenuPostResponse> {
  try {
    const res = await fetch(`${ADMIN_API_BASE}/api/admin-menu`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const body: unknown = await res.json().catch(() => null);

    if (!res.ok) {
      const msg =
        isRecord(body) && typeof body.error === "string" && body.error.trim()
          ? body.error.trim()
          : `HTTP ${res.status}`;
      return { ok: false, error: msg };
    }

    if (isRecord(body) && body.ok === true) {
      const item = normalizeMenuRow(body.item);
      if (!item) {
        return { ok: false, error: "Neočekivan odgovor sa admin-menu (neispravna stavka)." };
      }
      return { ok: true, item };
    }

    return { ok: false, error: "Neočekivan odgovor sa admin-menu." };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Network request failed";
    return { ok: false, error: msg || "Network request failed" };
  }
}

export async function apiUploadMenuImage(
  token: string,
  payload: {
    fileName: string;
    contentType: string;
    base64: string;
    itemName: string;
  },
): Promise<AdminMenuUploadResponse> {
  try {
    const res = await fetch(`${ADMIN_API_BASE}/api/admin-menu?op=image`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action: "upload", ...payload }),
    });

    const body: unknown = await res.json().catch(() => null);

    if (!res.ok) {
      const msg =
        isRecord(body) && typeof body.error === "string" && body.error.trim()
          ? body.error.trim()
          : `HTTP ${res.status}`;
      return { ok: false, error: msg };
    }

    if (
      isRecord(body) &&
      body.ok === true &&
      typeof body.bucket === "string" &&
      typeof body.path === "string" &&
      typeof body.publicUrl === "string"
    ) {
      return {
        ok: true,
        bucket: body.bucket,
        path: body.path,
        publicUrl: body.publicUrl,
      };
    }

    return { ok: false, error: "Neočekivan odgovor sa admin-menu-image." };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Network request failed";
    return { ok: false, error: msg || "Network request failed" };
  }
}

export async function apiDeleteMenuImage(
  token: string,
  payload: { image: string },
): Promise<AdminMenuImageDeleteResponse> {
  try {
    const res = await fetch(`${ADMIN_API_BASE}/api/admin-menu?op=image`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action: "delete", ...payload }),
    });

    const body: unknown = await res.json().catch(() => null);

    if (!res.ok) {
      const msg =
        isRecord(body) && typeof body.error === "string" && body.error.trim()
          ? body.error.trim()
          : `HTTP ${res.status}`;
      return { ok: false, error: msg };
    }

    if (
      isRecord(body) &&
      body.ok === true &&
      typeof body.deleted === "string" &&
      typeof body.bucket === "string"
    ) {
      return { ok: true, deleted: body.deleted, bucket: body.bucket };
    }

    return { ok: false, error: "Neočekivan odgovor sa admin-menu-image." };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Network request failed";
    return { ok: false, error: msg || "Network request failed" };
  }
}

// ─── Editor helpers ───────────────────────────────────────────────────────────

export function editorFromRow(row: AdminMenuRow): EditorState {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    category: row.category,
    image: row.image ?? "",
    priceInput: centsToInput(row.price_eur_cents),
    isActive: row.is_active,
  };
}

export function sortMenuItems(items: AdminMenuRow[]): AdminMenuRow[] {
  return [...items].sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    const cat = normalizeText(a.category).localeCompare(normalizeText(b.category));
    if (cat !== 0) return cat;
    return normalizeText(a.name).localeCompare(normalizeText(b.name));
  });
}

export function getNextSortOrder(items: AdminMenuRow[]): number {
  const maxOrder = items.reduce((max, item) => Math.max(max, item.sort_order), 0);
  return maxOrder + 1;
}
