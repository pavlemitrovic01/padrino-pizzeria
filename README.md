# Padrino Pizzeria — Picerija i dostava u Budvi

Web aplikacija za online narudžbe pizze. Frontend (React + Vite), backend (Vercel serverless), Supabase (DB + auth), Telegram notifikacije, Bankart plaćanja.

---

## Stack

- **Frontend:** React 19, Vite 7, TypeScript, Tailwind CSS, Framer Motion
- **Backend:** Vercel serverless (`api/*`), Node.js
- **DB / Auth:** Supabase (PostgreSQL, Auth)
- **Notifikacije:** Telegram (best-effort)
- **Plaćanja:** Bankart (gotovina + kartica)
- **Testovi:** Vitest

---

## Skripte

| Komanda | Opis |
|---------|------|
| `npm run dev` | Lokalni dev server (localhost:5173) |
| `npm run build` | Production build |
| `npm test` | Pokretanje testova |
| `npm run lint` | ESLint |
| `npm run preview` | Preview production build-a |

---

## Lokalni setup

1. Kloniraj repo
2. `npm install`
3. Kopiraj `.env.example` u `.env.local`
4. Popuni env varijable (vidi sekciju ispod)
5. `npm run dev`

---

## Env varijable (pregled)

**Frontend (VITE_ prefiks):**
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — obavezno
- `VITE_API_BASE_URL` — opciono, override API base u dev-u
- `VITE_CARD_PAYMENTS_ENABLED`, `VITE_BANKART_PAYMENTJS_*` — opciono, kartična plaćanja

**Server (api/*):**
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — obavezno
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` — obavezno (poruke kuhinji šalju handleri direktno, B24)
- `PUBLIC_SITE_URL` — obavezno u Production (`https://padrinobudva.com`; Bankart return/callback URL-ovi)
- `BANKART_*` — obavezno ako su kartice uključene
- `UPSTASH_REDIS_*` — obavezno u Production: bez njih create-order radi bez rate limita
- `ADMIN_FALLBACK_EMAIL` — opciono

Detalje vidi u `.env.example` i `RUNBOOK.md`.

---

## Build / test / deploy

- **Build:** `npm run build` (tsc + vite)
- **Test:** `npm test` (Vitest — server handleri, klijent↔server parity, korpa/checkout)
- **Lint:** `npm run lint`
- **Deploy:** Vercel (`vercel --prod`), env na Vercel dashboardu

---

## Mapa sistema

```
src/
├── main.tsx          # Entry, ErrorBoundary, CartProvider, AuthProvider
├── App.tsx           # Routing, admin guard, SEO
├── components/       # Navbar, CartDrawer, AdminOrders, ...
├── sections/         # Hero, Menu, Delivery, Contact, ...
├── pages/admin/      # AdminLogin, AdminMenu, AdminSettings, ...
├── lib/              # apiBase, adminApiBase, createOrder, money, supabase
├── context/          # CartProvider, useCart
└── auth/             # AuthProvider

api/                  # Vercel serverless (10 funkcija; Hobby limit 12)
├── create-order.ts   # Narudžbina: provere, cena sa servera, dostava po zoni, Bankart, rate limit
├── bankart-callback.ts
├── bankart-order-status.ts
├── log.ts            # Klijentski logovi + CSP prijave
├── admin-*           # Admin CRUD
└── _shared/          # telegram, order-items, bankart-debit, delivery-zones, payment-status, env, http, …
```

---

## LOCK-sensitive delovi

Neki fajlovi i sistemi se ne menjaju bez eksplicitnog odobrenja:

- `api/create-order.ts`, `api/bankart-*`, `api/_shared/telegram.ts`, `api/_shared/order-items.ts`, `api/_shared/bankart-debit.ts`
- `src/components/CartDrawer.tsx`
- Payment flow, refund sync, create-order arhitektura

Detalje vidi u `.cursor/rules/lock-list.mdc`.

---

## Dokumentacija

- **RUNBOOK.md** — deploy, env, Telegram, troubleshooting
- **.env.example** — lista env varijabli (bez tajni)
