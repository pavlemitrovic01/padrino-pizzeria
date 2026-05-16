// api/_shared/admin-auth.ts
//
// Shared admin-auth DB lookup. Consolidates 5 prior duplicate copies:
//   - getAdminFromDb       (byte-identical): admin-menu, admin-menu-image,
//                                            admin-users, admin-settings
//   - getAdminRoleFromDb   (behavior-equivalent variant): admin-me
//
// Self-contained by design: this module inlines its own normalizeEmail /
// isFallbackAdmin / looksLikeMissingTable / isAdminRole copies so the callers'
// local low-level helpers stay untouched (they remain used elsewhere in each
// handler; deduping those is a separate future batch — admin-api-duplication
// audit §7 step 1). The caller MUST pass its OWN per-endpoint supabase admin
// client so the per-endpoint X-Client-Info header is preserved (audit §6).
//
// First module under api/_shared/ (B10). Vercel does not route files whose
// path segment starts with "_", but sibling functions may import them.

import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminRole = "owner" | "staff";

export type AdminLookup = {
  table: "ok" | "missing" | "error";
  isAdmin: boolean;
  role: AdminRole | null;
};

function toTrimmedString(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function getEnv(name: string): string {
  return toTrimmedString(process.env[name]);
}

function normalizeEmail(v: string): string {
  return v.trim().toLowerCase();
}

function isFallbackAdmin(email: string): boolean {
  const fallback = normalizeEmail(getEnv("ADMIN_FALLBACK_EMAIL"));
  return !!fallback && fallback === normalizeEmail(email);
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

/**
 * Resolve admin status + role for an email against the `admin_users` table.
 *
 * Behavior is the GUARDED variant (early-return on empty/whitespace email).
 * This is a behavior-preserving superset of all 5 prior copies:
 *  - admin-menu / admin-menu-image / admin-users / admin-settings:
 *    their getAdminFromDb was byte-identical to this (guard included).
 *  - admin-me's getAdminRoleFromDb had NO empty guard, but its call site
 *    (api/admin-me.ts) returns 401 on empty email BEFORE invoking this, so
 *    the guard is an unreachable branch there → zero behavior change.
 *
 * The caller passes its own per-endpoint admin client (preserves
 * X-Client-Info telemetry). This function performs no client construction.
 */
export async function getAdminFromDb(
  supabase: SupabaseClient,
  email: string,
): Promise<AdminLookup> {
  const e = normalizeEmail(email);
  if (!e) return { table: "ok", isAdmin: false, role: null };

  const { data, error } = await supabase
    .from("admin_users")
    .select("email, role, enabled")
    .eq("email", e)
    .maybeSingle();

  if (error) {
    if (looksLikeMissingTable(error)) {
      const fallback = isFallbackAdmin(e);
      return { table: "missing", isAdmin: fallback, role: fallback ? "owner" : null };
    }
    return { table: "error", isAdmin: false, role: null };
  }

  const enabled = typeof data?.enabled === "boolean" ? data.enabled : false;
  const role = isAdminRole(data?.role) ? data.role : null;

  if (!enabled) return { table: "ok", isAdmin: false, role: null };
  return { table: "ok", isAdmin: true, role: role ?? "staff" };
}
