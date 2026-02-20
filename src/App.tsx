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

type GuardState = "loading" | "unauthenticated" | "not-admin" | "admin";

/**
 * Minimalan shape sesije koji nam treba (email check).
 * Ne oslanjamo se na Supabase Session tip da izbegnemo version/type mismatch probleme.
 */
type SessionLike = {
  user?: {
    email?: string | null;
  } | null;
} | null;

// ✅ Minimalno i stabilno: admin = allowlist email-a (magic link + email check)
const ADMIN_EMAILS = new Set<string>(["pavlemitrovic01@gmail.com"]);

function isAdminSession(session: SessionLike): boolean {
  const email =
    typeof session?.user?.email === "string"
      ? session.user.email.trim().toLowerCase()
      : "";
  return email.length > 0 && ADMIN_EMAILS.has(email);
}

// ✅ Admin delove učitavamo samo kad treba (bundle split)
const AdminOrders = lazy(() => import("./components/AdminOrders"));
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin"));
const AdminLogs = lazy(() => import("./pages/admin/AdminLogs"));

function AdminChunkFallback() {
  return <p className="text-white text-lg">Učitavam…</p>;
}

/**
 * Supabase auth compat layer:
 * - v2: auth.getSession() + auth.onAuthStateChange()
 * - v1 (ili tip mismatch): auth.session() + auth.onAuthStateChange()
 * Ovaj sloj radi i kad TS ne vidi metode (koristimo feature-detection).
 */
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

export default function App() {
  const pathname = typeof window !== "undefined" ? window.location.pathname : "";

  const isAdminLoginRoute =
    pathname === "/admin/login" || pathname.startsWith("/admin/login/");
  const isAdminLogsRoute = pathname === "/admin/logs" || pathname === "/admin/logs/";
  const isAdminRoute = pathname === "/admin" || pathname === "/admin/";

  const needsAdminGuard = isAdminRoute || isAdminLogsRoute;

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

  // ✅ VAŽNO: Admin guard MORA koristiti supabaseAdminAuth (persistSession=true),
  // a NE public supabaseClient (persistSession=false) koji je namerno “hardenovan” za checkout.
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

        setGuardState(isAdminSession(session) ? "admin" : "not-admin");
        setChecking(false);

        unsubscribe =
          subscribeAuthChanges(supabaseAdminAuth.auth, (nextSession) => {
            if (!mounted) return;

            if (!nextSession || !nextSession.user) {
              setGuardState("unauthenticated");
              setChecking(false);
              return;
            }

            setGuardState(isAdminSession(nextSession) ? "admin" : "not-admin");
            setChecking(false);
          }) ?? null;
      } catch (e) {
        // eslint-disable-next-line no-console
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

  // ADMIN ROUTES
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

    // guardState === "admin"
    if (isAdminLogsRoute) {
      return (
        <Suspense fallback={<AdminChunkFallback />}>
          <AdminLogs />
        </Suspense>
      );
    }

    // default admin page
    return (
      <Suspense fallback={<AdminChunkFallback />}>
        <AdminOrders />
      </Suspense>
    );
  }

  // PUBLIC SITE
  return (
    <div className="min-h-screen bg-black text-white">
      {onlineBanner}
      <Navbar />
      <CartDrawer />

      <main>
        <Hero />
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