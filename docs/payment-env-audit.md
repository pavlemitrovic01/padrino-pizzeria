# Payment / Env Naming Audit

Source-of-truth za payment-related env varijable. Poslednji audit: repo state u trenutku kreiranja.

---

## Frontend (Vite / browser)

| Varijabla | Runtime | Docs/Types | Status |
|-----------|---------|------------|--------|
| `VITE_BANKART_PAYMENTJS_ENABLED` | **DA** — CartDrawer.tsx L699, envFlagEnabled() | vite-env.d.ts, .env.example | **AKTIVNA** |
| `VITE_BANKART_PAYMENTJS_PUBLIC_KEY` | **DA** — CartDrawer.tsx L698 | vite-env.d.ts, .env.example | **AKTIVNA** |
| `VITE_CARD_PAYMENTS_ENABLED` | **NE** — nigde se ne čita u kodu | vite-env.d.ts, .env.example, RUNBOOK, README | **LEGACY / DEPRECATED** |

**Runtime logika:** CartDrawer koristi samo `VITE_BANKART_PAYMENTJS_ENABLED` + `VITE_BANKART_PAYMENTJS_PUBLIC_KEY` za Payment.js feature. Ako su oba setovana, kartično plaćanje je dostupno.

---

## Server (api/*)

| Varijabla | Gde se koristi | Status |
|-----------|----------------|--------|
| `BANKART_API_KEY` | create-order, bankart-callback, bankart-order-status | **AKTIVNA** |
| `BANKART_API_USERNAME` | create-order, bankart-callback, bankart-order-status | **AKTIVNA** |
| `BANKART_API_PASSWORD` | create-order, bankart-callback, bankart-order-status | **AKTIVNA** |
| `BANKART_SHARED_SECRET` | create-order, bankart-callback, bankart-order-status | **AKTIVNA** |
| `BANKART_API_BASE_URL` | create-order (fallback) | Opciono |
| `BANKART_LANGUAGE` | create-order | Opciono |
| `NLB_*` varijante | create-order, bankart-* (getFirstEnv fallback) | Legacy aliasi, podržani |

---

## Zaključak

- **Runtime toggle za kartice:** `VITE_BANKART_PAYMENTJS_ENABLED` + `VITE_BANKART_PAYMENTJS_PUBLIC_KEY`
- **`VITE_CARD_PAYMENTS_ENABLED`:** Deprecated, nije u upotrebi. Može se ukloniti iz docs/types.
