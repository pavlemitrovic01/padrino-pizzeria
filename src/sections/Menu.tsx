import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useCart } from "../context/CartProvider";
import type { CartItem } from "../context/CartContext";
import { formatEUR } from "../lib/money";
import { buildImageCandidates } from "../lib/cartDrawerHelpers";
import { normalizeText } from "../lib/parsing";
import { HALAL_PIZZAS } from "../lib/config";
import MenuItemDetailSheet from "../components/MenuItemDetailSheet";
import ChefHatLogo from "../components/brand/ChefHatLogo";

type DbMenuItem = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  image: string | null;
  price_eur_cents: number | null;
  price: number | null;
  is_active: boolean | null;
  sort_order: number | null;
};

const PIZZA_ALIASES = new Set<string>(["pizza", "pizze", "pice", "pizz"]);

function is50cmName(name: string) {
  return /\b50\s*cm\b/i.test(String(name ?? "")) || /\b50cm\b/i.test(String(name ?? ""));
}

function stripSize(name: string) {
  return String(name ?? "")
    .replace(/\b(33|50)\s*cm\b/gi, "")
    .replace(/\b(33|50)cm\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function detectSizeLabel(name: string): string | null {
  const s = String(name ?? "");
  if (/\b50\s*cm\b/i.test(s) || /\b50cm\b/i.test(s)) return "50 cm";
  if (/\b33\s*cm\b/i.test(s) || /\b33cm\b/i.test(s)) return "33 cm";
  return null;
}

function clampText(value: string, max = 78) {
  const s = String(value ?? "").trim();
  if (!s) return "";
  return s.length > max ? s.slice(0, max - 1).trimEnd() + "…" : s;
}

function getSafeCents(row: DbMenuItem): number {
  return typeof row.price_eur_cents === "number"
    ? row.price_eur_cents
    : typeof row.price === "number"
      ? row.price
      : 0;
}

function isHalalPizza(name: string): boolean {
  const n = normalizeText(name);
  for (const halal of HALAL_PIZZAS) {
    if (n.includes(halal)) return true;
  }
  return false;
}

type ToastState = { visible: boolean; title: string; subtitle?: string };

// ─── Shared image component ──────────────────────────────────────────────────

function SmartMenuImage(props: {
  image: string | null;
  name: string;
  alt: string;
  className: string;
}) {
  const { image, name, alt, className } = props;

  const candidates = useMemo(() => buildImageCandidates(image, name), [image, name]);
  const key = `${image ?? ""}|${name}`;

  const [state, setState] = useState<{ key: string; idx: number }>({ key, idx: 0 });
  const idx = state.key === key ? state.idx : 0;

  const src = candidates[idx] ?? null;
  if (!src) return <div className={className + " bg-white/5"} aria-hidden="true" />;

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      onError={() =>
        setState((s) => {
          const current = s.key === key ? s : { key, idx: 0 };
          return { key, idx: current.idx < candidates.length - 1 ? current.idx + 1 : current.idx };
        })
      }
    />
  );
}

// ─── Mobile: full-width list row ─────────────────────────────────────────────

function MobileListRow(props: {
  row: DbMenuItem;
  onAdd: (row: DbMenuItem) => void;
  isAdded: boolean;
  isHalal: boolean;
}) {
  const { row, onAdd, isAdded, isHalal } = props;
  const price = getSafeCents(row);
  const displayName = stripSize(row.name);
  const desc = row.description ? clampText(row.description, 60) : "";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onAdd(row)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onAdd(row);
        }
      }}
      className={[
        "flex items-center gap-3 rounded-2xl p-glass p-glass-hover px-3 py-3",
        "cursor-pointer transition-all duration-200",
        "focus:outline-none focus:ring-2 focus:ring-[#f2b400]/35",
        isAdded ? "ring-2 ring-[#f2b400]" : "",
      ].join(" ")}
      aria-label={`Dodaj ${displayName} u korpu`}
    >
      {/* Text — left */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="truncate text-[15px] font-extrabold leading-tight text-white/94">
          {displayName}
        </div>
        {desc ? (
          <div className="mt-1 line-clamp-2 text-[12px] leading-4 text-white/60">{desc}</div>
        ) : null}
        <div className="mt-2 text-[15px] font-black text-[#f2b400]">{formatEUR(price)}</div>
      </div>

      {/* Thumbnail — right */}
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl">
        <SmartMenuImage
          image={row.image}
          name={row.name}
          alt={displayName}
          className="h-full w-full object-cover"
        />
        {isHalal && !isAdded && (
          <img
            src="/halal.webp"
            alt="Halal"
            className="absolute right-1 top-1 h-6 w-6 rounded-full shadow-sm"
          />
        )}
        {isAdded && (
          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/55">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 font-black text-black text-xs shadow-md">
              ✓
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function Menu() {
  const { addToCart, openCart } = useCart();

  const [items, setItems] = useState<DbMenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [flowOpen, setFlowOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<DbMenuItem | null>(null);

  const [addedId, setAddedId] = useState<string | null>(null);
  const addedTimerRef = useRef<number | null>(null);

  const [toast, setToast] = useState<ToastState>({ visible: false, title: "", subtitle: "" });
  const toastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    async function load() {
      try {
        const { data } = await supabase
          .from("menu_items")
          .select("*")
          .eq("is_active", true)
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true });
        if (cancelled) return;
        setItems((data ?? []) as DbMenuItem[]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onOpen() {
      setFlowOpen(true);
    }
    window.addEventListener("padrino:open-menu", onOpen);
    return () => window.removeEventListener("padrino:open-menu", onOpen);
  }, []);

  useEffect(() => {
    if (!flowOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [flowOpen]);

  useEffect(() => {
    if (!flowOpen) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (selectedItem) return; // sheet handles its own Escape
      setFlowOpen(false);
      setAddedId(null);
      setToast((t) => ({ ...t, visible: false }));
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [flowOpen, selectedItem]);

  useEffect(() => {
    return () => {
      if (addedTimerRef.current) window.clearTimeout(addedTimerRef.current);
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  const pizzasOrdered = useMemo(() => {
    const pizzaRows = items
      .filter((i) => {
        if (i.is_active === false) return false;
        const cat = normalizeText(i.category || "");
        if (!PIZZA_ALIASES.has(cat)) return false;
        if (is50cmName(i.name)) return false;
        return true;
      })
      .slice()
      .sort((a, b) => {
        const bySortOrder = (a.sort_order ?? 0) - (b.sort_order ?? 0);
        if (bySortOrder !== 0) return bySortOrder;
        return a.name.localeCompare(b.name, "sr", { sensitivity: "base" });
      });

    const map = new Map<string, DbMenuItem>();
    for (const row of pizzaRows) {
      const key = normalizeText(stripSize(row.name));
      if (!key) continue;
      if (!map.has(key)) map.set(key, row);
    }

    return [...map.values()];
  }, [items]);

  function showToast(next: ToastState) {
    setToast({ ...next, visible: true });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(
      () => setToast((t) => ({ ...t, visible: false })),
      1800,
    );
  }

  function markAdded(id: string) {
    setAddedId(id);
    if (addedTimerRef.current) window.clearTimeout(addedTimerRef.current);
    addedTimerRef.current = window.setTimeout(() => setAddedId(null), 650);
  }

  function onConfirmFromSheet(cartItem: CartItem) {
    addToCart(cartItem, { openCart: false });
    setSelectedItem(null); // close sheet
    markAdded(cartItem.id);
    showToast({ visible: true, title: "Dodato u korpu ✅", subtitle: cartItem.name });
    // menu drawer stays open — user can keep shopping
  }

  function closeAll() {
    setFlowOpen(false);
    setAddedId(null);
    setToast((t) => ({ ...t, visible: false }));
  }

  function goToCart() {
    closeAll();
    openCart();
  }

  if (!flowOpen) {
    return (
      <section id="meni" className="relative">
        <div className="h-1" />
      </section>
    );
  }

  return (
    <section id="meni">
      <button
        type="button"
        aria-label="Zatvori"
        className="fixed inset-0 z-50 bg-black/72 backdrop-blur-none sm:bg-black/68 sm:backdrop-blur-sm"
        onClick={closeAll}
      />

      <div className="fixed inset-0 z-50 flex items-stretch justify-center sm:px-4 sm:pb-12 sm:pt-14 md:px-6 md:pb-14 md:pt-20">
        <div className="relative flex h-full max-h-full w-full flex-col overflow-hidden rounded-none border-0 bg-[#0a0a0a] shadow-none backdrop-blur-none sm:max-w-[1400px] sm:rounded-[32px] sm:border sm:border-white/10 sm:bg-black/22 sm:shadow-[0_40px_120px_rgba(0,0,0,0.72)] sm:backdrop-blur-md">
          {/* Background layers */}
          <div className="absolute inset-0">
            <img
              src="/sections/menu.webp"
              alt=""
              className="h-full w-full object-cover opacity-30 sm:opacity-[0.82]"
              draggable={false}
              loading="eager"
              decoding="async"
            />
            <div className="absolute inset-0 bg-black/46" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(242,180,0,0.16),rgba(242,180,0,0)_38%)]" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/18 via-black/26 to-black/58" />
          </div>

          <div className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-[#f2b400]/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-40 -right-40 h-[420px] w-[420px] rounded-full bg-white/6 blur-3xl" />
          <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/8 sm:rounded-[32px]" />

          {/* Close button */}
          <button
            type="button"
            onClick={closeAll}
            className="absolute left-3 top-3 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/30 text-white/90 transition hover:border-[#f2b400]/18 hover:bg-[#f2b400]/10 hover:text-[#fff0be] sm:left-auto sm:right-4 sm:top-4"
            aria-label="Nazad"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>
          </button>

          {/* Chef hat logo — mobile only, centered in top empty area */}
          <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 sm:hidden">
            <ChefHatLogo className="h-20 w-auto opacity-85" />
          </div>

          {/* Header */}
          <div className="relative flex flex-col gap-5 px-5 pb-6 pt-16 sm:px-7 sm:py-7 lg:flex-row lg:items-end lg:justify-between lg:gap-8 lg:px-8">
            <div className="min-w-0 max-w-4xl">
              <div className="p-kicker">Meni</div>

              <h2 className="mt-3 hidden text-left font-black leading-[1.08] text-white/95 lg:block lg:text-[44px]">
                Iz naših srca, do vaših osmjeha.
              </h2>

              <p className="mt-3 hidden max-w-xl text-left text-[15px] leading-7 text-white/68 sm:block">
                Odaberi svoju pizzu, pogledaj detalje i dodaj u korpu jednim klikom.
              </p>

              <div className="mx-auto mt-4 h-px w-44 bg-gradient-to-r from-[#f2b400]/45 via-[#f2b400]/18 to-transparent sm:mx-0" />
            </div>

            <div className="flex w-full items-center justify-center lg:w-auto lg:justify-end">
              <button
                type="button"
                onClick={goToCart}
                className="p-btn-gold min-h-[48px] px-5 text-sm shadow-[0_20px_50px_-26px_rgba(242,180,0,0.95)] sm:px-6"
              >
                Idi na korpu
              </button>
            </div>
          </div>

          {/* Content area */}
          <div className="relative min-h-0 flex-1 px-5 pb-6 sm:px-7 sm:pb-7 lg:px-8">
            <div className="pointer-events-none absolute inset-0 rounded-[28px] bg-black/8" />

            <div className="relative h-full overflow-y-auto overscroll-contain pb-24 pr-1 [-webkit-overflow-scrolling:touch] sm:flex sm:flex-col sm:justify-center sm:pb-4 sm:pr-2">

              {/* Loading skeletons */}
              {loading && items.length === 0 ? (
                <div className="grid grid-cols-2 gap-4 pb-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-5 xl:grid-cols-7">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div
                      key={`skeleton-${i}`}
                      className="flex flex-col overflow-hidden rounded-[28px] p-glass animate-pulse"
                      aria-hidden="true"
                    >
                      <div className="h-[118px] w-full bg-white/10 sm:h-[132px]" />
                      <div className="flex flex-1 flex-col p-4 sm:p-[18px]">
                        <div className="h-4 w-3/4 rounded bg-white/15" />
                        <div className="mt-2 h-3 w-full rounded bg-white/10" />
                        <div className="mt-1 h-3 w-5/6 rounded bg-white/10" />
                        <div className="mt-4 h-5 w-16 rounded bg-white/15" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {items.length > 0 ? (
                <>
                  {/* ── MOBILE LIST VIEW (hidden at sm+) ─────────────────── */}
                  <div className="sm:hidden">
                    <div className="flex flex-col gap-2 pb-3">
                      {pizzasOrdered.map((row) => (
                        <MobileListRow
                          key={row.id}
                          row={row}
                          onAdd={setSelectedItem}
                          isAdded={addedId === row.id}
                          isHalal={isHalalPizza(row.name)}
                        />
                      ))}
                    </div>
                  </div>

                  {/* ── DESKTOP / TABLET GRID (visible at sm+) ───────────── */}
                  <div className="hidden sm:grid sm:grid-cols-3 sm:gap-5 lg:grid-cols-5 xl:grid-cols-7 pb-3">
                    {pizzasOrdered.map((row, idx) => {
                      const price = getSafeCents(row);
                      const desc = row.description ? clampText(row.description, 78) : "";
                      const isAdded = addedId === row.id;
                      const sizeLabel = detectSizeLabel(row.name);
                      const displayName = stripSize(row.name);
                      const halal = isHalalPizza(row.name);

                      const onCardKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedItem(row);
                        }
                      };

                      const card = (
                        <div
                          key={row.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedItem(row)}
                          onKeyDown={onCardKeyDown}
                          className={[
                            "group relative flex flex-col overflow-hidden rounded-[28px] text-left",
                            "p-glass p-glass-hover",
                            "shadow-[0_22px_65px_rgba(0,0,0,0.55)]",
                            "transition-all duration-300 hover:-translate-y-1.5",
                            "focus:outline-none focus:ring-2 focus:ring-[#f2b400]/35",
                            isAdded
                              ? "ring-2 ring-[#f2b400] shadow-[0_0_0_6px_rgba(242,180,0,0.14)]"
                              : "",
                          ].join(" ")}
                          aria-label={`Dodaj ${displayName} u korpu`}
                        >
                          {/* Added checkmark */}
                          <div
                            className={[
                              "absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full",
                              "bg-emerald-500 font-black text-black shadow-[0_10px_30px_rgba(0,0,0,0.55)]",
                              "transition-all duration-200",
                              isAdded ? "scale-100 opacity-100" : "scale-90 opacity-0",
                            ].join(" ")}
                            aria-hidden="true"
                          >
                            ✓
                          </div>

                          {sizeLabel ? (
                            <div className="absolute left-3 top-3 z-20 rounded-full border border-white/10 bg-black/35 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#f2b400] backdrop-blur-sm">
                              {sizeLabel}
                            </div>
                          ) : null}

                          <div className="relative shrink-0">
                            <SmartMenuImage
                              image={row.image}
                              name={row.name}
                              alt={displayName}
                              className="h-[130px] w-full object-cover transition duration-300 group-hover:scale-[1.03] sm:h-[180px]"
                            />
                            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/50" />
                            {halal && !isAdded && (
                              <img
                                src="/halal.webp"
                                alt="Halal"
                                className="absolute bottom-2 right-2 z-10 h-8 w-8 rounded-full shadow-md"
                              />
                            )}
                          </div>

                          <div className="flex flex-1 flex-col p-3 sm:p-4">
                            <div className="text-[15px] font-extrabold leading-tight text-white/94 sm:text-[16px]">
                              {displayName}
                            </div>

                            {desc ? (
                              <div className="mt-1.5 min-h-[34px] text-[13px] leading-5 text-white/62 sm:text-[13.5px]">
                                {desc}
                              </div>
                            ) : (
                              <div className="mt-1.5 min-h-[34px] text-[13px] text-white/30">
                                {" "}
                              </div>
                            )}

                            <div className="mt-auto pt-3">
                              <div className="whitespace-nowrap text-[16px] font-black tracking-[0.01em] text-[#f2b400]">
                                {formatEUR(price)}
                              </div>
                            </div>
                          </div>
                        </div>
                      );

                      if (idx === 6) {
                        return (
                          <React.Fragment key={`wrap-${row.id}`}>
                            {card}
                            <div className="col-span-full my-1 hidden h-px bg-gradient-to-r from-transparent via-white/10 to-transparent xl:block" />
                          </React.Fragment>
                        );
                      }

                      return card;
                    })}
                  </div>
                </>
              ) : null}
            </div>
          </div>

          {/* Toast notification */}
          <div
            className={[
              "pointer-events-none absolute bottom-0 left-0 right-0 z-20 px-4 pb-[max(16px,env(safe-area-inset-bottom))]",
              "transition-all duration-200",
              toast.visible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
            ].join(" ")}
            aria-live="polite"
            aria-atomic="true"
          >
            <div className="mx-auto max-w-[760px]">
              <div
                className={[
                  "pointer-events-auto p-glass px-4 py-3 shadow-[0_24px_50px_-26px_rgba(0,0,0,0.9)] sm:px-5 sm:py-4",
                  "flex items-center justify-between gap-3",
                ].join(" ")}
              >
                <div className="min-w-0">
                  <div className="text-sm font-extrabold text-white/92 sm:text-[15px]">
                    {toast.title}
                  </div>
                  {toast.subtitle ? (
                    <div className="mt-1 truncate text-xs text-white/60 sm:text-sm">
                      {toast.subtitle}
                    </div>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button type="button" onClick={goToCart} className="p-btn-gold h-10 px-4 text-sm">
                    Idi na korpu
                  </button>

                  <button
                    type="button"
                    onClick={() => setToast((t) => ({ ...t, visible: false }))}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/85 transition hover:bg-white/15"
                    aria-label="Zatvori obaveštenje"
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detail sheet — slide-up bottom sheet on card click (mobile + desktop) */}
      <MenuItemDetailSheet
        item={selectedItem}
        isHalal={selectedItem ? isHalalPizza(selectedItem.name) : false}
        onClose={() => setSelectedItem(null)}
        onConfirm={onConfirmFromSheet}
      />
    </section>
  );
}
