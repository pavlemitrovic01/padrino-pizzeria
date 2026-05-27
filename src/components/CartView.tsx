import type { CartItem } from "../context/CartContext";
import { formatEUR, toSafeInt } from "../lib/money";
import { isDrinkCategory } from "../lib/cartDrawerHelpers";
import { SmartCartImage, SmartMiniAddonImage } from "./CartDrawerImage";

/**
 * CartView (L8.4: display-only refactor)
 *
 * Cart is a read-only summary of what the customer already chose in
 * MenuItemDetailSheet. The only inline interactions are:
 *   - qty +/- per item
 *   - trash (remove item entirely)
 *   - click on the card body → emits onEditItem(id) so the parent can
 *     re-open the detail sheet pre-filled with the current snapshot.
 *
 * Removed in L8.4 (all selection now lives in the detail sheet):
 *   - size toggle 33/50 cm
 *   - "Dodaci" / "Sosevi" / "Piće" inline pickers + standalone drinks block
 *   - note textarea (still displayed read-only when set)
 *
 * No data shape changes — `items` + addons/note/size still come straight from
 * the cart state; only the rendering is trimmed. CartItem shape, Telegram
 * payload, and CartProvider.addToCart merge semantics are untouched.
 */
export interface CartViewProps {
  // State
  items: CartItem[];
  canSubmit: boolean;
  // Handlers
  onGoToMenu: () => void;
  onRemoveFromCart: (id: string) => void;
  onDecreaseQty: (id: string) => void;
  onIncreaseQty: (id: string) => void;
  onEditItem: (id: string) => void;
  // CSS class constants (CARD / BTN_* defined in CartDrawer, passed as props)
  cardClass: string;
  btnNeutralClass: string;
  btnDangerClass: string;
  btnSuccessClass: string;
}

export default function CartView(props: CartViewProps) {
  return (
    <div className="space-y-4">
      {!props.canSubmit ? (
        <div className="p-glass p-5 p-glass-hover">
          <div className="text-white/90 font-extrabold text-lg">Korpa je prazna</div>
          <div className="mt-2 text-sm text-white/70">Dodaj nešto iz menija da nastaviš.</div>
          <div className="mt-4">
            <button
              type="button"
              onClick={props.onGoToMenu}
              className={[
                props.btnSuccessClass,
                "w-full h-12 text-sm font-extrabold disabled:opacity-50 disabled:hover:scale-100",
              ].join(" ")}
            >
              Idi na meni
            </button>
          </div>
        </div>
      ) : null}

      {props.canSubmit ? (
        <div className="space-y-3">
          {props.items.map((it) => {
            const drink = isDrinkCategory(it.category ?? "");
            const addons = drink ? [] : (it.addons ?? []);

            const addonsTotalCents = addons.reduce(
              (s, a) => s + toSafeInt(a.price, 0) * (a.quantity ?? 1),
              0,
            );
            const baseCents = toSafeInt(it.basePrice, toSafeInt(it.price, 0));
            const perItemCents = baseCents + addonsTotalCents;
            const noteText = (it.note ?? "").trim();

            // The whole card is a button: clicking the body re-opens the detail
            // sheet pre-filled. The qty stepper and trash explicitly stop
            // propagation so they don't trigger the edit reopen.
            return (
              <div
                key={it.id}
                role="button"
                tabIndex={0}
                onClick={() => props.onEditItem(it.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    props.onEditItem(it.id);
                  }
                }}
                className={[
                  props.cardClass,
                  "cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#f2b400]/35",
                ].join(" ")}
                aria-label={`Izmeni ${it.name}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <SmartCartImage image={it.image} name={it.name} alt={it.name} />

                    <div className="min-w-0">
                      <div className="text-white/90 font-extrabold leading-tight">{it.name}</div>

                      {it.size ? (
                        <div className="mt-1 text-xs text-white/60">
                          Veličina:{" "}
                          <span className="text-white/80 font-semibold">{it.size} cm</span>
                        </div>
                      ) : null}

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-white/80">
                          {formatEUR(perItemCents)} / kom
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      props.onRemoveFromCart(it.id);
                    }}
                    className={[
                      props.btnDangerClass,
                      "h-10 w-10 shrink-0 text-lg leading-none",
                    ].join(" ")}
                    aria-label="Ukloni"
                    title="Ukloni"
                  >
                    ×
                  </button>
                </div>

                {/* Read-only addon summary — sauces, drinks, and stuffed crust
                    all live in cartItem.addons. We render them as a flat list
                    grouped under one "Izbori" header so the card stays
                    compact. Detail sheet is the single source of editing. */}
                {addons.length > 0 ? (
                  <div className="mt-3 space-y-1.5">
                    <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-white/45">
                      Izbori
                    </div>
                    {addons.map((a) => {
                      const qty = Math.max(1, toSafeInt(a.quantity ?? 1, 1));
                      const linePrice = toSafeInt(a.price, 0) * qty;
                      return (
                        <div
                          key={a.id}
                          className="flex items-center justify-between gap-2 rounded-xl border border-white/8 bg-white/3 px-2.5 py-1.5"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <SmartMiniAddonImage name={a.name} className="h-11 w-11 shrink-0 rounded-lg object-cover ring-1 ring-white/10" />
                            <div className="min-w-0 text-[12.5px] font-semibold text-white/85 truncate">
                              {a.name}
                              {qty > 1 ? <span className="ml-1 text-white/55">× {qty}</span> : null}
                            </div>
                          </div>
                          <div className="text-[12px] font-extrabold text-white/75 shrink-0">
                            {formatEUR(linePrice)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                {noteText ? (
                  <div className="mt-3 rounded-xl border border-white/8 bg-white/3 px-3 py-2">
                    <div className="text-[10.5px] font-extrabold uppercase tracking-[0.16em] text-white/40">
                      Napomena
                    </div>
                    <div className="mt-0.5 text-[12.5px] text-white/85 whitespace-pre-wrap break-words">
                      {noteText}
                    </div>
                  </div>
                ) : null}

                <div
                  className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/15 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
                      Količina
                    </div>
                    <div className="mt-0.5 whitespace-nowrap text-[12.5px] font-extrabold text-white/85">
                      Izmeni broj komada
                    </div>
                  </div>

                  <div className="grid w-[138px] grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        props.onDecreaseQty(it.id);
                      }}
                      className={[props.btnNeutralClass, "h-11 text-lg font-extrabold"].join(" ")}
                    >
                      −
                    </button>
                    <div className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-center text-white/90 font-extrabold">
                      {it.quantity ?? 1}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        props.onIncreaseQty(it.id);
                      }}
                      className={[props.btnNeutralClass, "h-11 text-lg font-extrabold"].join(" ")}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {props.canSubmit ? <div className="h-32" /> : null}
    </div>
  );
}
