import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import type { CartItem, CartAddon, PizzaSize, PizzaVariant } from "../context/CartContext";
import { formatEUR } from "../lib/money";
import { buildImageCandidates, isDrinkCategory, stripPizzaSizeFromName } from "../lib/cartDrawerHelpers";
import { useCatalogData } from "../hooks/cart/useCatalogData";
import { SmartMiniAddonImage } from "./CartDrawerImage";

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
  /**
   * Edit-mode props (L8.4). When `editingCartItemId` is provided, the sheet
   * pre-fills size/qty/addons/note from the cart item being edited. The
   * parent component (CartDrawer) decides what to do on confirm — typically
   * call `updateItemInCart(id, replacement)` instead of `addToCart`.
   */
  editingCartItemId?: string;
  initialSize?: PizzaSize | null;
  initialQty?: number;
  initialAddons?: CartAddon[];
  initialNote?: string;
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
  const {
    item,
    isHalal,
    onClose,
    onConfirm,
    editingCartItemId,
    initialSize,
    initialQty,
    initialAddons,
    initialNote,
  } = props;

  // Catalog hook fires once at first mount of the wrapper.
  const { saucesCatalog, drinksCatalog, addonsCatalog, pizzaVariantsByBaseKey } = useCatalogData();

  // Remount the inner view whenever the target item or edit-session changes —
  // this resets the internal state (qty/addons/note/size) cleanly without
  // ad-hoc reset effects.
  const remountKey = `${item?.id ?? "none"}::${editingCartItemId ?? "create"}`;

  return (
    <AnimatePresence>
      {item && (
        <SheetView
          key={remountKey}
          item={item}
          isHalal={isHalal}
          onClose={onClose}
          onConfirm={onConfirm}
          saucesCatalog={saucesCatalog}
          drinksCatalog={drinksCatalog}
          addonsCatalog={addonsCatalog}
          pizzaVariantsByBaseKey={pizzaVariantsByBaseKey}
          editingCartItemId={editingCartItemId}
          initialSize={initialSize ?? null}
          initialQty={initialQty ?? 1}
          initialAddons={initialAddons ?? []}
          initialNote={initialNote ?? ""}
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
  pizzaVariantsByBaseKey: Record<string, Partial<Record<PizzaSize, PizzaVariant>>>;
  editingCartItemId?: string;
  initialSize: PizzaSize | null;
  initialQty: number;
  initialAddons: CartAddon[];
  initialNote: string;
}) {
  const {
    item,
    isHalal,
    onClose,
    onConfirm,
    saucesCatalog,
    drinksCatalog,
    addonsCatalog,
    pizzaVariantsByBaseKey,
    editingCartItemId,
    initialSize,
    initialQty,
    initialAddons,
    initialNote,
  } = props;

  const isEditing = !!editingCartItemId;

  // ─── Size variants discovery (L8.4) ──────────────────────────────────────
  // For pizzas, look up both 33cm + 50cm variants via the shared catalog map.
  // Non-pizza items (drinks/sauces/addons) have no variants — the size picker
  // simply doesn't render.
  const baseKey = useMemo(() => stripPizzaSizeFromName(item.name), [item.name]);
  const variants = pizzaVariantsByBaseKey[baseKey] ?? null;
  const hasVariant33 = !!variants?.["33"];
  const hasVariant50 = !!variants?.["50"];
  const hasBothSizes = hasVariant33 && hasVariant50;

  // Default size resolution priority:
  //   1) Edit mode: explicit initialSize from the cart item being edited
  //   2) Variants: prefer 33 if available, else 50
  //   3) No variants: null (non-pizza items)
  const defaultSize: PizzaSize | null = useMemo(() => {
    if (initialSize && (initialSize === "33" || initialSize === "50")) {
      // Honor initial only if variant exists for it; otherwise fall through.
      if (variants?.[initialSize]) return initialSize;
    }
    if (hasVariant33) return "33";
    if (hasVariant50) return "50";
    return null;
  }, [initialSize, variants, hasVariant33, hasVariant50]);

  const [selectedSize, setSelectedSize] = useState<PizzaSize | null>(defaultSize);

  const [pizzaQty, setPizzaQty] = useState(initialQty);

  // Hydrate selectedAddons map from initial CartAddon[] in edit mode.
  const [selectedAddons, setSelectedAddons] = useState<SelectedAddons>(() => {
    const m: SelectedAddons = new Map();
    for (const a of initialAddons) {
      m.set(a.id, { name: a.name, price: a.price, qty: a.quantity });
    }
    return m;
  });

  const [note, setNote] = useState(initialNote);

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

  // Resolved variant (33 or 50) for the currently selected size. May be
  // null for non-pizza items, in which case we fall back to the menu row's
  // own price (existing pre-L8.4 behavior).
  const activeVariant: PizzaVariant | null = selectedSize ? (variants?.[selectedSize] ?? null) : null;

  const basePrice = activeVariant ? activeVariant.price : getSafeCents(item);
  // When editing a standalone drink item, suppress the "Dodaj piće" picker —
  // drinks added as addons on a drink CartItem are silently dropped by
  // CartView and the order serializer (both use addons=[] for drink categories).
  const isItemDrink = isDrinkCategory(item.category ?? "");
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

    // L8.4: prefer the active variant (33 or 50) for menu-item identity so
    // CartProvider.normalizeIncomingItem records the right size + variant
    // bookkeeping. Falls back to the row's own id/category/price if no
    // variants exist (non-pizza items like drinks).
    const cartItemId = activeVariant?.menuItemId ?? item.id;
    const cartCategory = activeVariant?.category ?? item.category ?? "";

    // For pizzas with size variants, use a display name that strips the size
    // suffix and let CartProvider keep `size` as the explicit field. This
    // matches the pre-L8.4 baseKey-based storage shape.
    const cartName = activeVariant ? displayName : item.name;
    const cartBaseKey = activeVariant ? displayName : (item.name ?? "");

    const cartItem: CartItem = {
      id: cartItemId,
      name: cartName,
      price: basePrice,
      image: heroImage,
      description: item.description ?? "",
      category: cartCategory,
      quantity: pizzaQty,
      addons: addons.length > 0 ? addons : undefined,
      note: note.trim() || undefined,
      size: selectedSize ?? null,
      baseKey: cartBaseKey,
      menuItemId: cartItemId,
      basePrice,
      variants: activeVariant && selectedSize
        ? { [selectedSize]: activeVariant }
        : undefined,
    };
    onConfirm(cartItem);
  }

  function onDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.y > 80) onClose();
  }

  return (
    <motion.div
      className="fixed inset-0 z-[90] flex items-end justify-center sm:items-center"
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

          {/* Size picker (L8.4) — render only when both 33 + 50 variants exist */}
          {hasBothSizes && selectedSize ? (
            <div className="mt-5 px-5">
              <div className="mb-2.5 text-[13px] font-extrabold uppercase tracking-[0.18em] text-white/55">
                Veličina
              </div>
              <div className="flex gap-2">
                {(["33", "50"] as const).map((sz) => {
                  const isActive = selectedSize === sz;
                  const variantPrice = variants?.[sz]?.price ?? 0;
                  return (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => setSelectedSize(sz)}
                      className={[
                        "flex-1 rounded-2xl border px-4 py-3 transition-all duration-150",
                        isActive
                          ? "border-[#f2b400]/55 bg-[#f2b400]/10 text-white"
                          : "border-white/10 bg-white/5 text-white/80 hover:bg-white/10",
                      ].join(" ")}
                      aria-pressed={isActive}
                    >
                      <div className="text-[15px] font-black leading-none">{sz} cm</div>
                      <div
                        className={[
                          "mt-1 text-[12px] font-extrabold",
                          isActive ? "text-[#f2b400]" : "text-white/55",
                        ].join(" ")}
                      >
                        {formatEUR(variantPrice)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

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

          {/* Drinks — hidden when editing a standalone drink item to prevent
              drinks-as-addons that CartView and the order serializer silently drop. */}
          {drinksCatalog.length > 0 && !isItemDrink && (
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
            {isEditing ? "Sačuvaj izmene" : "Dodaj u porudžbinu"} — {formatEUR(totalCents)}
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
              <SmartMiniAddonImage
                name={it.name}
                className="h-11 w-11 shrink-0 rounded-lg object-cover ring-1 ring-white/10"
              />
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
