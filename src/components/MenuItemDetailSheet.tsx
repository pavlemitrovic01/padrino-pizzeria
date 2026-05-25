import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import type { CartItem, CartAddon } from "../context/CartContext";
import { formatEUR } from "../lib/money";
import { buildImageCandidates } from "../lib/cartDrawerHelpers";
import { useCatalogData } from "../hooks/cart/useCatalogData";

// Mirror of DbMenuItem from Menu.tsx — kept local to avoid coupling
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

type Props = {
  item: DbMenuItem | null;
  isHalal: boolean;
  onClose: () => void;
  onConfirm: (cartItem: CartItem) => void;
};

type CatalogItem = { id: string; name: string; price: number };

type SelectedAddons = Map<string, { name: string; price: number; qty: number }>;

function getSafeCents(row: DbMenuItem): number {
  return typeof row.price_eur_cents === "number"
    ? row.price_eur_cents
    : typeof row.price === "number"
      ? row.price
      : 0;
}

function stripSize(name: string) {
  return String(name ?? "")
    .replace(/\b(33|50)\s*cm\b/gi, "")
    .replace(/\b(33|50)cm\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Public: parent wrapper ─────────────────────────────────────────────────

export default function MenuItemDetailSheet(props: Props) {
  const { item, isHalal, onClose, onConfirm } = props;

  // Catalog hook fires once at first mount of the wrapper.
  const { saucesCatalog, drinksCatalog, addonsCatalog } = useCatalogData();

  return (
    <AnimatePresence>
      {item && (
        <SheetView
          key={item.id}
          item={item}
          isHalal={isHalal}
          onClose={onClose}
          onConfirm={onConfirm}
          saucesCatalog={saucesCatalog}
          drinksCatalog={drinksCatalog}
          addonsCatalog={addonsCatalog}
        />
      )}
    </AnimatePresence>
  );
}

// ─── Internal: sheet body (state lives here; remounts via `key` on item.id) ─

function SheetView(props: {
  item: DbMenuItem;
  isHalal: boolean;
  onClose: () => void;
  onConfirm: (cartItem: CartItem) => void;
  saucesCatalog: CatalogItem[];
  drinksCatalog: CatalogItem[];
  addonsCatalog: CatalogItem[];
}) {
  const { item, isHalal, onClose, onConfirm, saucesCatalog, drinksCatalog, addonsCatalog } = props;

  const [pizzaQty, setPizzaQty] = useState(1);
  const [selectedAddons, setSelectedAddons] = useState<SelectedAddons>(new Map());
  const [note, setNote] = useState("");

  // Guard against double-tap on confirm CTA: the sheet stays in the DOM for
  // ~300–400 ms while AnimatePresence runs its exit animation. Without this
  // ref a fast second tap would call onConfirm() twice and double-add to cart.
  const confirmedRef = useRef(false);

  // Body scroll lock while sheet is mounted.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Escape closes sheet.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const basePrice = getSafeCents(item);
  const displayName = stripSize(item.name);
  const heroImage = buildImageCandidates(item.image, item.name)[0] ?? "/menu/padrino.webp";

  const totalCents = useMemo(() => {
    let addonsSum = 0;
    for (const [, a] of selectedAddons) addonsSum += a.price * a.qty;
    return basePrice * pizzaQty + addonsSum;
  }, [basePrice, pizzaQty, selectedAddons]);

  const catalogLoaded =
    saucesCatalog.length > 0 || drinksCatalog.length > 0 || addonsCatalog.length > 0;

  function toggleAddon(id: string, name: string, price: number) {
    setSelectedAddons((prev) => {
      const next = new Map(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.set(id, { name, price, qty: 1 });
      }
      return next;
    });
  }

  function changeAddonQty(id: string, delta: number) {
    setSelectedAddons((prev) => {
      const next = new Map(prev);
      const a = next.get(id);
      if (!a) return prev;
      const newQty = Math.max(0, Math.min(10, a.qty + delta));
      if (newQty === 0) {
        next.delete(id);
      } else {
        next.set(id, { ...a, qty: newQty });
      }
      return next;
    });
  }

  function handleConfirm() {
    if (confirmedRef.current) return;
    confirmedRef.current = true;

    const addons: CartAddon[] = [];
    for (const [id, a] of selectedAddons) {
      addons.push({ id, name: a.name, price: a.price, quantity: a.qty });
    }
    const cartItem: CartItem = {
      id: item.id,
      name: item.name,
      price: basePrice,
      image: heroImage,
      description: item.description ?? "",
      category: item.category ?? "",
      quantity: pizzaQty,
      addons: addons.length > 0 ? addons : undefined,
      note: note.trim() || undefined,
    };
    onConfirm(cartItem);
  }

  function onDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.y > 80) onClose();
  }

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Zatvori"
        className="absolute inset-0 bg-black/72 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <motion.div
        className="relative z-10 flex h-[85vh] w-full max-w-full flex-col overflow-hidden rounded-t-[24px] border border-white/10 bg-[#0a0a0a] shadow-[0_40px_120px_rgba(0,0,0,0.85)] sm:h-auto sm:max-h-[85vh] sm:max-w-[600px] sm:rounded-[24px]"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 32, stiffness: 280 }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.4}
        dragSnapToOrigin
        onDragEnd={onDragEnd}
      >
        {/* Drag handle */}
        <div className="shrink-0 pb-1.5 pt-2.5">
          <div className="mx-auto h-1.5 w-12 rounded-full bg-white/20" />
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto overscroll-contain pb-4">
          {/* Image header */}
          <div className="relative h-[240px] shrink-0 sm:h-[260px]">
            <img
              src={heroImage}
              alt={displayName}
              className="h-full w-full object-cover"
              draggable={false}
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/0 via-black/0 to-black/55" />
            {isHalal && (
              <img
                src="/halal.webp"
                alt="Halal"
                className="absolute right-3 top-3 h-10 w-10 rounded-full shadow-md"
              />
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Zatvori"
              className="absolute left-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/45 text-white/95 backdrop-blur-sm transition hover:bg-black/65"
            >
              ×
            </button>
          </div>

          {/* Title + description + base price */}
          <div className="px-5 pt-4">
            <h2 className="text-[22px] font-black leading-tight text-white">{displayName}</h2>
            {item.description ? (
              <p className="mt-1.5 text-[13px] leading-5 text-white/60">{item.description}</p>
            ) : null}
            <div className="mt-3 text-[20px] font-black text-[#f2b400]">{formatEUR(basePrice)}</div>
          </div>

          {/* Pizza quantity stepper */}
          <div className="mt-5 flex items-center justify-between px-5">
            <div className="text-[13px] font-extrabold uppercase tracking-[0.18em] text-white/55">
              Količina
            </div>
            <QtyStepper
              qty={pizzaQty}
              onMinus={() => setPizzaQty((q) => Math.max(1, q - 1))}
              onPlus={() => setPizzaQty((q) => Math.min(10, q + 1))}
              minDisabled={pizzaQty <= 1}
              plusDisabled={pizzaQty >= 10}
            />
          </div>

          {/* Sauces */}
          {saucesCatalog.length > 0 && (
            <AddonSection
              title="Dodaj sosove"
              items={saucesCatalog}
              selected={selectedAddons}
              onToggle={toggleAddon}
              onChangeQty={changeAddonQty}
            />
          )}

          {/* Drinks */}
          {drinksCatalog.length > 0 && (
            <AddonSection
              title="Dodaj piće"
              items={drinksCatalog}
              selected={selectedAddons}
              onToggle={toggleAddon}
              onChangeQty={changeAddonQty}
            />
          )}

          {/* Addons (donuts, extras) */}
          {addonsCatalog.length > 0 && (
            <AddonSection
              title="Dodaci"
              items={addonsCatalog}
              selected={selectedAddons}
              onToggle={toggleAddon}
              onChangeQty={changeAddonQty}
            />
          )}

          {/* Catalog loading skeleton */}
          {!catalogLoaded && (
            <div className="mt-5 space-y-2 px-5">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded-xl bg-white/5" />
              ))}
            </div>
          )}

          {/* Note */}
          <div className="mt-6 px-5 pb-2">
            <label
              htmlFor="menu-item-note"
              className="mb-2 block text-[13px] font-extrabold uppercase tracking-[0.18em] text-white/55"
            >
              Napomena (opcionalno)
            </label>
            <textarea
              id="menu-item-note"
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 200))}
              rows={2}
              maxLength={200}
              placeholder="npr. bez luka, extra hrskavo…"
              className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[14px] text-white/90 placeholder-white/30 focus:border-[#f2b400]/40 focus:outline-none"
            />
          </div>
        </div>

        {/* Sticky CTA */}
        <div className="shrink-0 border-t border-white/10 bg-[#0a0a0a] px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
          <button
            type="button"
            onClick={handleConfirm}
            className="p-btn-gold min-h-[52px] w-full text-[15px] shadow-[0_20px_50px_-26px_rgba(242,180,0,0.95)]"
          >
            Dodaj u porudžbinu — {formatEUR(totalCents)}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function QtyStepper(props: {
  qty: number;
  onMinus: () => void;
  onPlus: () => void;
  minDisabled?: boolean;
  plusDisabled?: boolean;
}) {
  const { qty, onMinus, onPlus, minDisabled, plusDisabled } = props;
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onMinus();
        }}
        disabled={minDisabled}
        aria-label="Smanji"
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/90 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
      >
        −
      </button>
      <div className="min-w-[20px] text-center text-[16px] font-black text-white">{qty}</div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onPlus();
        }}
        disabled={plusDisabled}
        aria-label="Povećaj"
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/90 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
      >
        +
      </button>
    </div>
  );
}

function AddonSection(props: {
  title: string;
  items: CatalogItem[];
  selected: SelectedAddons;
  onToggle: (id: string, name: string, price: number) => void;
  onChangeQty: (id: string, delta: number) => void;
}) {
  const { title, items, selected, onToggle, onChangeQty } = props;
  return (
    <div className="mt-5 px-5">
      <div className="mb-2.5 text-[13px] font-extrabold uppercase tracking-[0.18em] text-white/55">
        {title}
      </div>
      <div className="flex flex-col gap-1.5">
        {items.map((it) => {
          const sel = selected.get(it.id);
          const isSel = !!sel;
          return (
            <div
              key={it.id}
              className={[
                "flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5",
                "cursor-pointer transition-all duration-150",
                isSel
                  ? "border-[#f2b400]/45 bg-[#f2b400]/8"
                  : "border-white/10 bg-white/5 hover:bg-white/10",
              ].join(" ")}
              onClick={() => !isSel && onToggle(it.id, it.name, it.price)}
              role={!isSel ? "button" : undefined}
              tabIndex={!isSel ? 0 : -1}
              onKeyDown={(e) => {
                if (!isSel && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  onToggle(it.id, it.name, it.price);
                }
              }}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-extrabold text-white/92">{it.name}</div>
                <div className="mt-0.5 text-[12px] text-[#f2b400]">{formatEUR(it.price)}</div>
              </div>
              {isSel ? (
                <QtyStepper
                  qty={sel.qty}
                  onMinus={() => onChangeQty(it.id, -1)}
                  onPlus={() => onChangeQty(it.id, 1)}
                  plusDisabled={sel.qty >= 10}
                />
              ) : (
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-[#f2b400]">
                  +
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
