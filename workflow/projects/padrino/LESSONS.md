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

---

## 2026-05-12 — safeNumber("", fallback) vraća 0, ne fallback (L4)

**PROBLEM:** `safeNumber(getFirstEnv("BANKART_CALLBACK_MAX_SKEW_SECONDS"), 300)` vraća 0 kada
env var nije postavljen. Razlog: `getFirstEnv()` vraća `""`, `Number("") = 0`,
`Number.isFinite(0) = true` → fallback 300 nikada ne aktivira. Efektivno:
skew prozor srušen na `Math.max(30, 0) = 30s`, ne 300s. Otkriven u B4 kada
je test "60s in past" padao bez BANKART_CALLBACK_MAX_SKEW_SECONDS stub-a.
Isti bug na 2 call sites: bankart-callback.ts (skew) i bankart-order-status.ts
(rate limit interval).

**LEKCIJA:** `Number("") === 0` u JavaScript-u. `safeNumber(v, fallback)` fallback
se aktivira samo za NaN/Infinity — ne za prazan string. Empty string env var
prolazi kao 0, ne kao defaultna vrednost. Guard pattern koji radi:
`safeNumber(getEnv("X") || "300", 300)` — prazan string pada na string "300"
pre prosleđivanja u safeNumber.

**PRIMENA:** Svaki numerički env var gde 0 nije validna vrednost (timeout, skew,
rate-limit, interval): koristiti `getEnv("X") || "defaultVrednost"` pre
prosleđivanja u safeNumber. Ili eksplicitno setovati env var na Vercel.
Ne oslanjati se na fallback argument safeNumber za env-var-derived stringove.

**STATUS:** ACTIVE — B4.1 DONE (2026-05-12). Code fix deployed. Vercel env vars
  BANKART_CALLBACK_MAX_SKEW_SECONDS=300 i BANKART_STATUS_MIN_INTERVAL_SECONDS=15
  ostavljeni kao belt-and-suspenders (harmless).
**NEXT REVIEW:** —

---

## 2026-05-12 — Nikad ne prosleđuj sirovu err.message klijentu (L5)

**PROBLEM:** `api/create-order.ts` vraćao raw `err.message` (Postgres constraint names,
Bankart `adapterCode`/`adapterMessage`, ENOTFOUND hostname-e) direktno u JSON response
koji browser prikazuje korisniku. Verifikovano B11 audit — 2 leak site-a:
DB insert catch (Postgres schema details) i top-level catch (Bankart/network/DB re-throw).

**LEKCIJA:** Sve 500 error responses prema browser klijentu moraju koristiti generic
user-friendly poruku. `console.error` zadržava pun context za Vercel ops triage.
Nikad: `{ error: err.message }` ili `{ error: String(err) }` na server-browser granici.
Razdvoji "šta vidi korisnik" od "šta vidi devops".

**PRIMENA:** Svaki novi API endpoint koji može throwati izuzetak:
- Top-level catch: `console.error("[endpoint] failed:", err)` za ops
- Response: `json(res, 500, { ok: false, error: GENERIC_MSG })` za klijenta
- Pattern: `clientSafeError(err, kind)` iz `api/create-order.ts` kao referentni primjer
- Izuzetak: server-to-server pozivi (Bankart callback → gateway, admin-only)
  imaju drugačiji threat model — mogu biti granularniji
- Validacioni 400 errors su intentionalno user-facing — ne sanitizuju se

**STATUS:** ACTIVE
**NEXT REVIEW:** —

---

## 2026-05-16 — Lokalni machine gates ≠ Vercel api/ build; STRICT preview smoke je pravi gate (L6)

**PROBLEM:** B10 (prvi `api/_shared/` modul ikad) — lokalni `npm run typecheck`/
`lint`/`test`/`build` svi 4/4 zeleni, ali Vercel preview build PUKAO sa TS2835
na svih 5 handlera: `@vercel/node` kompajlira `api/` funkcije sa
`moduleResolution: node16/nodenext` (zahteva eksplicitnu `.js` ekstenziju na
relativnim ESM importima), dok lokalni `tsc -b` koristi `tsconfig.node.json`
→ `moduleResolution: "Bundler"` (ne zahteva ekstenziju). Dodatno: ROADMAP
napomena "api/** je u eslint ignore" bila netačna — eslint lintuje `api/`,
pa je dedup koji osiroti helpere oborio lint gate (14 no-unused-vars).
Dve nezavisne "zeleno lokalno ≠ realnost" greške u jednom batch-u.

**LEKCIJA:** Lokalni gate-ovi NE dokazuju Vercel serverless build. Za bilo
koju `api/` izmenu sa relativnim cross-file importom: koristi `.js`
ekstenziju (resolvuje se na `.ts` i pod Bundler i pod nodenext). Tvrdnje iz
dokumentacije/memorije o tooling scope-u (šta lint/tsc pokriva/ignoriše)
moraju se verifikovati protiv stvarnog buildera PRE ulaska u plan ZABRANA —
repo/builder > dokumentacija. STRICT preview smoke nije formalnost: ovde je
uhvatio dve greške koje su sva 4 lokalna gate-a propustila.

**PRIMENA:**
- Novi relativni import u `api/**` → odmah `.js` ekstenzija (`./_shared/x.js`).
- Bilo koja `api/_shared/` izmena (B8, B10.1, buduće) → OBAVEZAN preview
  deploy + Build Logs provera (TS2835/error lines) PRE smoke i PRE merge.
- Dedup refaktor → orphan-cleanup helpera/tipova u ISTOM batch-u (kaskada),
  nije scope creep; pokreni ciljni lint da potvrdiš tooling scope.

**STATUS:** ACTIVE
**NEXT REVIEW:** posle B10.1 / B8 (potvrda da je `.js` pattern usvojen)
