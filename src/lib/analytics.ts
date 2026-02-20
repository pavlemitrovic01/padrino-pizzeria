// src/lib/analytics.ts
// GA4 minimal helper (no new deps). TS strict-safe. No PII.
// Handles SPA page_view by listening to History API changes.

export const GA4_MEASUREMENT_ID = "G-3F77D682TB";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function shouldTrackNow(): boolean {
  if (typeof window === "undefined") return false;

  // Stabilno: ne pratimo admin da ne “zagađuje” GA metrikom.
  // (Ako ikad poželiš da pratimo i admin, samo uklonimo ovaj uslov.)
  if (window.location.pathname.startsWith("/admin")) return false;

  return true;
}

function safeGtag(...args: unknown[]): void {
  if (typeof window === "undefined") return;

  if (typeof window.gtag === "function") {
    window.gtag(...args);
    return;
  }

  // Ako gtag nije spreman (npr. blocker), fallback na dataLayer (ne ruši app).
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(args);
}

export type AnalyticsEventParams = Record<string, string | number | boolean | null | undefined>;

export function trackEvent(eventName: string, params?: AnalyticsEventParams): void {
  if (!shouldTrackNow()) return;
  safeGtag("event", eventName, params || {});
}

export function trackPageView(pathname?: string): void {
  if (!shouldTrackNow()) return;

  const page_path = pathname ?? window.location.pathname + window.location.search;

  safeGtag("event", "page_view", {
    page_path,
    page_location: window.location.href,
    page_title: document.title,
  });
}

// SPA page_view tracking without TS "this" issues.
// Hooks history.pushState / replaceState + popstate.
export function initAnalytics(): void {
  if (typeof window === "undefined") return;

  // Avoid double-init (StrictMode / HMR).
  const w = window as unknown as { __padrinoGaInit?: boolean };
  if (w.__padrinoGaInit) return;
  w.__padrinoGaInit = true;

  const NAV_EVENT = "padrino:navigation";

  const dispatchNav = (): void => {
    // dispatchEvent returns boolean; explicitly ignore it
    void window.dispatchEvent(new Event(NAV_EVENT));
  };

  const originalPushState = history.pushState.bind(history);
  history.pushState = ((...args: Parameters<History["pushState"]>) => {
    const ret = originalPushState(...args);
    dispatchNav();
    return ret;
  }) as History["pushState"];

  const originalReplaceState = history.replaceState.bind(history);
  history.replaceState = ((...args: Parameters<History["replaceState"]>) => {
    const ret = originalReplaceState(...args);
    dispatchNav();
    return ret;
  }) as History["replaceState"];

  window.addEventListener("popstate", dispatchNav);
  window.addEventListener(NAV_EVENT, () => trackPageView());

  // Initial page view (we set send_page_view:false in index.html to avoid double counting)
  trackPageView();
}