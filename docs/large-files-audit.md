# Large Files Audit

Docs-only audit. No code changes. Poslednji pregled: repo state u trenutku kreiranja.

---

## Klasifikacije

| Klasa | Značenje |
|-------|----------|
| **DO NOT TOUCH** | LOCK fajl — refaktor samo uz eksplicitno odobrenje |
| **LATER CANDIDATE** | Potencijalno vredan refaktora kasnije, ali nije prioritet |
| **WORTH SPLITTING** | Jasno vredan podela na manje module |

---

## Zaključani fajlovi (LOCK — DO NOT TOUCH)

| Fajl | Linije | Napomena |
|------|--------|----------|
| `src/components/CartDrawer.tsx` | ~2450 | LOCK — prevelik, refaktor nije target dok se ne zatraži |
| `api/create-order.ts` | ~990 | LOCK — serverska validacija cena, arhitektura ne dirati |
| `api/bankart-callback.ts` | ~390 | LOCK — Bankart flow |
| `api/bankart-order-status.ts` | ~450 | LOCK — Bankart flow |
| `api/telegram-new-order.ts` | ~370 | LOCK — Telegram logika |

---

## LATER CANDIDATE

| Fajl | Linije | Napomena |
|------|--------|----------|
| `src/pages/admin/AdminMenu.tsx` | ~1170 | Admin CRUD, moguće kasnije izdvojiti sub-komponente |
| `src/components/AdminOrders.tsx` | ~1016 | Admin porudžbine, filter/table logika |
| `src/pages/admin/AdminSettings.tsx` | ~608 | Admin podešavanja |
| `src/App.tsx` | ~572 | Routing + admin layout, moguće izdvojiti admin shell |

---

## WORTH SPLITTING (nisu LOCK)

| Fajl | Linije | Predlog |
|------|--------|---------|
| — | — | Trenutno nema prioritetnih kandidata za split |

---

## Ostali veći fajlovi (bez klasifikacije)

| Fajl | Linije |
|------|--------|
| `src/sections/Menu.tsx` | ~550 |
| `src/pages/admin/AdminUsers.tsx` | ~540 |
| `src/context/CartProvider.tsx` | ~446 |

---

## Pravilo

- **CartDrawer** i **api/create-order.ts** ostaju audit-only. Nijedan refaktor bez eksplicitnog zahteva.
- Ova dokumentacija ne predlaže LOCK refaktore.
