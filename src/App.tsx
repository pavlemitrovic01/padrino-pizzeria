
import Menu from "./sections/Menu";
import Checkout from "./components/Checkout";
import CartDrawer from "./components/CartDrawer";
import Navbar from "./components/Navbar";
import AdminOrders from "./components/AdminOrders";
import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";

type GuardState =
  | "loading"
  | "unauthenticated"
  | "not-admin"
  | "admin";

export default function App() {
  const isAdminRoute = typeof window !== "undefined" && window.location.pathname.startsWith("/admin");

  // Admin guard state
  const [guardState, setGuardState] = useState<GuardState>("loading");
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!isAdminRoute) return;
    let mounted = true;

    async function checkSession() {
      setGuardState("loading");
      setChecking(true);
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      const session = data?.session;
      if (!session || !session.user) {
        setGuardState("unauthenticated");
        setChecking(false);
        return;
      }
      const role = session.user.user_metadata?.role;
      if (role === "admin") {
        setGuardState("admin");
      } else {
        setGuardState("not-admin");
      }
      setChecking(false);
    }

    checkSession();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (!session || !session.user) {
        setGuardState("unauthenticated");
        setChecking(false);
        return;
      }
      const role = session.user.user_metadata?.role;
      if (role === "admin") {
        setGuardState("admin");
      } else {
        setGuardState("not-admin");
      }
      setChecking(false);
    });
    return () => {
      mounted = false;
      listener?.subscription.unsubscribe();
    };
  }, [isAdminRoute]);

  if (isAdminRoute) {
    if (guardState === "loading" || checking) {
      return (
        <>
          <Navbar />
          <main className="bg-black min-h-screen flex items-center justify-center">
            <p className="text-white text-lg">Provjeravam pristup…</p>
          </main>
        </>
      );
    }
    if (guardState === "unauthenticated") {
      return (
        <>
          <Navbar />
          <main className="bg-black min-h-screen flex flex-col items-center justify-center">
            <p className="text-white text-lg mb-6">Prijavite se kao admin.</p>
            <button
              className="bg-yellow-500 hover:bg-yellow-400 text-black font-semibold px-6 py-2 rounded-full text-base"
              onClick={() => {
                window.location.href = "/";
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
          <Navbar />
          <main className="bg-black min-h-screen flex flex-col items-center justify-center">
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
    // admin
    return (
      <>
        <Navbar />
        <main className="bg-black min-h-screen">
          <AdminOrders />
        </main>
      </>
    );
  }

  // Public (meni, korpa, checkout)
  return (
    <>
      <Navbar />
      <main className="bg-black">
        <Menu />
        <Checkout />
      </main>
      <CartDrawer />
    </>
  );
}

