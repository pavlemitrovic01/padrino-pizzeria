# Refund Sync Audit (Read-Only)

**Kontekst:** Refund sync je LOCK. Finansijski osetljiv. Poznati bug: refund uspe u Bankart flow-u, ali lokalni order/payment_status može ostati neispravan.

**Audit datum:** Repo state u trenutku kreiranja dokumenta.

---

## 1. Tačne refund-related funkcije / grane / matching logika

### api/bankart-callback.ts

| Lokacija | Funkcija / grana | Šta radi |
|----------|------------------|----------|
| L252-326 | `findOrderForCallback(callback)` | Traži order za callback. Redosled: merchantTransactionId (eq id), merchantMetaData (eq id), uuid (eq payment_reference), referenceUuid (eq payment_reference), embedded UUID u merchantTransactionId (eq id), purchaseId suffix (eq payment_reference). |
| L364-416 | `updateOrderAfterCallback(order, callback, rawBody)` | Ažurira order. REFUND grana (L394-399): ako transactionType === "REFUND", result === "OK" → patch.payment_status = "refunded"; result === "ERROR" → patch.payment_status = order.payment_status \|\| "paid". |
| L394-399 | REFUND grana | `if (transactionType === "REFUND") { if (result === "OK") patch.payment_status = "refunded"; else if (result === "ERROR") patch.payment_status = order.payment_status \|\| "paid"; }` |

### api/bankart-order-status.ts

| Lokacija | Funkcija / grana | Šta radi |
|----------|------------------|----------|
| L204-216 | `fetchOrderById(orderId)` | Order lookup po id iz query param. |
| L219-221 | `isFinalPaymentStatus(value)` | Vraća true za "paid", "failed", "cancelled", "refunded". |
| L239-248 | `shouldFetchBankartStatus(order)` | Vraća false ako payment_method !== "card" ILI isFinalPaymentStatus(payment_status) ILI last check previše skoro. |
| L279-308 | `fetchBankartStatusByMerchantTransactionId(orderId)` | Bankart API: GET /status/{apiKey}/getByMerchantTransactionId/{orderId}. orderId = order.id. |
| L345-411 | `applyBankartStatusToOrder(req, order, statusBody)` | REFUND grana (L366-369): ako transactionType === "REFUND" i transactionStatus === "SUCCESS" → nextPaymentStatus = "refunded". |
| L366-369 | REFUND grana | `if (transactionType === "REFUND") { if (transactionStatus === "SUCCESS") nextPaymentStatus = "refunded"; }` |

---

## 2. Trenutni refund flow

### Callback path (bankart-callback.ts)

1. Bankart šalje POST na /api/bankart-callback sa REFUND notifikacijom.
2. Verifikacija HMAC potpisa.
3. `findOrderForCallback(callback)` — traži order po više identifikatora.
4. Ako order nije pronađen → return 200 "OK" (L341-343). **Nema DB update.**
5. Ako order pronađen → `updateOrderAfterCallback` → patch.payment_status = "refunded" ako result === "OK".
6. DB update: `supabase.from("orders").update(patch).eq("id", order.id)`.

### Status sync path (bankart-order-status.ts)

1. Klijent (frontend/admin) poziva GET /api/bankart-order-status?id={orderId}.
2. `fetchOrderById(orderId)` — order iz DB.
3. Ako payment_method !== "card" → return bez Bankart fetch.
4. **Ako isFinalPaymentStatus(order.payment_status)** → return bez Bankart fetch (L376-378). **"paid" je final status.**
5. Ako shouldFetchBankartStatus → fetch Bankart, applyBankartStatusToOrder, update DB.
6. Ako Bankart vraća REFUND/SUCCESS → patch.payment_status = "refunded".

---

## 3. Gde se order lookup dešava

| Fajl | Funkcija | Identifikator |
|------|----------|----------------|
| bankart-callback.ts | findOrderForCallback | merchantTransactionId, merchantMetaData, uuid, referenceUuid, embedded UUID, purchaseId suffix |
| bankart-order-status.ts | fetchOrderById | orderId iz query (id, order_id, orderId) |
| bankart-order-status.ts | fetchBankartStatusByMerchantTransactionId | order.id (order ID iz naše DB) |

---

## 4. Koji identifikator se koristi danas za refund matching

**Callback:** `findOrderForCallback` koristi isti set identifikatora za sve transactionType (DEBIT, REFUND, CHARGEBACK, itd.). Nema posebne logike za REFUND.

**Identifikatori po prioritetu:**
1. merchantTransactionId → eq("id", candidate)
2. merchantMetaData → eq("id", candidate)
3. uuid → eq("payment_reference", uuid)
4. referenceUuid → eq("payment_reference", referenceUuid)
5. embedded UUID u merchantTransactionId → eq("id", embeddedUuid)
6. purchaseId suffix (posle "-") → eq("payment_reference", purchaseIdSuffix)

**Status sync:** orderId iz query = order.id. Bankart API getByMerchantTransactionId(orderId) — šaljemo order ID.

---

## 5. Najverovatniji root cause poznatog buga

### Dokazano iz koda

**A) Status path — skip Bankart fetch za "paid" ordere**

- L376-378: `if (isFinalPaymentStatus(order.payment_status)) return json(res, 200, buildResponseBody(order, { source: "db", refreshed: false }));`
- "paid" je final status (L219-221).
- Posledica: kada je order već "paid", nikad ne pozivamo Bankart. Ako je refund izvršen u Bankart-u, mi to ne saznajemo putem status poll-a. Klijent dobija payment_status = "paid" iz DB bez refresh-a.

**B) Callback path — moguće da findOrderForCallback ne nađe order za REFUND**

- Bankart za REFUND callback možda šalje drugačiju strukturu (npr. merchantTransactionId = refund transaction ID, ne order ID).
- Bez stvarnih Bankart REFUND callback payload-a ne može se dokazati. Ako findOrderForCallback vrati null, callback vraća 200 OK bez DB update (L341-343).

### Šta nedostaje za potpun dokaz

- Primeri stvarnih Bankart REFUND callback payload-a (JSON body).
- Dokumentacija Bankart API: šta getByMerchantTransactionId vraća za refundovane transakcije — original DEBIT ili REFUND?
- Da li Bankart uopšte šalje callback za REFUND, ili se refund status dobija samo putem status API-ja?

---

## 6. Minimalni siguran fix plan (PLAN ONLY, bez koda)

### Opcija A: Status path — ukloniti "paid" iz early-exit za status refresh

- **Šta:** Dozvoliti Bankart fetch i za payment_status = "paid" (npr. jednom u X minuta), da bismo mogli da detektujemo refund.
- **Rizik:** Više Bankart API poziva, moguće rate limit.
- **Alternativa:** Dodati poseban "refund check" endpoint ili flag koji forsira refresh za paid ordere.

### Opcija B: Callback path — proširiti findOrderForCallback za REFUND

- **Šta:** Ako transactionType === "REFUND", dodati dodatne lookup strategije (npr. referenceUuid ima prioritet, ili posebno mapiranje za refund).
- **Preduslov:** Dobiti stvarne REFUND callback payload-e da se vidi struktura.
- **Rizik:** Pogrešno mapiranje može ažurirati pogrešan order.

### Opcija C: Admin-triggered refresh

- **Šta:** U AdminOrders, dugme "Refresh payment status" koje forsira Bankart fetch čak i za paid ordere.
- **Rizik:** Nizak. Ne menja automatski flow.
- **Ograničenje:** Ne rešava automatski sync; zahteva ručnu akciju.

**Preporuka:** Prvo dobiti REFUND callback sample. Ako callback stiže i findOrderForCallback ga nađe, bug je verovatno u status path-u (A). Ako callback ne stiže ili findOrder ne nađe, fokus na callback path (B).

---

## 7. Rizici / side effects

| Rizik | Opis |
|-------|------|
| Pogrešan order update | Ako findOrderForCallback pogrešno mapira refund na drugi order. |
| Rate limit | Češći Bankart status fetch za paid ordere. |
| Regresija DEBIT flow | Bilo kakva izmena u callback/status može uticati na normalan payment flow. |
| HMAC / signature | Ne dirati verifikaciju. |

---

## 8. Koji LOCK fajlovi bi bili dirani budućim fix-om

| Fajl | Verovatno diranje |
|------|-------------------|
| api/bankart-callback.ts | Da — findOrderForCallback i/ili updateOrderAfterCallback |
| api/bankart-order-status.ts | Da — shouldFetchBankartStatus, isFinalPaymentStatus, applyBankartStatusToOrder |
| api/create-order.ts | Ne — samo postavlja payment_status pri kreiranju |
| api/bankart-order-status.ts | Da — glavni status sync path |

---

## 9. DB kolone relevantne za refund

Iz docs/db-schema-baseline.md, orders:

- payment_status (string?)
- payment_reference (string?)
- payment_meta (jsonb?)

Vrednosti payment_status iz koda: "pending", "paid", "failed", "cancelled", "refunded".

---

## 10. Evidence Gathering (Option B) — Rezultat

**Datum:** Repo + Bankart docs pregled.

### Šta je pronađeno u repou

| Izvor | Rezultat |
|-------|----------|
| api/*.ts | Nema logovanja raw callback body u fajlove |
| fixtures/ | Ne postoji |
| __tests__/ | Nema testova sa REFUND callback mock-ovima |
| *.log | Nema log fajlova |
| payment_meta | Callback snapshot (uključujući raw_body) se čuva u orders.payment_meta.last_callback kada callback uspe — ali to je u LIVE DB, ne u repou |

**Zaključak:** Repo ne sadrži REFUND callback payload sample.

### Gde može biti dokaz

| Izvor | Šta tražiti |
|-------|-------------|
| **Supabase (live DB)** | `SELECT id, payment_status, payment_meta->'last_callback' FROM orders WHERE payment_status = 'refunded'` — last_callback sadrži raw_body ako je REFUND callback uspešno obrađen |
| **Supabase** | Bilo koji order sa payment_meta.last_callback.transactionType = 'REFUND' |
| **Vercel** | Function logs za /api/bankart-callback — ako se loguje incoming request body |
| **Bankart** | Tehnička podrška — zatražiti REFUND callback payload primer |

### Bankart dokumentacija (gateway.bankart.si)

| Nalaz | Izvor |
|-------|-------|
| transactionType može biti REFUND u callback-u | Callback Data tabela |
| "Also for any follow-up transactions, such as Chargebacks and Chargeback Reversals, you will receive a notification" | Notification sekcija — REFUND nije eksplicitno naveden, ali transactionType enum uključuje REFUND |
| Refund API request: merchantTransactionId (required) = "your unique transaction ID", referenceUuid (required) = "UUID of a debit or capture" | POST /transaction/{apiKey}/refund |
| Nema REFUND callback primera u docs | Samo DEBIT, ERROR, CHARGEBACK primeri |

**Interpretacija:** Kada iniciraš refund, šalješ merchantTransactionId (order ID) i referenceUuid (original debit UUID). Callback struktura za REFUND nije eksplicitno dokumentovana. Pretpostavka: referenceUuid u REFUND callback-u bi mogao biti original debit UUID (= naš payment_reference). **Nije dokazano bez stvarnog payload-a.**

---

## 11. Evidence Update — Callback Match Proven (Live)

**Datum:** Potvrđeno live dokazom.

- payment_status = refunded
- last_callback.transactionType = REFUND
- last_callback.uuid = orders.payment_reference (MATCH)
- callback-path može uspešno mapirati order za REFUND

**Zaključak:** Callback-path root cause više nije glavni sumnjivac. Status-path skip ostaje glavni target.

---

## 12. Minimal Status-Path Fix Plan (PLAN ONLY)

**Scope:** api/bankart-order-status.ts. Bez callback logike. Bez proširenja.

### 12.1 Tačan dokazani bug

| Lokacija | Šta | Posledica |
|----------|-----|-----------|
| L376-378 | `if (isFinalPaymentStatus(order.payment_status)) return json(...)` | Za payment_status = "paid" nikad ne pozivamo Bankart. Refund se ne detektuje putem status poll-a. |
| L219-221 | `isFinalPaymentStatus` uključuje "paid" | "paid" se tretira kao final — skip fetch. |
| L239-248 | `shouldFetchBankartStatus` | Za isFinalPaymentStatus vraća false — ali za "paid" nikad ne stižemo jer early-exit na L376. |

### 12.2 Minimalna promena

**Šta:** Za payment_status = "paid" NE skip-ovati Bankart fetch. Dozvoliti fetch pod istim rate-limit pravilima (BANKART_STATUS_MIN_INTERVAL_SECONDS), ali sa opciono dužim intervalom za "paid" da smanjimo API load.

**Kako:**
1. Uvesti `shouldSkipStatusRefreshForPaymentStatus(status)` — vraća true samo za "failed", "cancelled", "refunded". Za "paid" i "pending" vraća false.
2. Zameniti early-exit (L376): umesto `isFinalPaymentStatus` koristiti `shouldSkipStatusRefreshForPaymentStatus`.
3. `shouldFetchBankartStatus` ostaje nepromenjen — već koristi last_status_check + interval. Za "paid" ordere koji nikad nisu bili fetch-ovani, lastCheckedAt = null → fetch. Posle fetch-a, sledeći poll čeka interval (default 15s).
4. Opciono: env `BANKART_STATUS_PAID_INTERVAL_SECONDS` (default 300) — duži interval za "paid" da smanjimo Bankart load. Ako nije setovan, koristiti isti kao BANKART_STATUS_MIN_INTERVAL_SECONDS.

**Šta NE menjati:**
- `isFinalPaymentStatus` — ostaje za retry_after_seconds, final flag u response, itd.
- `applyBankartStatusToOrder` — REFUND grana već postoji i radi.
- bankart-callback.ts — ne dirati.

### 12.3 Rizici / side effects

| Rizik | Mitigacija |
|-------|------------|
| Više Bankart API poziva za paid ordere | Rate limit ostaje (15s min). Opciono: duži interval za paid (5 min). |
| Regresija za pending/failed/cancelled/refunded | shouldSkip vraća true za te statuse — ponašanje nepromenjeno. |
| Pogrešan update | applyBankartStatusToOrder već ima REFUND logiku — nema nove logike. |

### 12.4 Manual test plan

| # | Šta | Kako | PASS |
|---|-----|------|------|
| 1 | Build | npm run build | Exit 0 |
| 2 | Test | npm run test | Exit 0 |
| 3 | Pending order — fetch | GET /api/bankart-order-status?id={pending_order_id} | Refreshed, source=bankart |
| 4 | Paid order — sada fetch | GET /api/bankart-order-status?id={paid_order_id} | Refreshed (ako Bankart ima refund → payment_status=refunded) |
| 5 | Refunded order — skip | GET /api/bankart-order-status?id={refunded_order_id} | source=db, refreshed=false |
| 6 | Failed order — skip | GET /api/bankart-order-status?id={failed_order_id} | source=db, refreshed=false |
| 7 | Cash order — skip | GET /api/bankart-order-status?id={cash_order_id} | source=db_cash, refreshed=false |
| 8 | Rate limit | Dva uzastopna poll-a u &lt;15s za isti paid order | Drugi: refreshed=false (ili refreshed=true ako je prošao interval za paid) |

### 12.5 PASS criteria

- Build i test prolaze
- Paid order sada triggeruje Bankart fetch (kad interval dozvoli)
- Failed, cancelled, refunded i dalje skip-uju fetch
- Nema izmena u bankart-callback.ts
- Nema izmena u create-order.ts
