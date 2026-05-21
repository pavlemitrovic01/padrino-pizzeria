# AI Lessons Learned

Self-improvement log. Format: datum → problem → lekcija → primena →
status → next review.

Deprecated entries → `DECISIONS.md` "Deprecated Lessons" section.

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
- Komponente koje pozivaju `window.location.assign` (navigacija) →
  `vi.stubGlobal("location", { pathname:"/", search:"", assign:vi.fn(), replace:vi.fn(), reload:vi.fn() })`
  u `beforeEach` + `vi.unstubAllGlobals()` u `afterEach`. Stub mora zadržati
  `pathname`/`search` jer ih CartDrawer čita na init (prazni stringovi OK).
  `vi.spyOn(window.location, "assign")` NIJE dovoljan — jsdom Location je
  non-configurable; jedino `vi.stubGlobal` pouzdano radi.

**STATUS:** ACTIVE — E5 dopuna 2026-05-18 (window.location.assign pattern).
**NEXT REVIEW:** posle sledećeg DOM test batch-a (Faza G).

---

## 2026-05-21 — Vercel Hobby plan: svaki `api/*.ts` = 1 funkcija (max 12) (L8)

**PROBLEM:** I3 dodao `api/log.ts` bez praćenja ukupnog broja serverless funkcija. Sa 12 postojećih + 1 nova = 13, Vercel Hobby plan odbio deploy za sve buduće branch-eve: "No more than 12 Serverless Functions can be added to a Deployment on the Hobby plan." Blokirani I3 i I4 preview deploy-i; production nije pogođen (main ostao na I2.1).

**LEKCIJA:** Na Vercel Hobby planu max 12 serverless funkcija po deploy-u. Svaki `.ts` fajl u `api/` root-u postaje zasebna funkcija — test fajlovi (`*.test.ts`) se ne računaju. Pratiti count pre dodavanja novog handlera. Konsolidacija via `?op=` query routing je besplatno rešenje: dva logički srodna handlera → jedan fajl sa internim grananjem. Ne zahteva Pro plan, ne gubi funkcionalnost.

**PRIMENA:**
- Pre dodavanja novog `api/*.ts` handlera: `ls api/*.ts | grep -v test | wc -l` → mora biti ≤11 da ima mesta.
- Konsolidacija pattern: `?op=resend-telegram` u admin-orders, `?op=image` u admin-menu. Svaki op-handler je interna funkcija, auth prolazi pre grananja.
- Ako count pređe 10: razmatrati konsolidaciju proaktivno pre nego što hit limit blokira deploy.
- Pro plan rešava limit (unlimited functions) ali nije potreban dok ima slobodnih slotova.

**STATUS:** ACTIVE
**NEXT REVIEW:** kada count dostigne 10 funkcija.
