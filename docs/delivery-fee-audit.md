# Delivery Fee Audit — B2

**Datum:** 2026-05-11  
**Batch:** B2 (STRICT, read-only)  
**Grana:** workflow-v3-init  
**Izvršio:** Opus (planner) + Pavle (SQL verify)

---

## Verdict

**CLEAN — Nema produkcijskog baga.** Delivery fee kalkulacija radi ispravno za sve porudžbine.

Jedan strukturalni nalaz: `delivery_zones` tabela ne postoji u DB, ali **nema uticaja na produkciju** jer je GPS path koji bi je koristio arhitekturalno mrtav.

---

## 1. DB Query — `delivery_zones` tabela

**Query pokrenuto:** Supabase SQL editor, production DB (`main`)

```sql
SELECT id, name, fee_eur,
       CASE WHEN polygon IS NULL THEN 'NULL'
            WHEN jsonb_array_length(polygon::jsonb) = 0 THEN 'EMPTY'
            ELSE 'HAS_DATA (' || jsonb_array_length(polygon::jsonb) || ' pts)'
       END AS polygon_status
FROM delivery_zones
ORDER BY name;
```

**Rezultat:**
```
ERROR: 42P01: relation "delivery_zones" does not exist
```

**Nalaz:** Tabela `delivery_zones` **NE POSTOJI** u produkcijskoj Supabase bazi.

---

## 2. GPS Dead-Path Audit

`api/create-order.ts` ima `fetchZones()` koji bi kveriovala `delivery_zones`.
Ta funkcija se zove **isključivo** kad su GPS koordinate dostupne:

```ts
// api/create-order.ts:1073
const point = parseLatLngFromBody(body);

let zones: Zone[] = [];
if (point) {          // ← fetchZones() SAMO ovde
  try {
    zones = await fetchZones();
  } catch {
    zones = [];       // ← try/catch, ne bi crashovalo čak ni da tabela postoji
  }
}
```

`parseLatLngFromBody()` traži: `lat`, `latitude`, `customer_lat`, `customerLat`, `lng`, `longitude`, `customer_lng`, `customerLng`.

`CreateOrderPayload` (src/lib/createOrder.ts) **ne sadrži nijedno od ovih polja.**  
Frontend **nikad** ne šalje GPS koordinate u payload.

**Zaključak:** GPS polygon path je **arhitekturalno mrtav** — nikad se ne aktivira u produkciji. `delivery_zones` tabela se ne kverijuje ni u jednoj stvarnoj porudžbini. Čak i da je tabela postojala, njen nepostojanje bi bio uhvaćen try/catch-om.

---

## 3. Stvarni flow dostave (produkcija)

Sve porudžbine idu ovim putem:

```
Frontend izračuna deliveryFeeCents
  ↓
Ugradi u note: "Zona: Bečići, Dostava: 3€"
  ↓
Pošalje payload (bez lat/lng)
  ↓
Backend: point = null → zones = [] → getDeliveryFeeCentsFromMeta()
  ↓
Parsuje note regex: /Dostava\s*:?\s*([0-9]+(?:[.,][0-9]+)?)\s*€?/i
  ↓
feeCents = parsed value × 100
  ↓
Validira: |bodyTotal - computedTotal| ≤ 1
  ↓
Upisuje porudžbinu
```

---

## 4. Note Format Chain Audit

`formatFeeEurShort(cents)` = `Math.round(cents/100) + "€"`

| Zona | feeCents | Formatovano | Regex match | Parsed EUR | Reconverted cents | Status |
|------|----------|-------------|-------------|------------|-------------------|--------|
| Budva | 0 | `"0€"` | `"0"` | 0 | 0 | ✅ |
| Bečići | 300 | `"3€"` | `"3"` | 3 | 300 | ✅ |
| Rafailovići | 500 | `"5€"` | `"5"` | 5 | 500 | ✅ |
| Pržno | 500 | `"5€"` | `"5"` | 5 | 500 | ✅ |
| Sveti Stefan | 500 | `"5€"` | `"5"` | 5 | 500 | ✅ |
| Seoce | 500 | `"5€"` | `"5"` | 5 | 500 | ✅ |
| Jaz | 500 | `"5€"` | `"5"` | 5 | 500 | ✅ |
| Lastva | 500 | `"5€"` | `"5"` | 5 | 500 | ✅ |

Sve zone: format → parse → reconvert bez gubitka. **Lanac je ispravan.**

---

## 5. DB vs Frontend Comparison

DB tabela ne postoji → direktna poređenja nisu moguća.  
Hardkodirani frontend podaci (CartDrawer.tsx:98–107) su jedini izvor zone podataka u produkciji.

| Frontend zona | feeCents | DB fee_eur | Match? |
|---------------|----------|------------|--------|
| Budva | 0 | N/A (tabela ne postoji) | N/A |
| Bečići | 300 | N/A | N/A |
| Rafailovići | 500 | N/A | N/A |
| Pržno | 500 | N/A | N/A |
| Sveti Stefan | 500 | N/A | N/A |
| Seoce | 500 | N/A | N/A |
| Jaz | 500 | N/A | N/A |
| Lastva | 500 | N/A | N/A |

**Relevantnost:** Nula. Tabela je neaktivna u svakom slučaju.

---

## 6. Risk Flags

### R1 — `formatFeeEurShort` rounding (LOW, future risk)

`Math.round(cents/100)` gubi decimale. Ako ikad dođe zona sa fee koji nije
višekratnik 100 (npr. 150 cents = 1.50€), note bi sadržao `"2€"`, backend bi
parsovao 200 cents, i `|bodyTotal - computedTotal|` bi prelazio 1 → **Order
rejected**.

Trenutne zone su sve round-EUR (0, 3, 5). Nema aktivnog baga. Treba paziti
pri dodavanju novih zona.

**Mitigacija:** Dodati napomenu u kod ili koristiti `formatEUR` (koji daje
`"1,50 €"` → backend regex handles decimals). Ili enforced rule: zone fees
moraju biti višekratnici 100.

### R2 — Mrtvi DB kod (LOW, cosmetic)

`fetchZones()` i `isPointInPolygon()` u `api/create-order.ts` su nikad
pozvani. `delivery_zones` tabela ne postoji u DB. Ovo je dead code koji
opisuje feature koji nije implementiran (GPS-based zone detection).

**Uticaj na produkciju:** Nula. **Uticaj na maintenance:** Zbunjujuće za
budućeg developera.

**Opcija:** Ukloniti GPS/polygon kod iz `create-order.ts` u budućem cleanup
batchu. Dodati komentar "// GPS path not implemented — see docs/delivery-fee-audit.md"
ako se ne uklanja.

---

## 7. B5 Status

B5 (Delivery fee fix) bio CONDITIONAL na B2 nalazu baga.

**Verdict: B5 se ne izvršava.** Nema produkcijskog baga u fee kalkulaciji.
Fee flow radi ispravno end-to-end za sve trenutne zone.

Otvorene tačke (ne zahtevaju hitnu akciju):
- R1 rounding risk → dokumentovati pravilo za buduće zone
- R2 dead code → kandidat za buduci cleanup batch (niski prioritet)

---

## 8. Provjera (STRICT verify)

- `npm run build` — PASS(machine)
- `npm run test` — PASS(machine) (32/32)
- SQL query — PASS(human) — Pavle potvrdio rezultat
- Audit doc review — PASS(human) — Pavle potvrđuje nalaze
