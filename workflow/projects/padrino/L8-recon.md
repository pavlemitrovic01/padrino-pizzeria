# L8-recon.md — Mobile Menu Redesign Architecture Map
> Batch: L8.0 (LEAN, 2026-05-25)
> Scope: Architecture map za L8.1–L8.3. Ne diraju se fajlovi koda.

---

## 1. Trenutno stanje — Menu.tsx

**Fajl:** `src/sections/Menu.tsx` (575 linija)

### Kako se otvara
```
window.dispatchEvent(new CustomEvent("padrino:open-menu"))
→ setFlowOpen(true)
→ fixed overlay sa backdrop
```
- Body overflow: hidden dok je otvoren
- Escape key zatvara
- Vraća `<section className="hidden" />` kada `!flowOpen`

### Data flow
```
Supabase `menu_items` (is_active = true)
→ useMemo `pizzasOrdered` — filtrira PIZZA_ALIASES, deduplicira 33cm (bez 50cm)
→ render grid
```
- `PIZZA_ALIASES = Set(["pizza", "pizze", "pice", "pizz"])` — line 21
- Kategorija se detektuje iz `row.category` (normalizovana)
- 50cm verzije se ISKLJUČUJU iz displaya (prikazuje se samo 33cm card)
- Variants (33cm/50cm) su u `pizzaVariantsByBaseKey` iz `useCatalogData`

### Trenutni card click flow
```
onClick → onAdd(row: DbMenuItem)
→ buildCartItem (id, name, price cents, image, description, category, qty=1)
→ addToCart(cartItem, { openCart: false })
→ toast "Uspešno ste dodali ✅"
```
**Nema addon selekcije — direktno add to cart.**

### Grid layout (ne diramo u L8.1)
- mobile (default): `grid-cols-2`
- sm 640px+: `grid-cols-3`
- lg 1024px+: `grid-cols-5`
- xl 1280px+: `grid-cols-7`

### Imports iz context-a
```typescript
import { useCart } from "../context/CartProvider"     // addToCart, openCart
import type { CartItem } from "../context/CartContext" // tip
```

---

## 2. Addon sistem — CartProvider (već izgrađen)

**Fajlovi:** `src/context/CartProvider.tsx` (536 linija) + `src/context/CartContext.tsx` (150 linija)

### CartItem tip (relevantna polja)
```typescript
type CartItem = {
  id: string
  name: string
  price: number        // u centima (cents)
  image: string
  description: string
  category: string
  quantity: number
  size?: PizzaSize | null          // "33" | "50"
  variants?: Partial<Record<PizzaSize, PizzaVariant>>
  basePrice?: number
  addons?: CartAddon[]             // ← SEAM za detail sheet
  note?: string
}

type CartAddon = {
  id: string
  name: string
  price: number   // u centima
  quantity: number
}
```

### Addon CRUD (već u CartProvider)
```typescript
addAddonToItem(id: string, addon: Omit<CartAddon, "quantity">)
increaseAddonQuantity(id: string, addonId: string)
decreaseAddonQuantity(id: string, addonId: string)
removeAddonFromItem(id: string, addonId: string)
```
**Zaključak: Addon sistem je 100% implementiran u state sloju. Detail sheet samo treba UI.**

### addToCart signatura
```typescript
addToCart(rawItem: CartItem, options?: { openCart?: boolean })
```
→ Možemo prosleđivati `addons[]` direktno u initijalnom `CartItem` objektu.

---

## 3. Catalog data — useCatalogData

**Fajl:** `src/hooks/cart/useCatalogData.ts`

### Šta vraća
```typescript
{
  pizzaVariantsByBaseKey: PizzaVariantsMap  // Record<baseKey, {33?: variant, 50?: variant}>
  drinksCatalog: { id, name, price, imageKey }[]
  saucesCatalog: { id, name, price, imageKey }[]
  addonsCatalog: { id, name, price, imageKey, category? }[]
  sauceIdSet: Set<string>
  setPizzaSizeSafe(item, size): void
  addDrinkToCart(drink): void
}
```
- Sve cene u EUR centima
- Fetchuje direktno iz Supabase

### Integracija za L8.2 (detail sheet)
- Pozvati `useCatalogData()` u `Menu.tsx` (ne u CartDrawer koji je lock zone)
- Proslediti `drinksCatalog`, `saucesCatalog`, `addonsCatalog` kao props u `MenuItemDetailSheet`
- Izbeći dupli fetch — jedan hook call u Menu.tsx, data ide dole

---

## 4. Config seam — POPULAR_PIZZAS + HALAL_PIZZAS

**Fajl:** `src/lib/config.ts` (58 linija, samo delivery zones + site URL)

### Šta dodati (L8.1)
```typescript
// Hardcoded lists — moraju matchovati Supabase `menu_items.name` field (case-insensitive safe)
export const POPULAR_PIZZAS: string[] = [
  "Capricciosa",
  "Pesto",
  "Margherita",
  "Vegetariana",
  "Diavolo",
]

export const HALAL_PIZZAS: ReadonlySet<string> = new Set([
  "Margherita",
  "Tuna",
  "Vegetariana",
  "Quattro Formaggi", // proveriti tačan string u Supabase pre commita
  "Chicken",
])
```

⚠️ **VAŽNO:** Pre L8.1 commita — verifikovati tačne name stringove u Supabase dashboard ili admin panelu. Matching treba biti case-insensitive ili strip-based (koristiti `normalizeText` koji već postoji u Menu.tsx).

### Upotreba u Menu.tsx
```typescript
// "Najčešće" sekcija — filtrira iz pizzasOrdered
const popularPizzas = pizzasOrdered.filter(p =>
  POPULAR_PIZZAS.some(name => normalizeText(p.name).includes(normalizeText(name)))
)

// Halal badge
const isHalal = (name: string) =>
  [...HALAL_PIZZAS].some(h => normalizeText(name).includes(normalizeText(h)))
```

---

## 5. Batch scope mapa

### L8.1 — STRICT: Mobile menu drawer redesign

**EXPECTED-FILES:**
```
src/lib/config.ts                  (dodati POPULAR_PIZZAS, HALAL_PIZZAS)
src/sections/Menu.tsx              (mobile layout, Najčešće sekcija, halal badge, search top)
```

**Šta se menja na mobilnom (default / do sm breakpointa):**
1. Header: "Iz naših srca" copy ostaje, font/spacing kompaktniji
2. Search bar — pozicionirati na vrh liste (ispod headera)
3. "Najčešće" sekcija — horizontal scroll strip sa 5 POPULAR_PIZZAS thumbnail card-ova
4. Pizza lista — umesto grid-cols-2, prelazimo na vertical list (full-width rows)
   - Thumbnail RIGHT (80×80px), naziv+cena LEFT, halal badge top-right na thumbnailu
5. Halal badge: `<img src="/halal.webp" />` absolute top-right na pizza card thumbnail
6. Ukloniti "Vidi sliku" overlay button (Scout potvrdio: skriveno sm:opacity-0 — ukloniti completely)
7. Ukloniti Korpa CTA dugme iz menija ako postoji duplikat

**Desktop guard:** Sve mobile promene scope-ovane na `className` bez `sm:` prefiksa ili explicitno `sm:hidden` / `md:hidden`. Desktop grid (grid-cols-3/5/7) ne diramo.

**Tier: STRICT** — dotiče `src/lib/config.ts` (config) + `src/sections/Menu.tsx` (large file, 575 linija).

---

### L8.2 — STRICT: Mobile detail sheet

**EXPECTED-FILES:**
```
src/components/MenuItemDetailSheet.tsx   (nova komponenta)
src/sections/Menu.tsx                    (state za selected item, import sheet)
```

**Arhitektura:**
```
Menu.tsx:
  const [sheetItem, setSheetItem] = useState<DbMenuItem | null>(null)
  const catalogData = useCatalogData()  // dodati ovde
  
  // card onClick → setSheetItem(row) umesto onAdd(row)
  
  <MenuItemDetailSheet
    item={sheetItem}
    onClose={() => setSheetItem(null)}
    sauces={catalogData.saucesCatalog}
    drinks={catalogData.drinksCatalog}
    addons={catalogData.addonsCatalog}
    onConfirm={(item, selectedAddons) => {
      addToCart({ ...item, addons: selectedAddons }, { openCart: true })
      setSheetItem(null)
    }}
  />
```

**MenuItemDetailSheet UI:**
- Framer Motion `AnimatePresence` + `motion.div` slide up (y: "100%" → 0)
- Backdrop overlay (click zatvara)
- Sadržaj:
  - Slika pizze (full width top)
  - Naziv + cena
  - Sekcija "Dodaci": sosovi (multi-select), piće (radio), krofna (radio/checkbox)
  - Sticky dno: "Dodaj u porudžbinu — X,XX€" gold full-width dugme
- Addon selekcija state: lokalni `useState` unutar componente
- Na confirm: calls `onConfirm(cartItem, selectedAddons)`

**CartDrawer:** NE dirati — addon logika ide u sheet, ne u CartDrawer.

**Tier: STRICT** — nova komponenta + izmena Menu.tsx flow (card click behavior).

---

### L8.3 — STRICT: Cart polish (thumbnail rows + halal badge)

**EXPECTED-FILES:**
```
src/components/CartView.tsx    (lock zone — K-O period)
```

⚠️ CartView.tsx je u lock zone (K-O period, W8). Zahteva eksplicitni Pavle OK pre plana.

**Šta se radi:**
- Cart item rows: dodati thumbnail sliku (80×80) levo od naziva
- Halal badge na cart item thumbnailu (ako pizza ime u HALAL_PIZZAS)
- Preuzeti `HALAL_PIZZAS` import iz config.ts

**Tier: STRICT** zbog lock zone.

---

## 6. "Vidi sliku" status

Scout potvrdio: button postoji, ali je `sm:opacity-0` (skriven na mobilnom). U L8.1 ga **uklanjamo completely** iz JSX-a (ne samo hide). Razlog: detail sheet prikazuje sliku — overlay je redundantan.

---

## 7. Otvoreni upiti (za Pavle pre L8.1 plan)

1. **Tačni Supabase name stringovi** — posebno "Quattro Formaggi" (može biti "Quattro formaggi" ili "4 Formaggi"). Proveriti pre `HALAL_PIZZAS` commita.
2. **Piće u detail sheet** — prikazati sve `drinksCatalog` stavke ili samo neke? Filter po tipu?
3. **Krofna** — da li je u `addonsCatalog` ili posebna kategorija? (Scout: `addonsCatalog` iz Supabase, category field postoji)
4. **"Najčešće" naslov** — "Najčešće naručeno" ili "Popularno"?
5. **Desktop menu** — Pavle rekao defer, ali da li menjamo card click na desktop (detail sheet) ili samo na mobilnom?
