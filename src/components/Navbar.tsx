import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { useCart } from "../context/useCart";
import ChefHatLogo from "./brand/ChefHatLogo";

function normalizePath(): string {
  const path = window.location.pathname || "";
  if (path) return path;
  if (window.location.hash.startsWith("#/")) return window.location.hash.slice(1);
  return "";
}

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function scrollToTop() {
  const hero = document.getElementById("top");
  if (hero) {
    hero.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

export default function Navbar() {
  const { totalItems, openCart } = useCart();

  const [isAdminRoute, setIsAdminRoute] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // ✅ Supabase se učitava dinamički samo ako smo na admin rutama
  useEffect(() => {
    const path = normalizePath();
    const admin =
      path === "/admin" ||
      path === "/admin/" ||
      path === "/admin/login" ||
      path.startsWith("/admin/login/") ||
      path === "/admin/logs" ||
      path === "/admin/logs/";
    setIsAdminRoute(admin);

    if (!admin) return;

    let unsub: (() => void) | null = null;
    let cancelled = false;

    (async () => {
      try {
        const { supabase } = await import("../lib/supabaseClient");
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        setHasSession(!!data?.session);

        const { data: listener } = supabase.auth.onAuthStateChange((_evt, session) => {
          if (cancelled) return;
          setHasSession(!!session);
        });

        unsub = () => {
          listener?.subscription.unsubscribe();
        };
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("[Padrino] Navbar admin session check failed:", e);
      }
    })();

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  const links = useMemo(
    () => [
      { id: "delivery", label: "Dostava" },
      { id: "o-nama", label: "O nama" },
      { id: "contact", label: "Kontakt" },
    ],
    []
  );

  async function handleLogout() {
    try {
      const { supabase } = await import("../lib/supabaseClient");
      await supabase.auth.signOut();
    } finally {
      window.location.href = "/admin/login";
    }
  }

  function onClickLink(id: string) {
    setMobileOpen(false);

    if (isAdminRoute) {
      window.location.href = `/#${id}`;
      return;
    }

    window.history.replaceState(null, "", `/#${id}`);
    scrollToId(id);
  }

  function onLogoClick(e: MouseEvent<HTMLAnchorElement>) {
    setMobileOpen(false);

    if (isAdminRoute) return;

    e.preventDefault();
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    scrollToTop();
  }

  useEffect(() => {
    const hash = (window.location.hash || "").replace("#", "").trim();
    if (!hash) return;
    const t = window.setTimeout(() => scrollToId(hash), 50);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  return (
    <header className="fixed top-0 left-0 right-0 z-40">
      <div className="border-b border-white/10 bg-black/55 backdrop-blur-md">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
          <div className="h-16 flex items-center gap-3">
            <a
              href="/"
              onClick={onLogoClick}
              aria-label="Padrino"
              className="flex items-center gap-3 -ml-1 transition-opacity duration-300 ease-out hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2b400]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black rounded-full"
            >
              <ChefHatLogo />
            </a>

            <nav className="hidden md:flex items-center gap-1 ml-6">
              {!isAdminRoute &&
                links.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => onClickLink(l.id)}
                    className={[
                      "px-4 py-2 rounded-2xl text-sm font-extrabold tracking-wide",
                      "text-white/75 hover:text-white hover:bg-white/5 transition-all duration-300 ease-out",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2b400]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black",
                    ].join(" ")}
                  >
                    {l.label}
                  </button>
                ))}
            </nav>

            <div className="ml-auto flex items-center gap-2">
              {isAdminRoute && hasSession ? (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="hidden md:inline-flex h-10 px-4 rounded-full bg-red-500/15 text-red-100 ring-1 ring-red-500/25 font-extrabold text-sm transition-all duration-300 ease-out hover:bg-red-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/35 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                >
                  Logout
                </button>
              ) : null}

              {!isAdminRoute ? (
                <button
                  type="button"
                  onClick={openCart}
                  className="relative hidden md:inline-flex h-10 items-center gap-2 rounded-full bg-[#f2b400] text-black px-5 font-extrabold shadow-[0_18px_55px_rgba(0,0,0,0.45)] transition-all duration-300 ease-out hover:brightness-105 active:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                >
                  <span className="text-base">🛒</span>
                  Korpa
                  {totalItems > 0 ? (
                    <span className="absolute -top-2 -right-2 h-6 min-w-6 px-2 rounded-full bg-black text-[#f2b400] text-xs font-extrabold grid place-items-center ring-1 ring-white/10">
                      {totalItems}
                    </span>
                  ) : null}
                </button>
              ) : null}

              <div className="md:hidden flex items-center gap-2">
                {!isAdminRoute ? (
                  <button
                    type="button"
                    onClick={openCart}
                    className="relative h-10 w-10 grid place-items-center rounded-full bg-white/10 text-white/90 ring-1 ring-white/10 transition-all duration-300 ease-out hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2b400]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                    aria-label="Otvori korpu"
                  >
                    🛒
                    {totalItems > 0 ? (
                      <span className="absolute -top-2 -right-2 h-5 min-w-5 px-1 rounded-full bg-[#f2b400] text-black text-[11px] font-extrabold grid place-items-center">
                        {totalItems}
                      </span>
                    ) : null}
                  </button>
                ) : null}

                {isAdminRoute && hasSession ? (
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="h-10 px-4 rounded-full bg-red-500/15 text-red-100 ring-1 ring-red-500/25 font-extrabold text-sm transition-all duration-300 ease-out hover:bg-red-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/35 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                  >
                    Logout
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => setMobileOpen((v) => !v)}
                  className="h-10 w-10 grid place-items-center rounded-full bg-white/10 text-white/90 ring-1 ring-white/10 transition-all duration-300 ease-out hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2b400]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                  aria-label="Meni"
                >
                  ☰
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {mobileOpen && !isAdminRoute ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
            aria-label="Zatvori meni"
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed left-0 right-0 top-16 z-50">
            <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
              <div className="p-glass overflow-hidden">
                <div className="p-3">
                  {links.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => onClickLink(l.id)}
                      className={[
                        "w-full text-left px-4 py-4 rounded-2xl",
                        "text-sm font-extrabold tracking-wide",
                        "text-white/85 hover:text-white hover:bg-white/5 transition-all duration-300 ease-out",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2b400]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black",
                      ].join(" ")}
                    >
                      {l.label}
                    </button>
                  ))}
                </div>

                <div className="p-divider" />

                <div className="p-4 flex items-center justify-between">
                  <div className="text-xs text-white/55">Padrino • Budva</div>
                  <button
                    type="button"
                    onClick={() => setMobileOpen(false)}
                    className="h-9 px-4 rounded-full bg-white/10 text-white/85 font-extrabold text-xs transition-all duration-300 ease-out hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f2b400]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                  >
                    Zatvori
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </header>
  );
}
