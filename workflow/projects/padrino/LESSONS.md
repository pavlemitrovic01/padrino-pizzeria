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
**NEXT REVIEW:** potvrđen B8 Phase D (first-try, ×3 ukupno: B10/B10.1/B8).
Sledeći review: posle sledećeg api/_shared/ batch-a.

---

## 2026-05-18 — jsdom per-file docblock: cleanup + .tsx include obavezni (L7)

**PROBLEM:** E4 (prvi DOM/React test u repo-u — `CartDrawer.test.tsx`).
Dve nezavisne "zeleno ali ne stvarno" greške:
(1) `vitest.config.ts` include imao samo `src/**/*.test.ts` — `.tsx` fajl
nikad nije bio discovered. `npm run test` prolazi zeleno sa 0 izvršenih
CartDrawer testova (false green — coverage theater bez ijednog run-a).
(2) `// @vitest-environment jsdom` kao **docblock** (per-file, ne globalni
env) — `@testing-library/react` auto-cleanup ne okida između testova.
DOM se akumulira: drugi `render()` vidi duple elemente iz prethodnog testa
(`TestingLibraryElementError: multiple elements`), padaju B1/B2/C1/C2.

**LEKCIJA:** Per-file jsdom docblock NE povlači automatski cleanup koji
globalni `environment: "jsdom"` + setupFiles povlači. Eksplicitni
`afterEach(cleanup)` je obavezan. I: vitest discovery je ekstenzija-tačan
— `.test.ts` pattern NE hvata `.test.tsx`. "Test prošao" bez "test se
izvršio" je isti false-green rod kao L6 (lokalno zeleno ≠ realnost):
verifikuj broj izvršenih testova, ne samo exit 0.

**PRIMENA:**
- Novi `.tsx` test → potvrdi da je `src/**/*.test.tsx` u
  `vitest.config.ts` include PRE pisanja; posle run-a proveri da se
  očekivani broj testova STVARNO izvršio (ne samo exit 0).
- Per-file `// @vitest-environment jsdom` → uvek + `afterEach(cleanup)`
  iz `@testing-library/react`.
- Import-time throw moduli (npr. `supabaseClient` čita VITE_* env) →
  infrastrukturni `vi.mock` koji pokriva CEO query chain koji komponenta
  zove (uklj. `.maybeSingle()`/`.order()`); nepokrivena metoda =
  unhandled rejection ako useEffect nema try/catch.
- `tsconfig.app.json` exclude mora imati `**/*.test.tsx` mirror od
  `**/*.test.ts` da `tsc -b`/`npm run build` ostane zelen.

**STATUS:** ACTIVE
**NEXT REVIEW:** posle E5 (golden-path E2E) ili sledećeg DOM test batch-a.
