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
  // ✅ FIX: CartContextType ima totalItems + openCart (ne totalQty + setIsOpen)
  const { totalItems, openCart } = useCart();

  const [isSticky, setIsSticky] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const path = normalizePath();
  const isAdminRoute = useMemo(() => path.startsWith("/admin"), [path]);

  const links = useMemo(
    () => [
      { id: "menu", label: "Meni" },
      { id: "delivery", label: "Dostava" },
      { id: "about", label: "O nama" },
      { id: "kontakt", label: "Kontakt" },
    ],
    []
  );

  useEffect(() => {
    function onScroll() {
      setIsSticky(window.scrollY > 20);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function onClickCart(e: MouseEvent) {
    e.preventDefault();
    openCart();
  }

  function onClickLink(id: string) {
    setMobileOpen(false);

    if (isAdminRoute) {
      if (id === "menu") {
        window.location.href = "/#";
      } else {
        window.location.href = `/#${id}`;
      }
      return;
    }

    if (id === "menu") {
      // ✅ “Meni” otvara isti flow kao HERO CTA “Pogledaj meni”
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      window.dispatchEvent(new Event("padrino:open-menu"));
      return;
    }

    window.history.replaceState(null, "", `/#${id}`);
    scrollToId(id);
  }

  return (
    <header
      className={[
        "fixed top-0 left-0 right-0 z-50",
        "transition-all duration-300",
        isSticky ? "backdrop-blur-md bg-black/50 border-b border-white/10" : "bg-transparent",
      ].join(" ")}
    >
      <div className="mx-auto max-w-7xl px-6">
        <div className="flex h-20 items-center justify-between">
          {/* Logo */}
          <a
            href="/#"
            className="flex items-center gap-3 select-none"
            onClick={(e) => {
              e.preventDefault();
              setMobileOpen(false);
              if (isAdminRoute) {
                window.location.href = "/#";
                return;
              }
              window.history.replaceState(null, "", window.location.pathname + window.location.search);
              scrollToTop();
            }}
            aria-label="Padrino početna"
          >
            <ChefHatLogo className="h-9 w-9" />
            <span className="sr-only">Padrino</span>
          </a>

          {/* Desktop links */}
          <nav className="hidden md:flex items-center gap-10">
            {links.map((l) => (
              <button
                key={l.id}
                type="button"
                className="text-sm font-extrabold tracking-wide text-white/80 hover:text-white transition"
                onClick={() => onClickLink(l.id)}
              >
                {l.label}
              </button>
            ))}
          </nav>

          {/* Right controls */}
          <div className="flex items-center gap-3">
            {/* Cart */}
            <button
              type="button"
              onClick={onClickCart}
              className={[
                "inline-flex items-center gap-2 rounded-full",
                "bg-[#f2b400] text-black",
                "px-5 py-2.5 text-sm font-extrabold",
                "hover:brightness-105 transition",
                "shadow-[0_10px_35px_rgba(0,0,0,0.45)]",
              ].join(" ")}
              aria-label="Otvori korpu"
            >
              <span className="inline-flex items-center justify-center">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    d="M6 7h15l-1.5 9h-12L6 7Z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M6 7 5 3H2"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                  <path d="M9 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" fill="currentColor" />
                  <path d="M18 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" fill="currentColor" />
                </svg>
              </span>
              <span>Korpa</span>
              <span className="ml-1 inline-flex items-center justify-center rounded-full bg-black/15 px-2 py-0.5 text-[12px] font-extrabold">
                {totalItems}
              </span>
            </button>

            {/* Mobile menu */}
            <button
              type="button"
              className="md:hidden inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/30 hover:bg-black/40 transition"
              aria-label="Otvori meni"
              onClick={() => setMobileOpen((v) => !v)}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M4 7h16M4 12h16M4 17h16"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileOpen ? (
          <div className="md:hidden pb-4">
            <div className="rounded-2xl border border-white/10 bg-black/40 backdrop-blur-md p-3">
              <div className="flex flex-col">
                {links.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    className="px-3 py-3 text-left text-sm font-extrabold tracking-wide text-white/85 hover:text-white transition"
                    onClick={() => onClickLink(l.id)}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}
