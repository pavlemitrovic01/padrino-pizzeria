/**
 * Single source-of-truth for public business settings fallbacks.
 * Used by App.tsx (SEO), Contact.tsx, Footer.tsx.
 */

import { isPlainObject as isRecord } from "./parsing";

export type PublicBusinessSettings = {
  id: number;
  phone_display: string;
  phone_e164: string;
  email: string;
  address_line: string;
  default_city: string;
  default_postcode: string;
  hours_display: string;
  maps_url: string;
  instagram_url: string;
  whatsapp_url: string;
  viber_url: string;
};

export const DEFAULT_PUBLIC_BUSINESS_SETTINGS: PublicBusinessSettings = {
  id: 1,
  phone_display: "+382 67 603 780",
  phone_e164: "+38267603780",
  email: "padrinobudva@gmail.com",
  address_line: "Jadranski put BB (Kotorski Semafori)",
  default_city: "Budva",
  default_postcode: "85310",
  hours_display: "12–00",
  maps_url: "https://maps.app.goo.gl/ouqBC1P8rD62qij99",
  instagram_url: "https://www.instagram.com/padrino_budva",
  whatsapp_url: "https://wa.me/38267603780",
  viber_url: "viber://chat?number=38267603780",
};

/** Footer display fallback (short format) — used when DB returns empty */
export const FOOTER_ADDRESS_FALLBACK = "Jadranski put BB • Budva";

export function toStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function toSafeInt(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) {
    return Math.trunc(Number(v));
  }
  return null;
}

const D = DEFAULT_PUBLIC_BUSINESS_SETTINGS;

export function normalizePublicBusinessSettings(raw: unknown): PublicBusinessSettings | null {
  if (!isRecord(raw)) return null;

  const id = toSafeInt(raw.id);
  if (id !== 1) return null;

  return {
    id,
    phone_display: toStr(raw.phone_display) || D.phone_display,
    phone_e164: toStr(raw.phone_e164) || D.phone_e164,
    email: toStr(raw.email) || D.email,
    address_line: toStr(raw.address_line) || D.address_line,
    default_city: toStr(raw.default_city) || D.default_city,
    default_postcode: toStr(raw.default_postcode) || D.default_postcode,
    hours_display: toStr(raw.hours_display) || D.hours_display,
    maps_url: toStr(raw.maps_url) || D.maps_url,
    instagram_url: toStr(raw.instagram_url) || D.instagram_url,
    whatsapp_url: toStr(raw.whatsapp_url) || D.whatsapp_url,
    viber_url: toStr(raw.viber_url) || D.viber_url,
  };
}
