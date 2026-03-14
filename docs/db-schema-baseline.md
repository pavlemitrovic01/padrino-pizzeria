# Padrino Pizzeria — DB Schema Baseline (from code)

**⚠️ Ovaj dokument NIJE zamena za prave migracije.**  
Dokumentira samo ono što se može dokazati iz trenutnog koda. Koristi se za održavanje i onboarding.

---

## Proven from code

### `site_settings`

| Kolona | Tip (iz koda) | Korišćenje |
|--------|---------------|-------------|
| id | number | PK, eq(1) |
| phone_display | string | App, Contact, admin-settings |
| phone_e164 | string | App, Contact, admin-settings |
| email | string | App, Contact, admin-settings |
| address_line | string | App, Contact, Footer, admin-settings |
| default_city | string | App, Contact, CartDrawer, admin-settings |
| default_postcode | string | Contact, CartDrawer, admin-settings |
| hours_display | string | Contact, admin-settings |
| maps_url | string | Contact, admin-settings |
| instagram_url | string | Contact, admin-settings |
| whatsapp_url | string | Contact, admin-settings |
| viber_url | string | Contact, admin-settings |
| created_at | string | admin-settings |
| updated_at | string | admin-settings |

**Hrani:** SEO/JSON-LD, Contact, Footer, CartDrawer checkout defaults, AdminSettings.

---

### `menu_items`

| Kolona | Tip (iz koda) | Korišćenje |
|--------|---------------|-------------|
| id | string (uuid) | PK, Menu, CartDrawer, create-order, admin-menu |
| name | string | Menu, admin-menu |
| description | string | admin-menu |
| category | string | Menu, admin-menu (pizza/pica/sosovi/dodaci) |
| image | string | admin-menu (path) |
| price | number | admin-menu (legacy?) |
| price_eur_cents | number | Menu, CartDrawer, create-order, admin-menu |
| sort_order | number | admin-menu |
| is_active | boolean | Menu, CartDrawer, admin-menu |
| created_at | string | admin-menu |

**Hrani:** Menu sekcija, CartDrawer, create-order (cene), AdminMenu CRUD.

---

### `orders`

| Kolona | Tip (iz koda) | Korišćenje |
|--------|---------------|-------------|
| id | string (uuid) | PK, create-order, bankart-*, telegram, admin-* |
| created_at | string | admin-orders |
| customer_name | string | create-order, admin-orders |
| customer_phone | string | create-order, admin-orders |
| customer_address | string | create-order, admin-orders |
| total_price | number? | admin-orders |
| currency | string | create-order, admin-orders |
| total_eur_cents | number | create-order, admin-orders |
| fx_rsd_per_eur | number? | admin-orders |
| items | jsonb | create-order, admin-orders |
| status | string | create-order, bankart-*, admin-update-order-status |
| payment_method | string | create-order, bankart-* |
| payment_status | string? | create-order, bankart-* |
| payment_provider | string? | create-order, bankart-* |
| payment_reference | string? | bankart-* |
| payment_meta | jsonb? | create-order, bankart-* |

**Hrani:** create-order, bankart-callback, bankart-order-status, telegram-new-order, admin-orders, admin-update-order-status, admin-resend-telegram.

---

### `admin_users`

| Kolona | Tip (iz koda) | Korišćenje |
|--------|---------------|-------------|
| email | string | PK (onConflict), admin-me, admin-*, admin-menu-image |
| role | string | owner/staff |
| enabled | boolean | admin-me, admin-* |
| created_at | string? | admin-users |

**Hrani:** Admin auth, svi admin API endpointi.

---

### `delivery_zones`

| Kolona | Tip (iz koda) | Korišćenje |
|--------|---------------|-------------|
| id | string | PK |
| name | string | create-order (fee lookup) |
| fee_eur | number | create-order |
| polygon | jsonb (number[][]) | create-order (point-in-polygon) |

**Hrani:** create-order (delivery fee calculation).

---

### Storage (Supabase Storage)

| Bucket | Korišćenje |
|--------|------------|
| menu_images | admin-menu-image (upload, getPublicUrl, delete) |

---

## Not proven from repo

- Kolone koje su u bazi ali se ne koriste u kodu
- Tačni SQL tipovi (int4, text, uuid, etc.)
- Indeksi, RLS, constraints
- Auth schema (Supabase Auth)

---

## Napomene

- Nema migracija u repou. Schema promene treba raditi manualno u Supabase dashboardu ili kroz prave migracije.
- Ako dodaš novu kolonu ili tabelu, ažuriraj ovaj dokument ako je potrebno za održavanje.
