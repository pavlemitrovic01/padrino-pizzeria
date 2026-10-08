# Padrino Pizzeria — RUNBOOK
Production / Development / Debug Guide

Ovaj dokument je izvor istine za:
- deploy
- environment varijable
- Telegram notifikacije
- Supabase integraciju
- lokalni dev vs production razlike
- najčešće greške i njihova rješenja

Cilj: da se nikad više ne gubi vrijeme na iste probleme.

---

## 1) Arhitektura (kratko i tačno)

Flow porudžbine:

1. Frontend (Vite + React) validira i šalje porudžbinu
2. `api/create-order.ts` — cena svake stavke iz `menu_items`, dostava iz serverske
   tabele zona (`api/_shared/delivery-zones.ts`), upisuje order u Supabase `orders`
   (jedan pokušaj = jedna porudžbina: `idempotency_key`)
3. Nakon uspješnog DB write-a (gotovina) ili kad Bankart potvrdi plaćanje
   (kartica), handler direktno zove `notifyNewOrder()` iz
   `api/_shared/telegram.ts` — atomski claim na `telegram_notified_at`, pa
   slanje u Telegram (7s timeout). Nema self-HTTP poziva ni endpoint-a (B24).
4. Telegram je **notifikacija**, ne dio transakcije

❗ Telegram failure **nikad ne smije blokirati order**

### 1.1 DB trigger `telegram-new-order` — REMOVED (B15, 2026-05-12)

Trigger je bio mrtav kod na `orders` tabeli (AFTER INSERT). Pozivao je
`https://padrino-pizzeria.vercel.app/api/telegram-new-order` (5s timeout)
koji je pod Vercel Deployment Protection → 401. Nikada nije funkcionisao;
verifikovano produkcijskim logovima 2026-05-11 nad 3 porudžbine
(padrinobudva.com/api/telegram-new-order → 200 via `create-order.ts`,
padrino-pizzeria.vercel.app/api/telegram-new-order → 401 via trigger).

**Removed via:** `supabase/migrations/20260512150000_drop_telegram_trigger.sql`
(`DROP TRIGGER IF EXISTS`).

**Aktivni Telegram flow:** `notifyNewOrder()` (`api/_shared/telegram.ts`),
pozivaju ga create-order, bankart-callback i bankart-order-status — vidi §1 i §6.
Endpoint `api/telegram-new-order` je obrisan u B24.

---

## 2) Environment variables (OBAVEZNO 1:1)

**Setup:** Kopiraj `.env.example` u `.env.local` i popuni stvarne vrednosti. Na Vercel-u postavi env u dashboardu. Supabase Edge funkcija više nema u repou (`payments-create-session` obrisana u B24; ako je još deploy-ovana, ugasi je u Supabase dashboardu).

### 2.1 Frontend (Vite / browser)

Ove varijable su dostupne u browseru i MORAJU imati `VITE_` prefiks:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_BANKART_PAYMENTJS_ENABLED` + `VITE_BANKART_PAYMENTJS_PUBLIC_KEY` (opciono) — runtime toggle za kartice; vidi docs/payment-env-audit.md
- `VITE_API_BASE_URL` (opciono, override API base u dev-u)

Koriste se za: Supabase client, toggle kartica (BANKART_*), PaymentJS, API base.

---

### 2.2 Serverless (Vercel `/api/*`)

Ove varijable su **server-side** i NE SMIJU imati `VITE_` prefiks:

**Obavezne:**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`
- `PUBLIC_SITE_URL` — `https://padrinobudva.com` u **Production**. Server iz njega gradi Bankart callback/return URL-ove; `Origin` header se nikad ne koristi (B22).
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` — rate limit na create-order (10 / 60 s po IP). Bez njih create-order radi **bez limita**.

**Za kartice (Bankart):** `BANKART_API_KEY`, `BANKART_API_USERNAME`, `BANKART_API_PASSWORD`, `BANKART_SHARED_SECRET`

**Opcione:** `ADMIN_FALLBACK_EMAIL`

**Više se ne čitaju (B24, mogu se obrisati iz Vercel-a):** `TELEGRAM_WEBHOOK_SECRET`, `PAYMENTS_EDGE_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_ANON_KEY`

#### Bitne napomene
- `SUPABASE_SERVICE_ROLE_KEY` ≠ `VITE_SUPABASE_ANON_KEY`
- `TELEGRAM_CHAT_ID` mora biti **group / supergroup ID**
  - gotovo uvijek **NEGATIVAN broj**
- Bot mora biti dodat u grupu i mora poslati bar jednu poruku u nju

---

## 3) Deploy rutina (tačno ovako)

### 3.1 Prvi put / nova mašina
```bash
vercel link
```

### 3.2 Povlačenje env varijabli lokalno
```bash
vercel pull
```

➡️ Ovo pravi / ažurira `.env.local`

### 3.3 Production deploy
```bash
vercel --prod
```

Ako su env varijable promijenjene na Vercel-u → OBAVEZNO novi deploy

---

## 4) Testiranje (obavezno prije svake isporuke)

### 4.1 Ponovno slanje Telegram poruke (PROD)

Javnog Telegram endpoint-a više nema (B24). Poruku za postojeću porudžbinu
šalje admin panel: Porudžbine → „Pošalji ponovo" (`/api/admin-orders?op=resend-telegram`,
traži admin prijavu). Poruka mora stići u Telegram grupu.

### 4.2 End-to-end test (najbitniji)

Napravi porudžbinu kroz UI (production)

Provjeri:

order postoji u Supabase orders

Telegram poruka je stigla

UI pokazuje uspješno slanje

Ako ovo radi → sistem je zdrav.

5) Lokalni development (šta je normalno)
5.1 Standard Vite dev
npm run dev


Normalno ponašanje:

aplikacija radi na localhost:5173

order se upisuje u Supabase

Telegram se NE ŠALJE iz DEV-a

nema /api/* ruta (to je normalno)

➡️ DEV nikad ne smije slati Telegram poruke

5.2 Lokalni E2E test (Vercel emulacija)

Ako želiš da /api/* radi lokalno:

vercel dev


Očekivano:

aplikacija radi na http://localhost:3000

/api/* rute postoje

“Resend Telegram” radi lokalno

6) Telegram slanje — ponašanje (VAŽNO)

notifyNewOrder() (api/_shared/telegram.ts):

šalje tačno jednom po porudžbini (claim na telegram_notified_at)

ima timeout (7s)

ako Telegram padne:

order ostaje validan, claim se oslobađa (admin „Pošalji ponovo" ili sledeći poziv može da pošalje)

greška se loguje u Vercel logs kao "[telegram] …"

Telegram je best-effort, nikad SPOF.

7) Najčešći problemi i rješenja
7.1 FUNCTION_INVOCATION_FAILED

Uzrok:

fali env var

pogrešno ime env varijable

fetch prema Supabase/Telegram pukao

Rješenje:

provjeri sekciju 2

pogledaj Vercel logs za rutu /api/create-order (poruke "[telegram] …")

7.2 Missing env: SUPABASE_URL

Uzrok:

postoji samo VITE_SUPABASE_URL

serverless nema SUPABASE_URL

Rješenje:

dodati server-side env var

redeploy

7.3 Bad Request: chat not found

Uzrok:

bot nije u grupi

bot nije poslao poruku u grupi

pogrešan TELEGRAM_CHAT_ID

Rješenje:

dodati bota u grupu

poslati poruku u grupu

izvući pravi chat id (getUpdates)

upisati negativan group id u env

7.4 “Nema logova na Vercel-u”

Uzrok:

pogrešan filter

Rješenje:

filtrirati po ruti /api/create-order i tekstu "[telegram]"

7.5 404 na /api/* u DEV-u

Ovo je NORMALNO u Vite dev režimu.

Rješenje:

ignorisati

ili koristiti vercel dev

8) Šta je normalno, a šta nije
Normalno (ne dirati)

Vercel warning o chunk size

Telegram ne radi u DEV-u

/api/* ne postoji na localhost:5173

Bug (odmah reagovati)

build error (TypeScript)

Missing env

endpoint vraća 500

Telegram ne stiže u PROD-u

9) Release checklist (copy/paste)

Prije puštanja nove verzije:

 vercel --prod prošao (status: Ready)

 PowerShell test endpointa vratio { ok: true }

 Telegram poruka stigla

 Order se upisuje u Supabase orders

 Admin /admin prikazuje porudžbine

Ako je sve čekirano → release je OK.

10) Gold rules (zapamti)

Telegram je notifikacija, ne transakcija

VITE_ nikad nije server-side

PowerShell curl ≠ pravi curl

Ako se vrtimo u krug → prvo gledaj env i logove


---

## ✅ Šta si ovim dobio

- Jedan **centralni dokument** za cijeli projekat  
- Nema više “šta je bilo ono s Vercelom / Telegramom”
- Možeš dati repo bilo kome i neće napraviti haos
- Ovo je **production-grade setup**

Ako želiš, sljedeći (opciono):
- 🔒 auth za `/admin`
- 🔁 resend telegram po statusu
- 📊 osnovni analytics