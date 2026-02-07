import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useCart } from "../context/useCart";

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
  // Prefer Hero section anchor if exists
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

    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data?.session);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_evt, session) => {
      setHasSession(!!session);
    });

    return () => {
      listener?.subscription.unsubscribe();
    };
  }, []);

  // ✅ "Meni" uklonjen (bubble je primarni)
  const links = useMemo(
    () => [
      { id: "delivery", label: "Dostava" },
      { id: "o-nama", label: "O nama" },
      { id: "contact", label: "Kontakt" },
    ],
    []
  );

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/admin/login";
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

  function onLogoClick(e: React.MouseEvent<HTMLAnchorElement>) {
    setMobileOpen(false);

    // Admin: zadrži normalan behavior (reload / navigacija)
    if (isAdminRoute) return;

    // Public: premium smooth scroll bez reload-a
    e.preventDefault();

    // očisti hash (da ne ostane /#...)
    window.history.replaceState(null, "", window.location.pathname + window.location.search);

    scrollToTop();
  }

  useEffect(() => {
    const hash = (window.location.hash || "").replace("#", "").trim();
    if (!hash) return;
    const t = window.setTimeout(() => scrollToId(hash), 50);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-black/80 backdrop-blur text-white border-b border-white/10">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <a
          href="/"
          className="flex items-center gap-3 text-xl font-black tracking-wide"
          onClick={onLogoClick}
        >
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-yellow-500 text-black">
            P
          </span>
          <span className="hidden sm:inline">Padrino</span>
        </a>

        {/* DESKTOP NAV */}
        <nav className="hidden md:flex items-center gap-2">
          {!isAdminRoute &&
            links.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => onClickLink(l.id)}
                className="px-3 py-2 rounded-xl text-sm font-semibold text-white/80 hover:text-white hover:bg-white/5 transition"
              >
                {l.label}
              </button>
            ))}

          {isAdminRoute && hasSession && (
            <button
              type="button"
              onClick={handleLogout}
              className="ml-2 bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-full font-semibold transition"
            >
              Logout
            </button>
          )}

          {!isAdminRoute && (
            <button
              type="button"
              onClick={openCart}
              className="relative ml-2 flex items-center gap-2 bg-yellow-500 text-black px-4 py-2 rounded-full font-extrabold hover:bg-yellow-400 transition"
            >
              🛒 Korpa
              {totalItems > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full">
                  {totalItems}
                </span>
              )}
            </button>
          )}
        </nav>

        {/* MOBILE */}
        <div className="md:hidden flex items-center gap-2">
          {!isAdminRoute && (
            <button
              type="button"
              onClick={openCart}
              className="relative flex items-center gap-2 bg-yellow-500 text-black px-3 py-2 rounded-full font-extrabold hover:bg-yellow-400 transition"
              aria-label="Otvori korpu"
            >
              🛒
              {totalItems > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full">
                  {totalItems}
                </span>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="px-3 py-2 rounded-2xl border border-white/15 hover:border-white/30 transition"
            aria-label="Meni"
          >
            ☰
          </button>
        </div>
      </div>

      {mobileOpen && !isAdminRoute && (
        <div className="md:hidden border-t border-white/10 bg-black/95">
          <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col gap-1">
            {links.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => onClickLink(l.id)}
                className="text-left px-3 py-3 rounded-2xl text-sm font-semibold text-white/85 hover:text-white hover:bg-white/5 transition"
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
