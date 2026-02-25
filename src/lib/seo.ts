// src/lib/seo.ts
// Minimalan SEO helper: bez novih biblioteka, TS strict-safe.

function ensureMetaByName(name: string): HTMLMetaElement {
  let el = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  return el;
}

function ensureMetaByProperty(property: string): HTMLMetaElement {
  let el = document.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("property", property);
    document.head.appendChild(el);
  }
  return el;
}

function ensureCanonicalLink(): HTMLLinkElement {
  let el = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", "canonical");
    document.head.appendChild(el);
  }
  return el;
}

export function setCanonical(href: string): void {
  if (typeof document === "undefined") return;
  const el = ensureCanonicalLink();
  el.setAttribute("href", href);
}

export function setTitle(title: string): void {
  if (typeof document === "undefined") return;
  document.title = title;
}

export function setRobots(content: string): void {
  if (typeof document === "undefined") return;
  const el = ensureMetaByName("robots");
  el.setAttribute("content", content);
}

export function setOgUrl(url: string): void {
  if (typeof document === "undefined") return;
  const el = ensureMetaByProperty("og:url");
  el.setAttribute("content", url);
}