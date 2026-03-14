# Admin API Duplication Audit (Read-Only)

**Scope:** `api/admin-*` endpoints only. No code changes. No refactor.

**Excluded:** create-order, bankart-*, refund sync, DB/schema, payment flow.

---

## 1. Repeated Helpers / Functions

| Helper | Signature / behavior | Files |
|--------|----------------------|-------|
| `toTrimmedString` | `(v: unknown) => string` — trim string or coerce to "" | All 8 |
| `headerString` | `(req, key) => string` — extract header, handle string/array | All 8 |
| `setCors` | `(req, res)` — origin, Vary, methods, headers, max-age | All 8 |
| `json` | `(res, status, body)` — Content-Type, Cache-Control, status, send | All 8 |
| `getEnv` | `(name) => string` — trim env value | All 8 |
| `buildSupabaseAdmin` | `() => SupabaseClient` — env vars, createClient, X-Client-Info | All 8 |
| `normalizeEmail` | `(v: string) => string` — trim + toLowerCase | All 8 |
| `isFallbackAdmin` | `(email) => boolean` — ADMIN_FALLBACK_EMAIL check | All 8 |
| `getBearerToken` | `(req) => string` — Bearer extraction | All 8 |
| `looksLikeMissingTable` | `(err) => boolean` — admin_users missing check | All 8 |
| `isPlainObject` | `(v) => v is Record<string, unknown>` | 6 (not admin-me, admin-orders) |

---

## 2. Which Files Duplicate Them

| File | Duplicated helpers (count) |
|------|---------------------------|
| admin-me.ts | 10 (no isPlainObject, no queryString) |
| admin-orders.ts | 10 + queryString, parseLimit |
| admin-update-order-status.ts | 11 + isOrderStatus, canTransition |
| admin-menu.ts | 11 + parseJsonBody, normalizeCategory, toNullableTrimmedString, toSafeInt, parsePositiveCents, parseOptionalBoolean, parseOptionalSortOrder, normalizeMenuRow |
| admin-menu-image.ts | 11 + parseJsonBody, getAdminFromDb |
| admin-users.ts | 11 + isLikelyEmail, countEnabledOwners, normalizeAdminUserRow |
| admin-settings.ts | 11 + parseJsonBody, toSafeString, isValidOptionalEmail, isValidOptionalUrl, normalizeSiteSettingsRow, getSelectableColumns, ensureSingletonRow |
| admin-resend-telegram.ts | 11 + isAdminEmailDb (boolean variant), normalizeText, safeInt, formatTotalFromCents, parseItems, isMetaRow, isDrinkRow, addonEmoji, parseMetaFromNote, splitNoteLines, paymentIcon, extractOrderNote, formatOrderForTelegram, fetchWithTimeout, sendTelegramMessage |

---

## 3. Admin Auth Variants (Two Patterns)

| Pattern | Returns | Files |
|---------|---------|-------|
| `getAdminFromDb` / `getAdminRoleFromDb` | `{ table, isAdmin, role }` | admin-me, admin-menu, admin-menu-image, admin-users, admin-settings |
| `isAdminEmailDb` | `boolean` | admin-orders, admin-update-order-status, admin-resend-telegram |

Both query `admin_users`, handle `looksLikeMissingTable`, use `isFallbackAdmin`. The role variant is needed when owner vs staff matters (menu, menu-image, users, settings).

---

## 4. Safe Future Extraction Candidates

| Candidate | Files | Risk | Notes |
|-----------|-------|------|-------|
| `toTrimmedString` | 8 | Low | Identical logic |
| `headerString` | 8 | Low | Identical |
| `getEnv` | 8 | Low | Identical |
| `normalizeEmail` | 8 | Low | Identical |
| `isFallbackAdmin` | 8 | Low | Identical |
| `getBearerToken` | 8 | Low | Identical |
| `looksLikeMissingTable` | 8 | Low | Identical |
| `isPlainObject` | 6 | Low | Identical |
| `setCors` | 8 | Medium | Methods/headers differ per endpoint (GET vs POST vs GET+POST) |
| `json` | 8 | Low | Minor order diff (admin-me: Content-Type before status) |
| `buildSupabaseAdmin` | 8 | Medium | X-Client-Info must stay per-endpoint |
| `getAdminFromDb` | 5 | Low | Same logic, shared type |
| `isAdminEmailDb` | 3 | Low | Same logic |
| `parseJsonBody` | 3 | Low | admin-menu, admin-menu-image, admin-settings |

---

## 5. What Must Remain Local Per Endpoint

| File | Must stay local |
|------|-----------------|
| admin-me | — |
| admin-orders | `queryString`, `parseLimit`, orders select/response |
| admin-update-order-status | `isOrderStatus`, `canTransition`, order update logic |
| admin-menu | `normalizeCategory`, `toNullableTrimmedString`, `toSafeInt`, `parsePositiveCents`, `parseOptionalBoolean`, `parseOptionalSortOrder`, `normalizeMenuRow`, menu CRUD |
| admin-menu-image | `decodeBase64Payload`, `detectExtension`, `sanitizeBaseName`, `extractStoragePath`, `isValidAdminPath`, `handleUpload`, `handleDelete` |
| admin-users | `isLikelyEmail`, `countEnabledOwners`, `normalizeAdminUserRow`, last-owner guard, self-lockout guard |
| admin-settings | `toSafeString`, `isValidOptionalEmail`, `isValidOptionalUrl`, `normalizeSiteSettingsRow`, `getSelectableColumns`, `ensureSingletonRow`, site_settings CRUD |
| admin-resend-telegram | All Telegram formatting: `normalizeText`, `parseItems`, `isMetaRow`, `isDrinkRow`, `addonEmoji`, `parseMetaFromNote`, `formatOrderForTelegram`, `sendTelegramMessage`, etc. |

---

## 6. Risks / Side Effects

| Risk | Mitigation |
|------|------------|
| CORS methods/headers differ | Parameterize `setCors(req, res, { methods?, headers? })` or keep per-file |
| X-Client-Info per endpoint | Pass endpoint name to `buildSupabaseAdmin(endpoint)` |
| Import path / bundling | Shared helpers must live in `api/_shared/` or similar; Vercel must bundle correctly |
| Type drift | Shared types (`ReqLike`, `ResLike`, `Json`) in one place |
| Admin auth variants | One shared `getAdminFromDb`, callers use `isAdmin: r.isAdmin` or `role: r.role` as needed |

---

## 7. Suggested Future Helper Structure

```
api/
  _shared/
    adminHelpers.ts    # toTrimmedString, headerString, getEnv, normalizeEmail, isFallbackAdmin,
                       # getBearerToken, looksLikeMissingTable, isPlainObject
    httpHelpers.ts     # setCors(req, res, opts?), json(res, status, body)
    supabaseAdmin.ts   # buildSupabaseAdmin(endpoint: string)
    adminAuth.ts       # getAdminFromDb(email) -> { table, isAdmin, role }
                       # isAdminEmailDb(email) -> boolean  (thin wrapper)
    parseJsonBody.ts   # parseJsonBody(req) -> Record | null
  admin-me.ts
  admin-orders.ts
  ...
```

**Extraction order (safest first):**
1. `toTrimmedString`, `headerString`, `getEnv`, `normalizeEmail`, `isFallbackAdmin`, `getBearerToken`, `looksLikeMissingTable`, `isPlainObject`
2. `json` (align admin-me order with others first)
3. `setCors` (parameterize methods/headers)
4. `buildSupabaseAdmin` (parameterize endpoint name)
5. `getAdminFromDb` / `isAdminEmailDb`
6. `parseJsonBody`

---

## 8. Manual Test Plan for Future Extraction

1. **Build:** `npm run build`
2. **Tests:** `npm run test`
3. **Admin login:** Login to admin, verify session works
4. **admin-me:** GET /api/admin-me → `{ ok: true, is_admin, role }`
5. **admin-orders:** GET /api/admin-orders → orders list
6. **admin-update-order-status:** POST with order_id, next_status → status updated
7. **admin-menu:** GET menu, POST new item, POST update item
8. **admin-menu-image:** POST upload, POST delete
9. **admin-users:** GET list, POST upsert (owner only)
10. **admin-settings:** GET settings, POST update (owner only)
11. **admin-resend-telegram:** POST order_id → Telegram sent
12. **CORS:** Verify preflight OPTIONS from browser
13. **401/403:** Verify unauthenticated and non-admin get correct errors

---

## 9. Verdict

**APPROVED** — Audit complete. No code changes. Safe extraction plan documented for future use.
