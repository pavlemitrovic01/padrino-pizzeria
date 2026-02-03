import Menu from "./sections/Menu";
import Checkout from "./components/Checkout";
import CartDrawer from "./components/CartDrawer";
import Navbar from "./components/Navbar";
import AdminOrders from "./components/AdminOrders";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminLogs from "./pages/admin/AdminLogs";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabaseClient";
import type { Session } from "@supabase/supabase-js";

type GuardState = "loading" | "unauthenticated" | "not-admin" | "admin";

// ✅ Minimalno i sigurno: admin = allowlist email-a (magic link + email check)
const ADMIN_EMAILS = new Set<string>(["pavlemitrovic01@gmail.com"]);

function isAdminSession(session: Session | null): boolean {
  const email =
    typeof session?.user?.email === "string" ? session.user.email.trim().toLowerCase() : "";
  return email.length > 0 && ADMIN_EMAILS.has(email);
}

export default function App() {
  const pathname = typeof window !== "undefined" ? window.location.pathname : "";

  const isAdminLoginRoute = pathname === "/admin/login" || pathname.startsWith("/admin/login/");
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
          <div className="mt-3 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 backdrop-blur">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-yellow-200">Nema interneta</p>
                <p className="text-xs text-yellow-200/80 mt-0.5">
                  Proveri konekciju. Porudžbine / admin osvježavanje mogu privremeno da ne rade.
                </p>
              </div>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="shrink-0 rounded-2xl bg-yellow-500 px-4 py-2 text-xs font-extrabold text-black hover:bg-yellow-400"
                title="Osveži stranicu"
              >
                Osveži
              </button>
            </div>
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

    async function checkSession() {
      setGuardState("loading");
      setChecking(true);

      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      const session = data?.session ?? null;

      if (!session || !session.user) {
        setGuardState("unauthenticated");
        setChecking(false);
        return;
      }

      setGuardState(isAdminSession(session) ? "admin" : "not-admin");
      setChecking(false);
    }

    void checkSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;

      if (!session || !session.user) {
        setGuardState("unauthenticated");
        setChecking(false);
        return;
      }

      setGuardState(isAdminSession(session) ? "admin" : "not-admin");
      setChecking(false);
    });

    return () => {
      mounted = false;
      listener?.subscription.unsubscribe();
    };
  }, [needsAdminGuard]);

  if (isAdminLoginRoute) {
    return (
      <>
        {onlineBanner}
        <Navbar />
        <main className="bg-black min-h-screen pt-20 flex items-center justify-center">
          <AdminLogin />
        </main>
      </>
    );
  }

  if (needsAdminGuard) {
    if (guardState === "loading" || checking) {
      return (
        <>
          {onlineBanner}
          <Navbar />
          <main className="bg-black min-h-screen pt-20 flex items-center justify-center">
            <p className="text-white text-lg">Provjeravam pristup…</p>
          </main>
        </>
      );
    }

    if (guardState === "unauthenticated") {
      return (
        <>
          {onlineBanner}
          <Navbar />
          <main className="bg-black min-h-screen pt-20 flex flex-col items-center justify-center">
            <p className="text-white text-lg mb-6">Prijavite se kao admin.</p>
            <button
              className="bg-yellow-500 hover:bg-yellow-400 text-black font-semibold px-6 py-2 rounded-full text-base"
              onClick={() => {
                window.location.href = "/admin/login";
              }}
            >
              Prijava
            </button>
          </main>
        </>
      );
    }

    if (guardState === "not-admin") {
      return (
        <>
          {onlineBanner}
          <Navbar />
          <main className="bg-black min-h-screen pt-20 flex flex-col items-center justify-center">
            <p className="text-white text-lg mb-6">Nemate pristup.</p>
            <button
              className="bg-yellow-500 hover:bg-yellow-400 text-black font-semibold px-6 py-2 rounded-full text-base"
              onClick={() => {
                window.location.href = "/";
              }}
            >
              Nazad na meni
            </button>
          </main>
        </>
      );
    }

    if (isAdminLogsRoute) {
      return (
        <>
          {onlineBanner}
          <Navbar />
          <main className="bg-black min-h-screen pt-20">
            <AdminLogs />
          </main>
        </>
      );
    }

    return (
      <>
        {onlineBanner}
        <Navbar />
        <main className="bg-black min-h-screen pt-20">
          <AdminOrders />
        </main>
      </>
    );
  }

  return (
    <>
      {onlineBanner}
      <Navbar />
      <main className="bg-black">
        <Menu />
        <Checkout />
      </main>
      <CartDrawer />
    </>
  );
}
