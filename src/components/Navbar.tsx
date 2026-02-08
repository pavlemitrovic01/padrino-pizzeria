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

function getHashId(): string {
  const raw = (window.location.hash || "").trim();
  if (!raw) return "";
  return raw.replace(/^#/, "").trim();
}

export default function Navbar() {
  const { totalItems, openCart } = useCart();

  const [isAdminRoute, setIsAdminRoute] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeId, setActiveId] = useState<string>("");

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

    supabase.auth.getSession().then(({ data }) => setHasSession(!!data?.session));

    const { data: listener } = supabase.auth.onAuthStateChange((_evt, session) =>
      setHasSession(!!session)
    );

    return () => listener?.subscription.unsubscribe();
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
    setActiveId(id);
    scrollToId(id);
  }

  function onLogoClick(e: MouseEvent<HTMLAnchorElement>) {
    setMobileOpen(false);

    if (isAdminRoute) return;

    e.preventDefault();
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    setActiveId("");
    scrollToTop();
  }

  // Initial hash scroll + active set
  useEffect(() => {
    const hash = getHashId();
    if (!hash) return;
    setActiveId(hash);
    const t = window.setTimeout(() => scrollToId(hash), 50);
    return () => window.clearTimeout(t);
  }, []);

  // Track hash changes (for back/forward)
  useEffect(() => {
    function onHashChange() {
      const hash = getHashId();
      setActiveId(hash);
    }
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // Mobile overlay: lock body scroll
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  // Close mobile menu on ESC
  useEffect(() => {
    if (!mobileOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  function isActive(id: string) {
    return activeId === id;
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-40">
      {/* Glass bar */}
      <div className="p-glass-strong rounded-none border-b border-white/10">
        <div className="p-container h-16 flex items-center">
          {/* Logo */}
          <a
            href="/"
            onClick={onLogoClick}
            aria-label="Padrino"
            className="flex items-center hover:opacity-90 transition-opacity -ml-1"
          >
            <ChefHatLogo />
          </a>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1 ml-auto" aria-label="Glavna navigacija">
            {!isAdminRoute &&
              links.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => onClickLink(l.id)}
                  className={[
                    "relative h-10 px-4 rounded-full",
                    "text-sm font-extrabold tracking-wide",
                    isActive(l.id) ? "text-white" : "text-white/75 hover:text-white",
                    "bg-white/0 hover:bg-white/10",
                    "transition",
                    "focus:outline-none focus:ring-2 focus:ring-[#f2b400]/35",
                  ].join(" ")}
                  aria-current={isActive(l.id) ? "page" : undefined}
                >
                  {l.label}
                  {/* subtle underline */}
                  <span
                    className={[
                      "pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-1 h-px w-10",
                      "bg-gradient-to-r from-transparent via-[#f2b400]/55 to-transparent",
                      "transition-opacity",
                      isActive(l.id) ? "opacity-100" : "opacity-0",
                    ].join(" ")}
                    aria-hidden="true"
                  />
                </button>
              ))}

            {isAdminRoute && hasSession ? (
              <button
                type="button"
                onClick={handleLogout}
                className="ml-2 h-10 px-4 rounded-full border border-red-500/30 bg-red-500/10 text-sm font-extrabold text-red-100 hover:bg-red-500/15 hover:border-red-500/40 transition focus:outline-none focus:ring-2 focus:ring-red-500/30"
              >
                Logout
              </button>
            ) : null}

            {!isAdminRoute ? (
              <button
                type="button"
                onClick={openCart}
                className="p-btn-gold ml-2 h-10 px-5 text-sm focus:outline-none focus:ring-2 focus:ring-[#f2b400]/35"
                aria-label="Otvori korpu"
              >
                Korpa
                {totalItems > 0 ? (
                  <span
                    className={[
                      "ml-2 inline-flex items-center justify-center",
                      "min-w-6 h-6 px-2 rounded-full",
                      "bg-black/25 ring-1 ring-black/30",
                      "text-[12px] font-black text-black",
                    ].join(" ")}
                    aria-label={`${totalItems} stavki u korpi`}
                  >
                    {totalItems}
                  </span>
                ) : null}
              </button>
            ) : null}
          </nav>

          {/* Mobile controls */}
          <div className="md:hidden flex items-center gap-2 ml-auto">
            {!isAdminRoute ? (
              <button
                type="button"
                onClick={openCart}
                className="p-btn-gold h-10 px-4 focus:outline-none focus:ring-2 focus:ring-[#f2b400]/35"
                aria-label="Otvori korpu"
              >
                Korpa
                {totalItems > 0 ? (
                  <span
                    className={[
                      "ml-2 inline-flex items-center justify-center",
                      "min-w-6 h-6 px-2 rounded-full",
                      "bg-black/25 ring-1 ring-black/30",
                      "text-[12px] font-black text-black",
                    ].join(" ")}
                    aria-label={`${totalItems} stavki u korpi`}
                  >
                    {totalItems}
                  </span>
                ) : null}
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              className="p-btn-ghost h-10 px-4 text-sm font-extrabold focus:outline-none focus:ring-2 focus:ring-[#f2b400]/25"
              aria-label="Meni"
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? "Zatvori" : "Meni"}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu overlay */}
      {mobileOpen && !isAdminRoute ? (
        <div className="md:hidden">
          <button
            type="button"
            aria-label="Zatvori meni"
            className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />

          <div className="fixed left-0 right-0 top-16 z-50 px-4">
            <div className="p-glass-strong p-4">
              <div className="p-eyebrow">Navigacija</div>

              <div className="mt-4 grid gap-2">
                {links.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => onClickLink(l.id)}
                    className={[
                      "w-full text-left h-12 px-4 rounded-2xl",
                      "border transition",
                      isActive(l.id)
                        ? "border-white/20 bg-white/10 text-white"
                        : "border-white/10 bg-white/5 hover:bg-white/10 text-white/85 hover:text-white",
                      "text-sm font-extrabold",
                      "focus:outline-none focus:ring-2 focus:ring-[#f2b400]/25",
                    ].join(" ")}
                    aria-current={isActive(l.id) ? "page" : undefined}
                  >
                    {l.label}
                  </button>
                ))}
              </div>

              <div className="mt-4 p-divider" />

              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  setActiveId("");
                  scrollToTop();
                }}
                className="mt-4 p-btn-ghost w-full h-12 text-sm font-extrabold focus:outline-none focus:ring-2 focus:ring-[#f2b400]/25"
              >
                Nazad na vrh
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
