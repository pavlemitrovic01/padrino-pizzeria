# AI Lessons Learned

Self-improvement log. Format: datum → problem → lekcija → primena →
status → next review.

Deprecated entries → `DECISIONS.md` "Deprecated Lessons" section.

---

## 2026-05-10 — OneDrive is not for code repos (L0)

**PROBLEM:** Source code stored in OneDrive sync folder caused multiple failures: file lock conflicts during git operations, online-only placeholder files appearing as deleted when offline, mass deletion when web-deleting cascades to all synced devices, node_modules folder trying to sync 10000+ files. Real incident: web deletion of OneDrive files caused panic about losing entire portfolio (recovered from GitHub + Recycle Bin, but no work was actually lost).

**LEKCIJA:** Source-of-truth for code is GitHub. Local working copy goes in `C:\dev\<projekat>`, never in `OneDrive\Desktop\*` or `OneDrive\Documents\*`. OneDrive is for photos, documents, tax files — not for code.

**PRIMENA:** Pre svake nove sesije rada na bilo kom projektu: clone fresh from GitHub to `C:\dev\<projekat>`, work there, push regularly. Even if local copy gets lost/corrupted, GitHub has truth.

**STATUS:** ACTIVE
**NEXT REVIEW:** —

---

## 2026-03-22 — VITE_ADMIN_API_BASE pitfall (L1)

**PROBLEM:** `.env.example` is documentation only — Vite does NOT load it for `import.meta.env`. Admin login failed in local dev because `VITE_ADMIN_API_BASE` was only in `.env.example`, not in actual Vite-loaded env file.

**LEKCIJA:** Real Vite env files: `.env`, `.env.local`, `.env.development`, `.env.development.local` (later overrides earlier). Must be in app root where `vite.config.ts` lives. After ANY `.env*` change → restart `npm run dev`.

**PRIMENA:** Symptom = Network shows `http://localhost:5173/api/admin-me` (relative) → check `VITE_ADMIN_API_BASE` presence in actual loaded file + restart Vite.

**STATUS:** ACTIVE
**NEXT REVIEW:** —

---

## 2026-02 — PUBLIC_SITE_URL never VERCEL_URL (L2)

**PROBLEM:** Internal server-to-server calls under Vercel Protection fail when using `process.env.VERCEL_URL` because Vercel injects auth check that blocks server-to-server requests without bypass token.

**LEKCIJA:** Always use `PUBLIC_SITE_URL` env (set explicitly to public domain) for any internal API call. Never construct URL from `VERCEL_URL`.

**PRIMENA:** New server-to-server endpoint? Use `process.env.PUBLIC_SITE_URL` with explicit fallback. Never construct from `VERCEL_URL` even as fallback.

**STATUS:** ACTIVE
**NEXT REVIEW:** —

---

## 2026-02 — Telegram is notification, never transaction (L3)

**PROBLEM:** Initial implementation could let Telegram failures block order DB writes. Real customer orders at risk if Telegram API down.

**LEKCIJA:** Telegram (and any external notification) is best-effort. Order DB write must succeed regardless of notification outcome. Notification has bounded timeout (12s in current code) and dispatched in best-effort try/catch with logging.

**PRIMENA:** Any new notification channel:
- DB write FIRST, commit, success path returned
- Notification AFTER, in best-effort wrapper
- Timeout strictly bounded
- Failure logged, not propagated
- Notification result included in response only as informational

**STATUS:** ACTIVE
**NEXT REVIEW:** —
