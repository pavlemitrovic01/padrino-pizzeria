# TEMPLATE.md — Padrino as a clone-and-adapt reference

## Šta je ovo (i šta NIJE)

Padrino je production ordering/payment app za jednu pizzeriju (padrinobudva.com).
Ovaj fajl je vodič za **clone-and-adapt** — uzmeš repo, swap-uješ brand/menu/env,
deploy-uješ za drugog klijenta.

**NIJE** shared library, NPM paket, ni monorepo. Pravi shared template (J2)
čeka stvarni app#2 — šablonizacija dolazi iz poređenja dva stvarna proizvoda,
ne iz preuranjene apstrakcije. Vidi DECISIONS 2026-05-17 ("refactor not rewrite")
i ROADMAP exit criterion #8.

Refactor-to-9 program (Faze A–I, J1 finale) je doveo strukturu na template-grade:
no file >800 LOC, hostile-input tests, HMAC verified, RLS closed, CORS locked, logger
active. Exit criteria #1–#7 sve zatvorene — ovo je #8.

---

## Stack snapshot

| Layer | Tehnologija | Verzija |
|-------|-------------|---------|
| Frontend | React | 19.2.0 |
| Language | TypeScript (strict) | 5.9.3 |
| Bundler | Vite | 7.2.4 |
| Styling | Tailwind CSS | 3.4.19 |
| Animation | Framer Motion | 12.29.0 |
| Backend | Vercel Serverless (`api/`) | — |
| DB + Auth | Supabase PostgreSQL + RLS | — |
| Payment | Bankart Payment.js + redirect fallback | — |
| Notifications | Telegram bot (best-effort) | — |
| Rate limiting | Upstash Redis + in-memory fallback | — |
| Testing | Vitest | — |
| Deploy | Vercel | — |
| Security headers | vercel.json (HSTS, X-Content-Type-Options) | — |

---

## Reusable vs Project-specific

### Reusable — zadrži bez izmena

Ovi moduli sadrže pattern, ne vrednosti. Pri kloniranju preuzmi ih as-is.

| Modul / pattern | Lokacija | Šta sadrži |
|-----------------|----------|------------|
| CORS env-driven allowlist | `api/_shared/cors.ts` | `applyCors()` + VERCEL_URL preview auto-allow (I2) |
| Admin auth + membership | `api/_shared/admin-auth.ts` | Bearer token + `admin_users` DB lookup (B10) |
| Parsing utils (api/) | `api/_shared/parsing.ts` | `isPlainObject`, `safeInt`, `safeNumber`, `normalizeText` |
| Public URL resolver | `api/_shared/public-url.ts` | `trustOriginHeader=false` security lock (B8) |
| Config shape (api/) | `api/_shared/config.ts` | 5 exports — shape, ne vrednosti (swap point F4) |
| Parsing utils (src/) | `src/lib/parsing.ts` | `isRecord`, `isPlainObject`, `safeString`, `normalizeText` (F1) |
| Money coercion | `src/lib/money.ts` | `toSafeInt` — canonical money-path coercion |
| Config shape (src/) | `src/lib/config.ts` | `DELIVERY_ZONES` type, `SITE_URL` — shape, ne vrednosti (F4.1) |
| HMAC verification pattern | `api/bankart-callback.ts` | Timing-safe + 5min skew bound, per B14 audit |
| CAS atomicity guard | `api/admin-update-order-status.ts` | `.eq("status", fromStatus)` guard (B16) |
| RLS membership policy | Supabase (via migrations) | EXISTS-based `admin_users` membership, bez hardkodovanih email-ova (I1) |

### Project-specific — zameni pri kloniranju

| Šta | Gde | Napomena |
|-----|-----|----------|
| Brand assets | `src/assets/`, `public/`, `index.html` favicon/og meta | Sve slike, logo, favicon |
| Menu podaci | Supabase `menu_items` tabela | Seed per klijent |
| Sekcije / copy | `src/sections/*` (Hero, About, Contact, itd.) | Tekst i copy |
| Delivery zone vrednosti | `src/lib/config.ts` → `DELIVERY_ZONES` | Zadržaj tip, promeni vrednosti |
| Billing fallbacks | `api/_shared/config.ts` → `BANKART_FALLBACK_CITY/POSTCODE/EMAIL` | Zadržaj shape, promeni vrednosti |
| Bankart opis plaćanja | `api/_shared/config.ts` → `BANKART_DESCRIPTION_PREFIX` | Npr. "Padrino Budva order" → "My App order" |
| Domain | `api/_shared/config.ts` → `DEFAULT_PUBLIC_HOST` | Tvoj production domain |
| Site URL | `src/lib/config.ts` → `SITE_URL` | Tvoj production domain (SEO) |
| Billing defaulti | `src/lib/config.ts` → `DEFAULT_BILLING_CITY/POSTCODE` | Grad/poštanski broj klijenta |
| Supabase project | `.env` → `VITE_SUPABASE_URL`, `SUPABASE_URL`, itd. | Nov Supabase project per klijent |
| Telegram bot | `.env` → `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Nov bot per klijent |
| CORS origins | `.env` → `ALLOWED_ORIGINS` | Production + preview domeni |
| Bankart credentials | `.env` → `BANKART_API_*`, `BANKART_SHARED_SECRET` | Merchant onboarding per klijent |
| SEO landing (opciono) | `pizza-budva.html`, `src/sections/PizzaBudvaPage.tsx` | Lokacija-specifični SEO stub |

### Dead / skip on clone — ne kopiraj pattern, ne pokušavaj da popraviš

| Šta | Razlog |
|-----|--------|
| GPS delivery polygon path | `delivery_zones` tabela ne postoji u prod DB; klijent nikad ne šalje lat/lng — arhitekturalno mrtvo (B2/F2 won't-execute) |
| Legacy Telegram DB trigger | Dropnut B15; Vercel Protection blokirao 401 sve pozive |
| Edge functions `admin-orders` + `telegram-new-order` | Deletovani B12; `payments-create-session` ostaje |

---

## Canonical env manifest

Svi env vars koji se čitaju u production kodu. Redosled = scope, pa required/optional.
Aliases (legacy NLB_*, SUPABASE_SERVICE_KEY) nisu dokumentovani — postoje kao fallback
u kodu ali ne treba ih postavljati na klonu.

### Frontend (Vite build-time + browser runtime, `VITE_` prefiks)

| Var | Required | Default ako nedostaje | Source |
|-----|----------|----------------------|--------|
| `VITE_SUPABASE_URL` | **YES** | — (runtime error) | `src/lib/supabaseClient.ts` |
| `VITE_SUPABASE_ANON_KEY` | **YES** | — (runtime error) | `src/lib/supabaseClient.ts` |
| `VITE_BANKART_PAYMENTJS_ENABLED` | optional | kartice isključene | `src/hooks/cart/useBankartPaymentJs.ts` |
| `VITE_BANKART_PAYMENTJS_PUBLIC_KEY` | if ENABLED | — (nema PaymentJS init) | `src/hooks/cart/useBankartPaymentJs.ts` |
| `VITE_API_BASE_URL` | optional | same-origin `/api` | `src/lib/apiBase.ts` |
| `VITE_BUILD_SHA` | **auto** (Vercel build) | `"unknown"` lokalno | `vite.config.ts` ← `VERCEL_GIT_COMMIT_SHA` |

> `VITE_BUILD_SHA` ne postavljaš ručno — `vite.config.ts` ga injektuje iz
> `VERCEL_GIT_COMMIT_SHA` (Vercel system var). Na lokalnom dev-u dobija `"unknown"`.

### Vercel server (`api/*`, `process.env`)

**Supabase:**

| Var | Required | Default ako nedostaje | Source |
|-----|----------|----------------------|--------|
| `SUPABASE_URL` | **YES** | — (sve api/ funkcije pucaju) | svi api/ handleri |
| `SUPABASE_SERVICE_ROLE_KEY` | **YES** | — (sve api/ funkcije pucaju) | svi api/ handleri |

**Telegram:**

| Var | Required | Default ako nedostaje | Source |
|-----|----------|----------------------|--------|
| `TELEGRAM_BOT_TOKEN` | **YES** (notifikacije) | notifikacije tiho padaju | `api/telegram-new-order.ts` |
| `TELEGRAM_CHAT_ID` | **YES** (notifikacije) | notifikacije tiho padaju | `api/telegram-new-order.ts` |
| `TELEGRAM_WEBHOOK_SECRET` | optional | bez HMAC provere webhook-a | `api/create-order.ts` |

> Telegram je best-effort — nikad ne blokira transakciju. Bez tokena narudžba prolazi,
> notifikacija ne stiže.

**Bankart (kartična plaćanja):**

| Var | Required | Default ako nedostaje | Source |
|-----|----------|----------------------|--------|
| `BANKART_SHARED_SECRET` | **YES** (HMAC) | callback odbijen | `api/bankart-callback.ts` |
| `BANKART_API_KEY` | **YES** (plaćanja) | Bankart API pozivi pucaju | `api/create-order.ts` |
| `BANKART_API_USERNAME` | **YES** (plaćanja) | Bankart API pozivi pucaju | `api/create-order.ts` |
| `BANKART_API_PASSWORD` | **YES** (plaćanja) | Bankart API pozivi pucaju | `api/create-order.ts` |
| `BANKART_API_BASE_URL` | optional | `https://gateway.bankart.si/api/v3` | `api/create-order.ts` |
| `BANKART_LANGUAGE` | optional | `en` | `api/create-order.ts` |
| `BANKART_CALLBACK_MAX_SKEW_SECONDS` | optional | `300` (5 min) | `api/bankart-callback.ts` |
| `BANKART_STATUS_MIN_INTERVAL_SECONDS` | optional | `15` | `api/bankart-order-status.ts` |

**Edge function poziv (payments-create-session, iz api/create-order.ts):**

| Var | Required | Default ako nedostaje | Source |
|-----|----------|----------------------|--------|
| `SUPABASE_PROJECT_REF` | YES (edge fn) | edge fn se ne poziva | `api/create-order.ts` |
| `SUPABASE_ANON_KEY` | YES (edge fn) | edge fn se ne poziva | `api/create-order.ts` |
| `PAYMENTS_EDGE_TOKEN` | YES (edge fn) | poziv bez autorizacije | `api/create-order.ts` |

**Rate limiting (opciono):**

| Var | Required | Default ako nedostaje | Source |
|-----|----------|----------------------|--------|
| `UPSTASH_REDIS_REST_URL` | optional | in-memory fallback (fail-open) | `api/create-order.ts` |
| `UPSTASH_REDIS_REST_TOKEN` | optional | in-memory fallback (fail-open) | `api/create-order.ts` |

**Admin + security:**

| Var | Required | Default ako nedostaje | Source |
|-----|----------|----------------------|--------|
| `ADMIN_FALLBACK_EMAIL` | optional break-glass | bez fallback admina | `api/_shared/admin-auth.ts` |
| `PUBLIC_SITE_URL` | optional | izvodi se iz request headera | `api/_shared/public-url.ts` |
| `ALLOWED_ORIGINS` | **YES** (production) | sve origins odbijene | `api/_shared/cors.ts` |

**Vercel auto-env (ne postavljaš ručno):**

| Var | Ko postavlja | Gde se koristi |
|-----|-------------|----------------|
| `VERCEL_ENV` | Vercel automatski | `api/_shared/cors.ts` (preview allow) |
| `VERCEL_URL` | Vercel automatski | `api/_shared/cors.ts` (preview allow) |
| `VERCEL_GIT_COMMIT_SHA` | Vercel automatski | `vite.config.ts` → `VITE_BUILD_SHA` |

### Edge function (`supabase/functions/payments-create-session/`, Deno env)

| Var | Required | Default ako nedostaje | Source |
|-----|----------|----------------------|--------|
| `SUPABASE_URL` | **YES** | — | `supabase/functions/payments-create-session/index.ts` |
| `SUPABASE_SERVICE_ROLE_KEY` | **YES** | — | `supabase/functions/payments-create-session/index.ts` |
| `PAYMENTS_EDGE_TOKEN` | optional (guard) | bez token provere | `supabase/functions/payments-create-session/index.ts` |

> Supabase automatski ubacuje `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` u edge
> funkcije. `PAYMENTS_EDGE_TOKEN` postavljaš kao Supabase Secret.

---

## Clone-and-adapt steps

1. **Fork/clone** repo na novu git remote (GitHub/GitLab).
2. **Supabase project** — provision novi project; kopiraš URL + anon key + service role key.
3. **Migracije** — `supabase/migrations/*` pokreni na novom projektu (`supabase db push`
   ili Supabase dashboard SQL editor).
4. **Seed DB** — `business_settings`, `admin_users`, `menu_items` tabele.
5. **Brand assets** — swap `src/assets/`, `public/`, `index.html` og/meta, favicon.
6. **Copy** — `src/sections/*` (HeroSection, About, Contact, itd.) per klijent.
7. **Config vrednosti** — `src/lib/config.ts` (DELIVERY_ZONES vrednosti, SITE_URL,
   DEFAULT_BILLING_CITY/POSTCODE) + `api/_shared/config.ts` (BANKART_FALLBACK_*,
   DEFAULT_PUBLIC_HOST). Ovo su template swap pointovi — ne treba da menjaš ništa drugo.
8. **Env vars** — postavi sve required vars u Vercel dashboard za All Environments.
   Posebna pažnja: `ALLOWED_ORIGINS` mora uključiti production domain.
9. **Bankart onboarding** — merchant credentials u env; `BANKART_SHARED_SECRET` MORA biti
   nešto jako slučajno, nije isti za svakog klijenta.
10. **Telegram bot** — novi bot per klijent (BotFather); token + chat ID u env.
    Referenca: `RUNBOOK.md` §1.
11. **Deploy preview** — `vercel deploy`; smoke test po `DEPLOYMENT_CHECKLIST.md`.
12. **DNS + production** — DNS switch na Vercel; production smoke; monitor Vercel Runtime Logs
    (I3 server log sink active na `api/log.ts`).
13. **CORS verify** — potvrdi da `ALLOWED_ORIGINS` sadrži production domain; preview domain
    je auto-allowed via `VERCEL_URL` (cors.ts:65-67).

---

## Known limitations & coupling

- **Vercel Hobby plan: hard 12-function cap.** Padrino trenutno na 10/12 posle I2.2
  reclaim. Ako dodaš novi handler, planiraj slot reclaim ili upgrade na Pro.
- **Bankart-only payment vendor.** HMAC + callback shape su Bankart-specific u
  `api/bankart-callback.ts` + `api/bankart-order-status.ts`. Zamena payment gateway-a
  je moguća ali zahteva STRICT-tier rework oba lock-zone fajla.
- **Supabase RLS pretpostavlja `admin_users` tabelu.** RLS membership policy (I1) radi
  na EXISTS-based check. Bez te tabele admin endpoints fail-shut po design-u.
- **Telegram je best-effort.** Narudžba prolazi i bez Telegram notifikacije. Ako
  `TELEGRAM_BOT_TOKEN` nedostaje, log greška, nastavlja.
- **L6 (NodeNext): api/_shared/* importi MORAJU koristiti `.js` extension** pri
  importovanju unutar `api/`. Ovo je Vercel Node.js ESM zahtev — ne menjaj na `.ts`.
- **`VITE_CARD_PAYMENTS_ENABLED`** postoji kao type u `CartDrawer.tsx` ali je deprecated.
  Koristi `VITE_BANKART_PAYMENTJS_ENABLED` + `VITE_BANKART_PAYMENTJS_PUBLIC_KEY` pair.

---

## References

- [`RUNBOOK.md`](RUNBOOK.md) — production ops (Telegram, Vercel deploy, env troubleshooting)
- [`DEPLOYMENT_CHECKLIST.md`](DEPLOYMENT_CHECKLIST.md) — pre-deploy checklist
- [`workflow/projects/padrino/CONTEXT.md`](workflow/projects/padrino/CONTEXT.md) — arhitektura, lock zone, source of truth
- [`workflow/projects/padrino/DECISIONS.md`](workflow/projects/padrino/DECISIONS.md) — refactor-not-rewrite rationale (2026-05-17), F2 won't-execute, B12 edge decision
- [`workflow/projects/padrino/ROADMAP.md`](workflow/projects/padrino/ROADMAP.md) — exit criteria #1–#8, Faza J

---

## Exit criterion #8 — closed by J1

Ovaj fajl postoji + env manifest je u sync-u sa kodom (grep-verified). Zatvoreno
J1 (STANDARD, doc-only, 2026-05-22).

Full 9.0/10 ostaje claim do J2 — template je dokazan tek kad app#2 bude uspešno
kloniran iz Padrina. Do tada: max iskren self-score = **8.5/10**.
