/**
 * config.ts — PROJECT-SPECIFIC TEMPLATE SWAP POINT (api/ side).
 *
 * When forking Padrino → app#2, edit THIS file + env vars. No other
 * code change required on the api/ side for project-specific values.
 * NOT lock-zone (data only, no logic — but contents are real-money
 * fallbacks, so treat with respect).
 *
 * Contents:
 *   BANKART_FALLBACK_EMAIL      — fallback when client omits email at checkout
 *   BANKART_FALLBACK_CITY       — fallback billing city (delivery zone default)
 *   BANKART_FALLBACK_POSTCODE   — fallback billing postcode
 *   BANKART_DESCRIPTION_PREFIX  — Bankart payment description brand prefix
 *   DEFAULT_PUBLIC_HOST         — domain fallback when env + headers absent
 *
 * Out of scope (intentional — kept inline in their respective files):
 *   - Telegram bot/chat IDs   → env-driven (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID)
 *   - Admin fallback email    → env-driven (ADMIN_FALLBACK_EMAIL)
 *   - Site settings           → DB-driven (site_settings table)
 *   - Serbian-language emoji mapping in telegram-new-order.ts → domain logic, not config
 *
 * F4.1 (STRICT) covers the src/ side mirror: DELIVERY_ZONES, SEO URLs.
 */

export const BANKART_FALLBACK_EMAIL = "padrinobudva@gmail.com";
export const BANKART_FALLBACK_CITY = "Budva";
export const BANKART_FALLBACK_POSTCODE = "85310";
export const BANKART_DESCRIPTION_PREFIX = "Padrino Budva order";
export const DEFAULT_PUBLIC_HOST = "https://padrinobudva.com";
