import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { supabase } from "../lib/supabaseClient";
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

  // Close mobile on resize to desktop
  useEffect(() => {
    function onResize() {
      if (window.innerWidth >= 768) setMobileOpen(false);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-40 text-white">
      {/* Premium glass bar (same vibe as hero/menu/cart) */}
      <div className="relative border-b border-white/10 bg-black/70 backdrop-blur-md">
        {/* Subtle gold + light ambience */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-28 -top-28 h-72 w-72 rounded-full bg-[#f2b400]/10 blur-3xl" />
          <div className="absolute -right-40 -top-48 h-[460px] w-[460px] rounded-full bg-white/5 blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_45%,rgba(242,180,0,0.10),transparent_55%),radial-gradient(circle_at_78%_40%,rgba(255,255,255,0.06),transparent_55%)]" />
          <div className="absolute inset-0 shadow-[inset_0_0_120px_rgba(0,0,0,0.75)]" />
        </div>

        <div className="relative w-full px-4 sm:px-6 h-16 flex items-center">
          {/* ✅ Stari raspored: logo lijevo */}
          <a
            href="/"
            onClick={onLogoClick}
            aria-label="Padrino"
            className="flex items-center hover:opacity-90 transition-opacity -ml-2"
          >
            <ChefHatLogo />
          </a>

          <div className="ml-auto flex items-center">
            {/* ✅ Desktop: linkovi + korpa (stari layout) */}
            <nav className="hidden md:flex items-center gap-2">
              {!isAdminRoute &&
                links.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => onClickLink(l.id)}
                    className={[
                      "relative px-3 py-2 rounded-2xl text-sm font-extrabold",
                      "text-white/80 hover:text-white transition",
                      "hover:bg-white/5",
                      "focus:outline-none focus:ring-2 focus:ring-[#f2b400]/25",
                    ].join(" ")}
                  >
                    {l.label}
                    {/* tiny underline accent on hover */}
                    <span className="pointer-events-none absolute left-3 right-3 -bottom-[1px] h-px bg-gradient-to-r from-transparent via-[#f2b400]/35 to-transparent opacity-0 group-hover:opacity-100" />
                  </button>
                ))}

              {isAdminRoute && hasSession && (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="ml-2 h-10 px-5 rounded-full bg-red-600/90 text-white font-extrabold hover:bg-red-600 transition"
                >
                  Logout
                </button>
              )}

              {!isAdminRoute && (
                <button
                  type="button"
                  onClick={openCart}
                  className={[
                    "relative ml-2 h-11 px-5 rounded-full font-extrabold transition",
                    "bg-[#f2b400] text-black",
                    "shadow-[0_18px_60px_rgba(0,0,0,0.45)]",
                    "hover:brightness-105 active:brightness-95",
                    // premium outline
                    "ring-1 ring-white/10",
                  ].join(" ")}
                >
                  {/* Subtle inner outline */}
                  <span className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-black/30" />
                  Korpa
                  {totalItems > 0 && (
                    <span className="absolute -top-2 -right-2 bg-black text-[#f2b400] text-xs min-w-[22px] h-[22px] px-1 flex items-center justify-center rounded-full ring-1 ring-white/10 font-black">
                      {totalItems}
                    </span>
                  )}
                </button>
              )}
            </nav>

            {/* ✅ Mobile: korpa + hamburger (stari layout) */}
            <div className="md:hidden flex items-center gap-2">
              {!isAdminRoute && (
                <button
                  type="button"
                  onClick={openCart}
                  className={[
                    "relative h-10 px-3 rounded-full font-extrabold transition",
                    "bg-[#f2b400] text-black",
                    "shadow-[0_18px_60px_rgba(0,0,0,0.45)]",
                    "hover:brightness-105 active:brightness-95",
                    "ring-1 ring-white/10",
                    "flex items-center justify-center",
                  ].join(" ")}
                  aria-label="Otvori korpu"
                >
                  🛒
                  {totalItems > 0 && (
                    <span className="absolute -top-2 -right-2 bg-black text-[#f2b400] text-xs min-w-[22px] h-[22px] px-1 flex items-center justify-center rounded-full ring-1 ring-white/10 font-black">
                      {totalItems}
                    </span>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={() => setMobileOpen((v) => !v)}
                className={[
                  "h-10 w-10 rounded-2xl transition",
                  "bg-white/10 hover:bg-white/15",
                  "border border-white/15 hover:border-white/25",
                  "shadow-[0_10px_40px_rgba(0,0,0,0.35)]",
                ].join(" ")}
                aria-label="Meni"
              >
                ☰
              </button>
            </div>
          </div>
        </div>

        {/* ✅ Mobile dropdown (premium, ali stari koncept) */}
        {mobileOpen && !isAdminRoute && (
          <div className="relative md:hidden border-t border-white/10 bg-black/80 backdrop-blur-md">
            <div className="px-4 py-3">
              <div className="rounded-3xl border border-white/10 bg-black/35 p-2 shadow-[0_30px_120px_rgba(0,0,0,0.6)]">
                {links.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => onClickLink(l.id)}
                    className={[
                      "w-full text-left px-4 py-3 rounded-2xl transition",
                      "text-sm font-extrabold text-white/85 hover:text-white",
                      "hover:bg-white/5",
                    ].join(" ")}
                  >
                    {l.label}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    scrollToTop();
                  }}
                  className={[
                    "w-full text-left px-4 py-3 rounded-2xl transition",
                    "text-sm font-extrabold text-white/70 hover:text-white",
                    "hover:bg-white/5",
                  ].join(" ")}
                >
                  Nazad na vrh
                </button>

                <div className="mt-2 h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                <div className="px-4 py-3 text-[11px] tracking-[0.22em] uppercase text-white/45">
                  Padrino • Budva
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
