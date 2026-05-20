import { useRef } from "react";
import type { CartItem, PizzaSize } from "../context/CartContext";
import { formatEUR, toSafeInt } from "../lib/money";
import {
  isDrinkCategory,
  isStuffedCrustAddonName,
  normalizeCategory,
  stuffedCrustPriceForSize,
} from "../lib/cartDrawerHelpers";
import { SmartCartImage, SmartMiniAddonImage } from "./CartDrawerImage";

export interface CartViewProps {
  // State
  items: CartItem[];
  canSubmit: boolean;
  openSaucesForItemId: string | null;
  openDrinksForItemId: string | null;
  // Handlers
  onGoToMenu: () => void;
  onRemoveFromCart: (id: string) => void;
  onSetPizzaSize: (id: string, name: string, size: PizzaSize) => void;
  onDecreaseQty: (id: string) => void;
  onIncreaseQty: (id: string) => void;
  onAddAddonToItem: (itemId: string, addon: { id: string; name: string; price: number }) => void;
  onRemoveAddonFromItem: (itemId: string, addonId: string) => void;
  onDecreaseAddonQuantity: (itemId: string, addonId: string) => void;
  onIncreaseAddonQuantity: (itemId: string, addonId: string) => void;
  onSetItemNote: (id: string, value: string) => void;
  onAddDrinkToCart: (drink: { id: string; name: string; price: number; imageKey: string; category: string }) => void;
  // onToggleSauces / onToggleDrinks wrap the setOpen*ForItemId toggle logic (prev === id ? null : id)
  onToggleSauces: (itemId: string) => void;
  onToggleDrinks: (itemId: string) => void; // also accepts "__catalog__" sentinel for multi-item drinks block
  // Catalogs
  addonsCatalog: { id: string; name: string; price: number; imageKey: string }[];
  saucesCatalog: { id: string; name: string; price: number; imageKey: string }[];
  drinksCatalog: { id: string; name: string; price: number; imageKey: string; category: string }[];
  sauceIdSet: Set<string>;
  // CSS class constants (CARD / ROW / BTN_* defined in CartDrawer, passed as props)
  cardClass: string;
  rowClass: string;
  btnNeutralClass: string;
  btnDangerClass: string;
  btnSuccessClass: string;
}

export default function CartView(props: CartViewProps) {
  // Owned internally: CartDrawer no longer needs to pass this ref down.
  // Scroll restoration (restoreDrinksScroll) runs in the click handler below.
  const drinksScrollRef = useRef<HTMLDivElement | null>(null);

  return (
    <div className="space-y-4">
      {!props.canSubmit ? (
        <div className="p-glass p-5 p-glass-hover">
          <div className="text-white/90 font-extrabold text-lg">Korpa je prazna</div>
          <div className="mt-2 text-sm text-white/70">Dodaj nešto iz menija da nastaviš.</div>
          <div className="mt-4">
            <button type="button" onClick={props.onGoToMenu} className={[props.btnSuccessClass, "w-full h-12 text-sm font-extrabold disabled:opacity-50 disabled:hover:scale-100"].join(" ")}>
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

            const addonsTotalCents = addons.reduce((s, a) => s + toSafeInt(a.price, 0) * (a.quantity ?? 1), 0);
            const baseCents = toSafeInt(it.basePrice, toSafeInt(it.price, 0));
            const perItemCents = baseCents + addonsTotalCents;
            const lineTotalCents = perItemCents * (it.quantity ?? 1);

            const isPizza = normalizeCategory(it.category ?? "").includes("pizza");
            const sauceAddons = (addons ?? []).filter((a) => props.sauceIdSet.has(a.id));
            const regularAddons = (addons ?? []).filter((a) => !props.sauceIdSet.has(a.id));

            return (
              <div key={it.id} className={props.cardClass}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <SmartCartImage image={it.image} name={it.name} alt={it.name} />

                    <div className="min-w-0">
                      <div className="text-white/90 font-extrabold leading-tight">{it.name}</div>

                      {it.size ? (
                        <div className="mt-1 text-xs text-white/60">
                          Veličina: <span className="text-white/80 font-semibold">{it.size} cm</span>
                        </div>
                      ) : null}

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-white/80">
                          {formatEUR(perItemCents)} / kom
                        </div>
                        <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-white/80">
                          Ukupno: {formatEUR(lineTotalCents)}
                        </div>
                      </div>

                      {isPizza ? (
                        <div className="mt-3 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => props.onSetPizzaSize(it.id, it.name, "33")}
                            className={[props.btnNeutralClass, "h-10 px-4 text-sm font-extrabold", it.size === "33" ? "bg-white/12 border-white/20" : ""].join(" ")}
                          >
                            33 cm
                          </button>
                          <button
                            type="button"
                            onClick={() => props.onSetPizzaSize(it.id, it.name, "50")}
                            className={[props.btnNeutralClass, "h-10 px-4 text-sm font-extrabold", it.size === "50" ? "bg-white/12 border-white/20" : ""].join(" ")}
                          >
                            50 cm
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <button type="button" onClick={() => props.onRemoveFromCart(it.id)} className={[props.btnDangerClass, "h-10 w-10 shrink-0 text-lg leading-none"].join(" ")} aria-label="Ukloni" title="Ukloni">
                    ×
                  </button>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/15 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">Količina</div>
                    <div className="mt-0.5 text-sm font-extrabold text-white/85">Izmeni broj komada</div>
                  </div>

                  <div className="grid w-[138px] grid-cols-3 gap-2">
                    <button type="button" onClick={() => props.onDecreaseQty(it.id)} className={[props.btnNeutralClass, "h-11 text-lg font-extrabold"].join(" ")}>
                      −
                    </button>
                    <div className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-center text-white/90 font-extrabold">{it.quantity ?? 1}</div>
                    <button type="button" onClick={() => props.onIncreaseQty(it.id)} className={[props.btnNeutralClass, "h-11 text-lg font-extrabold"].join(" ")}>
                      +
                    </button>
                  </div>
                </div>

                {!drink ? (
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-extrabold text-white/85">Dodaci</div>
                      <div className="text-xs text-white/55">Klikni da dodaš ili ukloniš</div>
                    </div>

                    <div className="space-y-2">
                      {props.addonsCatalog.map((a) => {
                        const existing = (regularAddons ?? []).find((x) => x.id === a.id);
                        const qty = existing?.quantity ?? 0;
                        const isActive = qty > 0;

                        const displayPrice = isStuffedCrustAddonName(a.name) ? stuffedCrustPriceForSize(it.size ?? null) : a.price;

                        return (
                          <div key={a.id} className={props.rowClass}>
                            <div className="flex items-center gap-3 min-w-0">
                              <SmartMiniAddonImage name={a.name} />

                              <div className="min-w-0">
                                <div className="text-white/90 font-extrabold leading-tight">{a.name}</div>
                                <div className="text-xs text-white/60">
                                  {formatEUR(isActive ? toSafeInt(existing?.price, displayPrice) : displayPrice)}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {isActive ? (
                                <>
                                  <button type="button" onClick={() => props.onDecreaseAddonQuantity(it.id, a.id)} className={[props.btnNeutralClass, "h-9 w-9 text-lg font-extrabold"].join(" ")}>
                                    −
                                  </button>
                                  <div className="w-7 text-center text-white/85 font-extrabold">{qty}</div>
                                  <button type="button" onClick={() => props.onIncreaseAddonQuantity(it.id, a.id)} className={[props.btnNeutralClass, "h-9 w-9 text-lg font-extrabold"].join(" ")}>
                                    +
                                  </button>
                                  <button type="button" onClick={() => props.onRemoveAddonFromItem(it.id, a.id)} className={[props.btnDangerClass, "h-9 px-3 text-sm font-extrabold"].join(" ")}>
                                    Ukloni
                                  </button>
                                </>
                              ) : (
                                <button type="button" onClick={() => props.onAddAddonToItem(it.id, { id: a.id, name: a.name, price: displayPrice })} className="p-btn-gold h-10 px-4 text-sm">
                                  Dodaj
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={() => props.onToggleSauces(it.id)}
                        className={[props.btnNeutralClass, "h-11 w-full text-sm font-extrabold justify-between px-4"].join(" ")}
                      >
                        <span>Sosevi</span>
                        <span className="text-white/60 text-xs">{props.openSaucesForItemId === it.id ? "Zatvori" : "Otvori"}</span>
                      </button>

                      {props.openSaucesForItemId === it.id ? (
                        <div className="mt-3 space-y-2">
                          {props.saucesCatalog.length ? (
                            <div className="space-y-2">
                              {props.saucesCatalog.map((s) => {
                                const existing = (sauceAddons ?? []).find((x) => x.id === s.id);
                                const qty = existing?.quantity ?? 0;
                                const isActive = qty > 0;

                                return (
                                  <div key={s.id} className={props.rowClass}>
                                    <div className="flex items-center gap-3 min-w-0">
                                      <SmartMiniAddonImage name={s.name} />
                                      <div className="min-w-0">
                                        <div className="text-white/90 font-extrabold leading-tight">{s.name}</div>
                                        <div className="text-xs text-white/60">{formatEUR(s.price)}</div>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                      {isActive ? (
                                        <>
                                          <button type="button" onClick={() => props.onDecreaseAddonQuantity(it.id, s.id)} className={[props.btnNeutralClass, "h-9 w-9 text-lg font-extrabold"].join(" ")}>
                                            −
                                          </button>
                                          <div className="w-7 text-center text-white/85 font-extrabold">{qty}</div>
                                          <button type="button" onClick={() => props.onIncreaseAddonQuantity(it.id, s.id)} className={[props.btnNeutralClass, "h-9 w-9 text-lg font-extrabold"].join(" ")}>
                                            +
                                          </button>
                                          <button type="button" onClick={() => props.onRemoveAddonFromItem(it.id, s.id)} className={[props.btnDangerClass, "h-9 px-3 text-sm font-extrabold"].join(" ")}>
                                            Ukloni
                                          </button>
                                        </>
                                      ) : (
                                        <button type="button" onClick={() => props.onAddAddonToItem(it.id, { id: s.id, name: s.name, price: s.price })} className="p-btn-gold h-10 px-4 text-sm">
                                          Dodaj
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="text-sm text-white/60">Nema dostupnih soseva.</div>
                          )}
                        </div>
                      ) : null}
                    </div>

                    {props.items.length === 1 ? (
                      <div className="mt-4">
                        <button
                          type="button"
                          onClick={() => props.onToggleDrinks(it.id)}
                          className={[props.btnNeutralClass, "h-11 w-full text-sm font-extrabold justify-between px-4"].join(" ")}
                        >
                          <span>Piće</span>
                          <span className="text-white/60 text-xs">{props.openDrinksForItemId === it.id ? "Zatvori" : "Otvori"}</span>
                        </button>

                        {props.openDrinksForItemId === it.id ? (
                          <div className="mt-3 rounded-2xl border border-white/10 bg-black/15">
                            <div ref={drinksScrollRef} className="max-h-[300px] overflow-y-auto overscroll-contain p-3 space-y-2">
                              {props.drinksCatalog.length ? (
                                <>
                                  {props.drinksCatalog.map((d) => (
                                    <div key={d.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                                      <div className="flex items-center gap-3 min-w-0">
                                        <SmartMiniAddonImage name={d.name} className="h-11 w-11 rounded-xl object-cover ring-1 ring-white/10" />
                                        <div className="min-w-0">
                                          <div className="text-white/90 font-extrabold leading-tight">{d.name}</div>
                                          <div className="text-xs text-white/60">{formatEUR(d.price)}</div>
                                        </div>
                                      </div>

                                      <button
                                        type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={(e) => {
                                          (e.currentTarget as HTMLButtonElement).blur();
                                          const scrollEl = drinksScrollRef.current;
                                          const savedTop = scrollEl?.scrollTop ?? 0;
                                          props.onAddDrinkToCart(d);
                                          requestAnimationFrame(() => {
                                            if (drinksScrollRef.current) drinksScrollRef.current.scrollTop = savedTop;
                                            requestAnimationFrame(() => {
                                              if (drinksScrollRef.current) drinksScrollRef.current.scrollTop = savedTop;
                                            });
                                          });
                                        }}
                                        className="p-btn-gold h-10 px-4 text-sm"
                                      >
                                        Dodaj
                                      </button>
                                    </div>
                                  ))}
                                </>
                              ) : (
                                <div className="text-sm text-white/60">Nema dostupnih pića.</div>
                              )}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="mt-4">
                      <label className="mb-2 block text-sm font-semibold text-white/80">Napomena za stavku (opciono)</label>
                      <textarea
                        value={it.note ?? ""}
                        onChange={(e) => props.onSetItemNote(it.id, e.target.value)}
                        className="p-input min-h-[70px] resize-none border border-white/10 focus:border-[#f2b400]/40 focus:ring-2 focus:ring-[#f2b400]/20 transition"
                        placeholder="Npr. bez luka..."
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}

          {props.items.length > 1 ? (
            <div className={props.cardClass}>
              <button
                type="button"
                onClick={() => props.onToggleDrinks("__catalog__")}
                className={[props.btnNeutralClass, "h-11 w-full text-sm font-extrabold justify-between px-4"].join(" ")}
              >
                <span>Piće</span>
                <span className="text-white/60 text-xs">{props.openDrinksForItemId === "__catalog__" ? "Zatvori" : "Otvori"}</span>
              </button>

              {props.openDrinksForItemId === "__catalog__" ? (
                <div className="mt-3 rounded-2xl border border-white/10 bg-black/15">
                  <div ref={drinksScrollRef} className="max-h-[300px] overflow-y-auto overscroll-contain p-3 space-y-2">
                    {props.drinksCatalog.length ? (
                      <>
                        {props.drinksCatalog.map((d) => (
                          <div key={d.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                            <div className="flex items-center gap-3 min-w-0">
                              <SmartMiniAddonImage name={d.name} className="h-11 w-11 rounded-xl object-cover ring-1 ring-white/10" />
                              <div className="min-w-0">
                                <div className="text-white/90 font-extrabold leading-tight">{d.name}</div>
                                <div className="text-xs text-white/60">{formatEUR(d.price)}</div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={(e) => {
                                (e.currentTarget as HTMLButtonElement).blur();
                                const scrollEl = drinksScrollRef.current;
                                const savedTop = scrollEl?.scrollTop ?? 0;
                                props.onAddDrinkToCart(d);
                                requestAnimationFrame(() => {
                                  if (drinksScrollRef.current) drinksScrollRef.current.scrollTop = savedTop;
                                  requestAnimationFrame(() => {
                                    if (drinksScrollRef.current) drinksScrollRef.current.scrollTop = savedTop;
                                  });
                                });
                              }}
                              className="p-btn-gold h-10 px-4 text-sm"
                            >
                              Dodaj
                            </button>
                          </div>
                        ))}
                      </>
                    ) : (
                      <div className="text-sm text-white/60">Nema dostupnih pića.</div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="h-3" />
    </div>
  );
}
