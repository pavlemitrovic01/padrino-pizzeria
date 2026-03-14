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
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` — obavezno
- `BANKART_*` — obavezno ako su kartice uključene
- `UPSTASH_REDIS_*` — opciono, rate limiting na create-order
- `ADMIN_FALLBACK_EMAIL`, `PUBLIC_SITE_URL`, `TELEGRAM_WEBHOOK_SECRET` — opciono

Detalje vidi u `.env.example` i `RUNBOOK.md`.

---

## Build / test / deploy

- **Build:** `npm run build` (tsc + vite)
- **Test:** `npm test` (Vitest, apiBase, createOrder, money)
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

api/                  # Vercel serverless
├── create-order.ts   # Narudžbina, Bankart, rate limit
├── telegram-new-order.ts
├── bankart-callback.ts
├── bankart-order-status.ts
└── admin-*           # Admin CRUD
```

---

## LOCK-sensitive delovi

Neki fajlovi i sistemi se ne menjaju bez eksplicitnog odobrenja:

- `api/create-order.ts`, `api/bankart-*`, `api/telegram-new-order.ts`
- `src/components/CartDrawer.tsx`
- Payment flow, refund sync, create-order arhitektura

Detalje vidi u `.cursor/rules/lock-list.mdc`.

---

## Dokumentacija

- **RUNBOOK.md** — deploy, env, Telegram, troubleshooting
- **.env.example** — lista env varijabli (bez tajni)
