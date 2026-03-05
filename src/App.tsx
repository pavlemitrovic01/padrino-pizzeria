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

const AdminOrders = lazy(() => import("./components/AdminOrders"));
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin"));
const AdminLogs = lazy(() => import("./pages/admin/AdminLogs"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));

function AdminChunkFallback() {
  return <p className="text-white text-lg">Učitavam…</p>;
}

function AdminNav({ active }: { active: "orders" | "users" | "logs" }) {
  const btnBase = "rounded-xl border px-3 py-2 text-xs font-semibold transition";
  const btnActive = "border-white/20 bg-black/40 text-white";
  const btnIdle = "border-white/10 bg-black/20 text-white/80 hover:border-white/20";

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
              title="Admin — Users"
            >
              Users
            </button>

            <button
              className={`${btnBase} ${active === "logs" ? btnActive : btnIdle}`}
              onClick={() => {
                window.location.href = "/admin/logs";
              }}
              title="Admin — Logs"
            >
              Logs
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
      cb: (event: unknown, session: SessionLike) => void
    ) => { data?: { subscription?: { unsubscribe?: () => void } } };
  };

  if (typeof a.onAuthStateChange !== "function") return null;

  const { data } = a.onAuthStateChange((_event, nextSession) => {
    onSession(nextSession ?? null);
  });

  return () => {
    data?.subscription?.unsubscribe?.();
  };
}

function getPathname(): string {
  if (typeof window === "undefined") return "/";
  return window.location.pathname || "/";
}

function getHash(): string {
  if (typeof window === "undefined") return "";
  return window.location.hash || "";
}

function upsertJsonLd(id: string, json: unknown) {
  if (typeof document === "undefined") return;

  const prev = document.getElementById(id);
  if (prev && prev.parentNode) prev.parentNode.removeChild(prev);

  const script = document.createElement("script");
  script.id = id;
  script.type = "application/ld+json";
  script.text = JSON.stringify(json);
  document.head.appendChild(script);
}

function removeJsonLd(id: string) {
  if (typeof document === "undefined") return;
  const el = document.getElementById(id);
  if (el && el.parentNode) el.parentNode.removeChild(el);
}

/**
 * GA4 SPA page_view
 * index.html ima send_page_view:false, pa moramo ručno slati page_view na svaku promenu rute.
 */
function ga4PageView(path: string) {
  if (typeof window === "undefined") return;

  const w = window as typeof window & {
    gtag?: (...args: unknown[]) => void;
  };

  if (typeof w.gtag !== "function") return;

  w.gtag("event", "page_view", {
    page_location: window.location.href,
    page_path: path,
    page_title: document.title,
  });
}

function SeoAnchorBlock() {
  return (
    <section className="relative">
      <div className="mx-auto w-full max-w-6xl px-6">
        <div className="mt-6 md:mt-8 rounded-3xl border border-white/10 bg-white/5 backdrop-blur-sm p-6 md:p-8">
          <h2 className="text-xl md:text-2xl font-semibold text-white/90">
            Pizza Budva — dostava i takeaway
          </h2>

          <p className="mt-3 text-white/75 leading-relaxed">
            Ako tražiš <strong>pizza Budva</strong> sa pouzdanom dostavom i stabilnim
            kvalitetom, Padrino Budva je praktična opcija za brz obrok, ekipu ili porodičnu večeru.
            Poručivanje je jednostavno: izabereš pizzu, dodaš u korpu i potvrdiš.
          </p>

          <p className="mt-3 text-white/70 leading-relaxed">
            Za detaljnije informacije i lokalni kontekst, pogledaj našu stranicu{" "}
            <a
              href="/pizza-budva"
              className="underline underline-offset-4 decoration-white/30 hover:decoration-white/60 hover:text-white"
            >
              Pizza Budva
            </a>
            . Za porudžbinu odmah, otvori{" "}
            <a
              href="/#meni"
              className="underline underline-offset-4 decoration-white/30 hover:decoration-white/60 hover:text-white"
            >
              meni
            </a>
            .
          </p>
        </div>
      </div>
    </section>
  );
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function getAccessToken(session: SessionLike): string {
  const t = typeof session?.access_token === "string" ? session.access_token.trim() : "";
  return t;
}

const ADMIN_API_BASE = import.meta.env.DEV ? "https://padrinobudva.com" : "";

async function checkAdminByToken(
  token: string
): Promise<"admin" | "not-admin" | "unauthenticated"> {
  try {
    const res = await fetch(`${ADMIN_API_BASE}/api/admin-me`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    const body: unknown = await res.json().catch(() => null);

    if (!res.ok) {
      if (res.status === 401) return "unauthenticated";
      return "unauthenticated";
    }

    if (isRecord(body) && body.ok === true) {
      const isAdmin = body.is_admin === true;
      return isAdmin ? "admin" : "not-admin";
    }

    return "unauthenticated";
  } catch (e) {
    console.error("[Padrino] admin-me failed:", e);
    return "unauthenticated";
  }
}

export default function App() {
  const [pathname, setPathname] = useState<string>(() => getPathname());
  const [hash, setHash] = useState<string>(() => getHash());

  useEffect(() => {
    const syncLocation = () => {
      setPathname(getPathname());
      setHash(getHash());
    };

    const onPopState = () => syncLocation();
    const onHashChange = () => syncLocation();

    window.addEventListener("popstate", onPopState);
    window.addEventListener("hashchange", onHashChange);

    return () => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("hashchange", onHashChange);
    };
  }, []);

  useEffect(() => {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "https://padrinobudva.com";

    const isAdminArea = pathname === "/admin" || pathname.startsWith("/admin/");

    // Breadcrumb JSON-LD samo za /menu; u svim drugim slučajevima čistimo
    const isMenu = pathname === "/menu" || pathname === "/menu/";
    if (!isMenu) removeJsonLd("ld-breadcrumb-menu");

    if (isAdminArea) {
      setRobots("noindex,nofollow");
      setCanonical(`${origin}/`);
      setOgUrl(`${origin}/`);
      setTitle("Admin | Padrino Budva");
      return;
    }

    if (pathname === "/pizza-budva" || pathname === "/pizza-budva/") {
      setRobots("index,follow,max-image-preview:large");
      setCanonical(`${origin}/pizza-budva`);
      setOgUrl(`${origin}/pizza-budva`);
      setTitle("Pizza Budva | Padrino Budva — Dostava & Takeaway");
      return;
    }

    if (isMenu) {
      setRobots("index,follow,max-image-preview:large");
      setCanonical(`${origin}/menu`);
      setOgUrl(`${origin}/menu`);
      setTitle("Meni | Padrino Budva");

      upsertJsonLd("ld-breadcrumb-menu", {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Padrino Budva",
            item: `${origin}/`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "Meni",
            item: `${origin}/menu`,
          },
        ],
      });

      return;
    }

    setRobots("index,follow,max-image-preview:large");
    setCanonical(`${origin}/`);
    setOgUrl(`${origin}/`);
    setTitle("Padrino Budva | Pićerija i Dostava Pizze u Budvi");
  }, [pathname]);

  // ✅ GA4 SPA page_view (ručno, jer je send_page_view:false u index.html)
  // Sada pratimo i hash navigaciju (/#meni, /#dostava...) tako što šaljemo page_path = pathname + hash
  useEffect(() => {
    const pathWithHash = `${pathname}${hash || ""}`;
    ga4PageView(pathWithHash);
  }, [pathname, hash]);

  const isAdminLoginRoute =
    pathname === "/admin/login" || pathname.startsWith("/admin/login/");
  const isAdminArea = pathname === "/admin" || pathname.startsWith("/admin/");
  const needsAdminGuard = isAdminArea && !isAdminLoginRoute;

  const [guardState, setGuardState] = useState<GuardState>("loading");
  const [checking, setChecking] = useState(true);

  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof navigator === "undefined") return true;
    return navigator.onLine;
  });

  const onlineBanner = useMemo(() => {
    if (isOnline) return null;
    return (
      <div className="fixed top-0 left-0 right-0 z-[60]">
        <div className="mx-auto max-w-5xl px-4">
          <div className="mt-3 rounded-xl border border-white/10 bg-black/70 px-4 py-2 text-sm text-white/80">
            Offline ste — admin provera sesije može kasniti.
          </div>
        </div>
      </div>
    );
  }, [isOnline]);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    if (!needsAdminGuard) return;

    let mounted = true;
    let unsubscribe: (() => void) | null = null;

    async function checkSession() {
      setGuardState("loading");
      setChecking(true);

      try {
        const { supabaseAdminAuth } = await import("./lib/supabaseAdminAuthClient");

        const session = await readSessionFromAuth(supabaseAdminAuth.auth);
        if (!mounted) return;

        if (!session || !session.user) {
          setGuardState("unauthenticated");
          setChecking(false);
          return;
        }

        const token = getAccessToken(session);
        if (!token) {
          setGuardState("unauthenticated");
          setChecking(false);
          return;
        }

        const verdict = await checkAdminByToken(token);
        if (!mounted) return;

        setGuardState(
          verdict === "admin"
            ? "admin"
            : verdict === "not-admin"
              ? "not-admin"
              : "unauthenticated"
        );
        setChecking(false);

        unsubscribe =
          subscribeAuthChanges(supabaseAdminAuth.auth, async (nextSession) => {
            if (!mounted) return;

            if (!nextSession || !nextSession.user) {
              setGuardState("unauthenticated");
              setChecking(false);
              return;
            }

            const nextToken = getAccessToken(nextSession);
            if (!nextToken) {
              setGuardState("unauthenticated");
              setChecking(false);
              return;
            }

            const nextVerdict = await checkAdminByToken(nextToken);
            if (!mounted) return;

            setGuardState(
              nextVerdict === "admin"
                ? "admin"
                : nextVerdict === "not-admin"
                  ? "not-admin"
                  : "unauthenticated"
            );
            setChecking(false);
          }) ?? null;
      } catch (e) {
        console.error("[Padrino] Admin guard failed to load Supabase:", e);
        if (!mounted) return;
        setGuardState("unauthenticated");
        setChecking(false);
      }
    }

    void checkSession();

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, [needsAdminGuard]);

  if (isAdminLoginRoute) {
    return (
      <Suspense fallback={<AdminChunkFallback />}>
        <AdminLogin />
      </Suspense>
    );
  }

  if (needsAdminGuard) {
    if (checking || guardState === "loading") {
      return (
        <div className="min-h-screen bg-black flex items-center justify-center">
          <p className="text-white/80">Provjeravam admin sesiju…</p>
        </div>
      );
    }

    if (guardState === "unauthenticated") {
      return (
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div className="text-center">
            <p className="text-white mb-4">Prijavite se kao admin.</p>
            <button
              className="bg-yellow-500 hover:bg-yellow-400 text-black font-semibold px-6 py-2 rounded-full text-base"
              onClick={() => {
                window.location.href = "/admin/login";
              }}
            >
              Prijava
            </button>
          </div>
        </div>
      );
    }

    if (guardState === "not-admin") {
      return (
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div className="text-center">
            <p className="text-white mb-4">Nemate admin pristup.</p>
            <button
              className="bg-yellow-500 hover:bg-yellow-400 text-black font-semibold px-6 py-2 rounded-full text-base"
              onClick={() => {
                window.location.href = "/";
              }}
            >
              Nazad na meni
            </button>
          </div>
        </div>
      );
    }

    if (pathname === "/admin/users" || pathname === "/admin/users/") {
      return (
        <>
          <AdminNav active="users" />
          <Suspense fallback={<AdminChunkFallback />}>
            <AdminUsers />
          </Suspense>
        </>
      );
    }

    if (pathname === "/admin/logs" || pathname === "/admin/logs/") {
      return (
        <>
          <AdminNav active="logs" />
          <Suspense fallback={<AdminChunkFallback />}>
            <AdminLogs />
          </Suspense>
        </>
      );
    }

    return (
      <>
        <AdminNav active="orders" />
        <Suspense fallback={<AdminChunkFallback />}>
          <AdminOrders />
        </Suspense>
      </>
    );
  }

  if (pathname === "/pizza-budva" || pathname === "/pizza-budva/") {
    return <PizzaBudvaPage />;
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {onlineBanner}
      <Navbar />
      <CartDrawer />

      <main>
        <Hero />
        <SeoAnchorBlock />
        <Menu />
        <Delivery />
        <Faq />
        <About />
        <Contact />
      </main>

      <Footer />
    </div>
  );
}