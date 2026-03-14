# Phase 2 Presentational Extraction Audit (Read-Only)

**Datum:** Repo state posle Phase 1 (commit b7a34f8).  
**Pravilo:** Audit only. Bez izmene koda. Bez refaktora. Bez commit-a.

---

## 1. Tačna lista presentational kandidata iz CartDrawer.tsx

| # | Komponenta | Linije | Props | Zavisnosti |
|---|------------|--------|-------|-------------|
| 1 | `SmartCartImage` | 234–240 | `image?: string \| null`, `name: string`, `alt: string` | useMemo, SmartCartImageInner, buildImageCandidates |
| 2 | `SmartCartImageInner` | 242–266 | Isto | useState, useMemo, buildImageCandidates |
| 3 | `SmartMiniAddonImage` | 268–270 | `name: string`, `className?: string` | SmartMiniAddonImageInner |
| 4 | `SmartMiniAddonImageInner` | 272–296 | Isto | useState, useMemo, buildImageCandidates |

**Ukupno:** 4 komponente, ~65 linija.

---

## 2. SAFE NEXT vs nisu

### SAFE NEXT (Phase 2 kandidati)

| Komponenta | Razlog |
|------------|--------|
| `SmartCartImage` | Čisto presentational, samo props, buildImageCandidates iz cartDrawerHelpers |
| `SmartCartImageInner` | Isto |
| `SmartMiniAddonImage` | Isto |
| `SmartMiniAddonImageInner` | Isto |

Sve 4 su **SAFE NEXT** — nemaju CartDrawer state, useCart, payment, delivery, Bankart. Samo React hooks (useState, useMemo) i buildImageCandidates.

### Nisu u Phase 2 (ostaju u CartDrawer)

- Svi ostali JSX blokovi (cart view, checkout form, success view) — vezani za business logiku
- BTN_NEUTRAL, BTN_DANGER, itd. — inline stil varijable, nisu komponente
- AnimatePresence/motion wrapperi — deo CartDrawer strukture

---

## 3. Minimalna Phase 2 granica — najmanji bezbedan batch

**Batch:** Sve 4 komponente zajedno.

**Zašto jedan batch:**
- SmartCartImage + SmartCartImageInner su par (wrapper + inner)
- SmartMiniAddonImage + SmartMiniAddonImageInner su par
- Obe parove koristi isti buildImageCandidates
- Jedan batch = jedna izmena, jedan commit, lakši rollback

**Granica:** Izvući sve 4; ništa drugo.

---

## 4. Predlog future fajlova (što manje)

| Opcija | Fajl | Opis |
|--------|------|------|
| **A (preporuka)** | `src/components/CartDrawerImage.tsx` | Sve 4 komponente u jednom fajlu |
| B | `src/components/cart/SmartCartImage.tsx` + `SmartMiniAddonImage.tsx` | 2 fajla — više nego potrebno |

**Preporuka:** 1 fajl — `src/components/CartDrawerImage.tsx`.

**Export:** `SmartCartImage`, `SmartMiniAddonImage` (javni API). `SmartCartImageInner` i `SmartMiniAddonImageInner` mogu biti privatni (ne exportovati) ili exportovati ako treba za test.

---

## 5. Šta mora ostati u CartDrawer.tsx

- useCart, checkout, createOrderSnapshot, resetCheckout
- Sva form state, validation, Payment.js, Bankart
- DELIVERY_ZONES, Bankart storage helpers, payment guards
- onSubmitOrder, applySuccessUiState, fetchBankartOrderStatus
- Svi useEffects (Bankart init, return handling)
- Handlers (backToCart, handleCloseDrawer, addDrinkToCart, itd.)
- Sav preostali JSX (cart list, checkout form, success view)
- Import: `import { SmartCartImage, SmartMiniAddonImage } from "./CartDrawerImage"` (ili slično)
- Korišćenje: `<SmartCartImage ... />`, `<SmartMiniAddonImage ... />` na istim mestima kao sada

---

## 6. Rizik po komponenti

| Komponenta | Rizik | Razlog |
|------------|-------|--------|
| `SmartCartImage` | **low** | Samo props, useMemo, buildImageCandidates |
| `SmartCartImageInner` | **low** | useState za fallback index, buildImageCandidates |
| `SmartMiniAddonImage` | **low** | Wrapper, key={name} |
| `SmartMiniAddonImageInner` | **low** | Isto kao SmartCartImageInner |

Sve 4: **low** — nema business logike, payment, delivery, Bankart.

---

## 7. Minimalan manual PASS plan za future Phase 2

| # | Šta | PASS kriterijum |
|---|-----|-----------------|
| 1 | `npm run build` | Exit 0 |
| 2 | `npm run test` | Exit 0 |
| 3 | Open cart | Drawer se otvori |
| 4 | Add item (pizza) | Kartica se prikaže sa slikom |
| 5 | Cart item image | Slika pizze/stavke se renderuje (SmartCartImage) |
| 6 | Add addon | Addon se doda, slika addona se prikaže (SmartMiniAddonImage) |
| 7 | Add sauce | Sos se doda, slika/label (SmartMiniAddonImage) |
| 8 | Add drink | Piće se doda, slika (SmartMiniAddonImage) |
| 9 | Stuffed crust | Prikaz i cena (33cm=200, 50cm=400) |
| 10 | Image fallback | Ako slika ne postoji — placeholder ili padrino fallback |
| 11 | Cart open/close | Zatvaranje i otvaranje radi |

---

## 8. Zaključak

- **Phase 2 batch:** SmartCartImage, SmartCartImageInner, SmartMiniAddonImage, SmartMiniAddonImageInner
- **Future fajl:** `src/components/CartDrawerImage.tsx` (1 fajl)
- **Rizik:** low za sve 4
- **Bez diranja:** payment, delivery, Bankart, business logika
