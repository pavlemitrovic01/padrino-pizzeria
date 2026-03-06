import { Suspense, lazy, useEffect, useMemo, useState } from "react";

import Navbar from "./components/Navbar";
import CartDrawer from "./components/CartDrawer";

import Hero from "./sections/Hero";
import Menu from "./sections/Menu";
import Delivery from "./sections/Delivery";
import Faq from "./sections/Faq";
import About from "./sections/About";
import Contact from "./sections/Contact";
import Footer from "./sections/Footer";

import PizzaBudvaPage from "./seo/PizzaBudvaPage";

import { setCanonical, setOgUrl, setRobots, setTitle } from "./lib/seo";

type GuardState = "loading" | "unauthenticated" | "not-admin" | "admin";

type SessionLike = {
  access_token?: string | null;
  user?: {
    email?: string | null;
  } | null;
} | null;

const AdminLogin = lazy(() => import("./pages/admin/AdminLogin"));
const AdminOrders = lazy(() => import("./components/AdminOrders"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminLogs = lazy(() => import("./pages/admin/AdminLogs"));

function AdminChunkFallback() {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <p className="text-sm font-semibold text-white/80">Admin</p>
      <p className="mt-2 text-xs text-white/60">Učitavam…</p>
    </div>
  );
}

function AdminNav({ active }: { active: "orders" | "users" | "logs" }) {
  const btnBase = "rounded-xl border px-3 py-2 text-xs font-semibold transition";
  const btnActive = "border-white/20 bg-black/40 text-white";
  const btnIdle = "border-white/10 bg-black/20 text-white/80 hover:border-white/20";

  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);

    try {
      const { supabaseAdminAuth } = await import("./lib/supabaseAdminAuthClient");
      await supabaseAdminAuth.auth.signOut();
    } finally {
      try {
        localStorage.removeItem("padrino-admin-auth");
      } catch {
        // ignore
      }
      window.location.replace("/admin/login");
    }
  }

  return (
    <div className="bg-black text-white">
      <div className="mx-auto max-w-6xl px-4 pt-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-white/80">Admin</p>
            <p className="text-xs text-white/50">Navigacija</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              className={`${btnBase} ${active === "orders" ? btnActive : btnIdle}`}
              onClick={() => {
                window.location.href = "/admin";
              }}
              title="Admin — Porudžbine"
            >
              Porudžbine
            </button>

            <button
              className={`${btnBase} ${active === "users" ? btnActive : btnIdle}`}
              onClick={() => {
                window.location.href = "/admin/users";
              }}
              title="Admin — Korisnici"
            >
              Korisnici
            </button>

            <button
              className={`${btnBase} ${active === "logs" ? btnActive : btnIdle}`}
              onClick={() => {
                window.location.href = "/admin/logs";
              }}
              title="Admin — Logovi"
            >
              Logovi
            </button>

            <button
              className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200 hover:border-red-500/30 disabled:opacity-60"
              onClick={() => void signOut()}
              disabled={signingOut}
              title="Odjava admin sesije"
            >
              {signingOut ? "Odjavljujem…" : "Odjavi se"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

async function readSessionFromAuth(auth: unknown): Promise<SessionLike> {
  const a = auth as {
    getSession?: () => Promise<{ data?: { session?: SessionLike } }>;
    session?: () => SessionLike;
  };

  if (typeof a.getSession === "function") {
    const res = await a.getSession();
    return res?.data?.session ?? null;
  }

  if (typeof a.session === "function") {
    return a.session() ?? null;
  }

  return null;
}

function subscribeAuthChanges(
  auth: unknown,
  onSession: (next: SessionLike) => void
): (() => void) | null {
  const a = auth as {
    onAuthStateChange?: (
      cb: (_event: unknown, session: SessionLike) => void
    ) => { data?: { subscription?: { unsubscribe?: () => void } } };
  };

  if (typeof a.onAuthStateChange !== "function") return null;

  const res = a.onAuthStateChange((_event, session) => {
    onSession(session ?? null);
  });

  const unsub = res?.data?.subscription?.unsubscribe;
  if (typeof unsub !== "function") return null;

  return () => {
    try {
      unsub();
    } catch {
      // ignore
    }
  };
}

function getPathname(): string {
  try {
    return window.location.pathname || "/";
  } catch {
    return "/";
  }
}

function getHash(): string {
  try {
    return window.location.hash || "";
  } catch {
    return "";
  }
}

function upsertJsonLd(id: string, json: unknown) {
  const jsonText = JSON.stringify(json);

  const existing = document.getElementById(id);
  if (existing) {
    existing.textContent = jsonText;
    return;
  }

  const s = document.createElement("script");
  s.id = id;
  s.type = "application/ld+json";
  s.text = jsonText;

  document.head.appendChild(s);
}

function removeJsonLd(id: string) {
  const existing = document.getElementById(id);
  if (existing) existing.remove();
}

function ga4PageView(path: string) {
  const w = window as unknown as {
    gtag?: (...args: unknown[]) => void;
  };

  if (typeof w.gtag !== "function") return;

  try {
    w.gtag("event", "page_view", {
      page_location: window.location.href,
      page_path: path,
    });
  } catch {
    // ignore
  }
}

function SeoAnchorBlock() {
  // SEO-only anchors (hidden) to help discover internal sections from a single-page site.
  // No user-facing impact.
  return (
    <div className="sr-only" aria-hidden="true">
      <a href="#meni">Meni</a>
      <a href="#dostava">Dostava</a>
      <a href="#faq">FAQ</a>
      <a href="#o-nama">O nama</a>
      <a href="#kontakt">Kontakt</a>
    </div>
  );
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function getAccessToken(session: SessionLike): string {
  if (!session) return "";
  if (!isRecord(session)) return "";
  const t = session.access_token;
  return typeof t === "string" ? t : "";
}

async function verifyAdminAccess(accessToken: string): Promise<boolean> {
  try {
    const res = await fetch("/api/admin-me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) return false;

    const data = (await res.json().catch(() => null)) as { ok?: boolean } | null;
    return Boolean(data?.ok);
  } catch {
    return false;
  }
}

function Landing() {
  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />
      <CartDrawer />

      <Hero />
      <Menu />
      <Delivery />
      <Faq />
      <About />
      <Contact />
      <Footer />

      <SeoAnchorBlock />
      <PizzaBudvaPage />
    </div>
  );
}

function AdminShell({
  active,
  children,
}: {
  active: "orders" | "users" | "logs";
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-black text-white">
      <AdminNav active={active} />
      <div className="mx-auto max-w-6xl px-4 py-8">{children}</div>
    </div>
  );
}

function AdminRoute({ page }: { page: "orders" | "users" | "logs" }) {
  const [guard, setGuard] = useState<GuardState>("loading");
  const [lastPath, setLastPath] = useState(getPathname());

  useEffect(() => {
    // sync on route changes (path-based admin, no router)
    const id = window.setInterval(() => {
      const p = getPathname();
      if (p !== lastPath) setLastPath(p);
    }, 200);

    return () => window.clearInterval(id);
  }, [lastPath]);

  useEffect(() => {
    let mounted = true;
    let unsubscribe: (() => void) | null = null;

    async function check() {
      if (!mounted) return;

      setGuard("loading");

      try {
        const { supabaseAdminAuth } = await import("./lib/supabaseAdminAuthClient");

        const session = await readSessionFromAuth(supabaseAdminAuth.auth);
        if (!mounted) return;

        const accessToken = getAccessToken(session);
        if (!accessToken) {
          setGuard("unauthenticated");
          return;
        }

        const ok = await verifyAdminAccess(accessToken);
        if (!mounted) return;

        if (!ok) {
          setGuard("not-admin");
          return;
        }

        setGuard("admin");

        // keep guard in sync with auth changes (logout, token refresh, etc.)
        unsubscribe = subscribeAuthChanges(supabaseAdminAuth.auth, async (nextSession) => {
          if (!mounted) return;

          const nextToken = getAccessToken(nextSession);
          if (!nextToken) {
            setGuard("unauthenticated");
            return;
          }

          const nextOk = await verifyAdminAccess(nextToken);
          if (!mounted) return;

          setGuard(nextOk ? "admin" : "not-admin");
        });
      } catch {
        if (!mounted) return;
        setGuard("unauthenticated");
      }
    }

    void check();

    return () => {
      mounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [lastPath]);

  const pathname = lastPath;
  const isLogin = pathname === "/admin/login";

  if (guard === "loading") {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <p className="text-sm font-semibold">Admin</p>
            <p className="mt-2 text-xs text-white/60">Proveravam pristup…</p>
          </div>
        </div>
      </div>
    );
  }

  if (guard === "unauthenticated") {
    if (!isLogin) {
      window.location.replace("/admin/login");
      return null;
    }

    return (
      <div className="min-h-screen bg-black text-white">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <Suspense fallback={<AdminChunkFallback />}>
            <AdminLogin />
          </Suspense>
        </div>
      </div>
    );
  }

  if (guard === "not-admin") {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <p className="text-sm font-semibold">Nemaš pristup</p>
            <p className="mt-2 text-xs text-white/60">
              Tvoj nalog nije na admin allowlist-i (admin_users) ili je deaktiviran.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80 hover:border-white/20"
                onClick={() => {
                  window.location.replace("/admin/login");
                }}
              >
                Prijava
              </button>

              <button
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80 hover:border-white/20"
                onClick={() => {
                  window.location.replace("/");
                }}
              >
                Nazad na meni
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // guard === "admin"
  if (isLogin) {
    window.location.replace("/admin");
    return null;
  }

  if (page === "orders") {
    return (
      <AdminShell active="orders">
        <Suspense fallback={<AdminChunkFallback />}>
          <AdminOrders />
        </Suspense>
      </AdminShell>
    );
  }

  if (page === "users") {
    return (
      <AdminShell active="users">
        <Suspense fallback={<AdminChunkFallback />}>
          <AdminUsers />
        </Suspense>
      </AdminShell>
    );
  }

  return (
    <AdminShell active="logs">
      <Suspense fallback={<AdminChunkFallback />}>
        <AdminLogs />
      </Suspense>
    </AdminShell>
  );
}

export default function App() {
  const pathname = useMemo(() => getPathname(), []);
  const hash = useMemo(() => getHash(), []);

  useEffect(() => {
    setTitle("Padrino Budva — Picerija & Dostava");
    setCanonical("https://padrinobudva.com");
    setOgUrl("https://padrinobudva.com");
    setRobots("index,follow");

    // JSON-LD
    upsertJsonLd("padrino-jsonld-restaurant", {
      "@context": "https://schema.org",
      "@type": "Restaurant",
      name: "Padrino Budva",
      url: "https://padrinobudva.com",
      telephone: "+38269123456",
      address: {
        "@type": "PostalAddress",
        streetAddress: "Budva",
        addressLocality: "Budva",
        addressCountry: "ME",
      },
      servesCuisine: ["Pizza", "Italian"],
      priceRange: "$$",
    });

    return () => {
      removeJsonLd("padrino-jsonld-restaurant");
    };
  }, []);

  useEffect(() => {
    // simple hash scroll on landing
    if (!hash) return;
    const id = hash.replace("#", "");
    if (!id) return;

    const el = document.getElementById(id);
    if (!el) return;

    // slight delay so sections render
    const t = window.setTimeout(() => {
      try {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch {
        // ignore
      }
    }, 50);

    return () => window.clearTimeout(t);
  }, [hash]);

  useEffect(() => {
    // GA4 pageview
    ga4PageView(pathname);
  }, [pathname]);

  if (pathname.startsWith("/admin")) {
    if (pathname === "/admin/login") return <AdminRoute page="orders" />;
    if (pathname === "/admin/users") return <AdminRoute page="users" />;
    if (pathname === "/admin/logs") return <AdminRoute page="logs" />;
    return <AdminRoute page="orders" />;
  }

  return <Landing />;
}