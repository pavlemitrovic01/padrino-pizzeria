import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useCart } from "../context/CartProvider";
import type { CartItem } from "../context/CartContext";
import { formatEUR } from "../lib/money";

type DbMenuItem = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  image: string | null;
  price_eur_cents: number | null;
  price: number | null;
  is_active: boolean | null;
};

const PIZZA_ORDER: string[] = [
  "Capricciosa",
  "Margherita",
  "Chicken",
  "Diavolo",
  "Quattro formaggi",
  "Padrino",
  "Montenegro",
  "Anatoli",
  "Vegetariana",
  "Tuna",
  "Don Pesto",
  "Don Pamidoro",
  "Bianco",
  "Piroska",
];

const PIZZA_ALIASES = new Set<string>(["pizza", "pizze", "pice", "pizz"]);

function normalizeText(value: string) {
  return String(value ?? "")
    .toLowerCase()
    .replaceAll("č", "c")
    .replaceAll("ć", "c")
    .replaceAll("š", "s")
    .replaceAll("ž", "z")
    .replaceAll("đ", "dj")
    .replace(/\s+/g, " ")
    .trim();
}

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

function normalizeImagePath(image: string | null): string | null {
  if (!image) return null;
  const t = image.trim();
  if (!t) return null;
  if (t.startsWith("/menu/")) return t;

  const parts = t.split("/").filter(Boolean);
  const file = parts.length ? parts[parts.length - 1] : "";
  if (!file) return null;

  return `/menu/${file}`;
}

const NAME_TO_FILE: Record<string, string> = {
  "quattro formaggi": "quattro.png",
  "don pesto": "pesto.png",
  "don pamidoro": "pomodoro.png",
  "ljuti sos": "ljuti sos.png",
  "slatko ljuti": "slatko ljuti.png",
};

function buildFileCandidatesFromFilename(file: string): string[] {
  const f = String(file ?? "").trim();
  if (!f) return [];

  const lower = f.toLowerCase();
  const spaceTo20 = f.replaceAll(" ", "%20");
  const spaceTo20Lower = lower.replaceAll(" ", "%20");

  const encodedFile = encodeURIComponent(f).replaceAll("%2F", "/");
  const encodedLower = encodeURIComponent(lower).replaceAll("%2F", "/");

  const uniq = new Set<string>([
    `/menu/${f}`,
    `/menu/${lower}`,
    `/menu/${encodedFile}`,
    `/menu/${encodedLower}`,
    `/menu/${spaceTo20}`,
    `/menu/${spaceTo20Lower}`,
  ]);

  return [...uniq];
}

function buildFileCandidatesFromName(name: string): string[] {
  const raw = stripSize(name);
  const n = normalizeText(raw);
  if (!n) return [];

  const mapped = NAME_TO_FILE[n];
  if (mapped) return buildFileCandidatesFromFilename(mapped);

  const withDash = n.replaceAll(" ", "-");
  const withSpace = n;
  const noDash = withDash.replaceAll("-", "");

  const candidates = [`${withDash}.png`, `${withSpace}.png`, `${noDash}.png`];

  const djToD = withDash.replaceAll("dj", "d");
  if (djToD !== withDash) candidates.push(`${djToD}.png`);

  const uniq = new Set<string>();
  for (const file of candidates) {
    for (const c of buildFileCandidatesFromFilename(file)) uniq.add(c);
  }
  return [...uniq];
}

function buildImageCandidates(image: string | null, name: string): string[] {
  const base = normalizeImagePath(image);
  const uniq = new Set<string>();

  if (base) {
    const file = base.replace("/menu/", "");
    for (const c of buildFileCandidatesFromFilename(file)) uniq.add(c);
  }
  for (const c of buildFileCandidatesFromName(name)) uniq.add(c);

  return [...uniq];
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

type ToastState = { visible: boolean; title: string; subtitle?: string };

function SmartMenuImage(props: { image: string | null; name: string; alt: string; className: string }) {
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

function PreviewImage(props: { candidates: string[]; alt: string; className?: string }) {
  const { candidates, alt, className } = props;

  const key = useMemo(() => candidates.join("|"), [candidates]);

  const [state, setState] = useState<{ key: string; idx: number }>({ key, idx: 0 });
  const idx = state.key === key ? state.idx : 0;

  const src = candidates[idx] ?? null;
  if (!src) return <div className={["bg-white/5 rounded-2xl", className ?? ""].join(" ")} aria-hidden="true" />;

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      draggable={false}
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

export default function Menu() {
  const { addToCart, openCart } = useCart();

  const [items, setItems] = useState<DbMenuItem[]>([]);
  const [flowOpen, setFlowOpen] = useState(false);

  const [addedId, setAddedId] = useState<string | null>(null);
  const addedTimerRef = useRef<number | null>(null);

  const [toast, setToast] = useState<ToastState>({ visible: false, title: "", subtitle: "" });
  const toastTimerRef = useRef<number | null>(null);

  const [preview, setPreview] = useState<{ open: boolean; name: string; candidates: string[] }>({
    open: false,
    name: "",
    candidates: [],
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data } = await supabase.from("menu_items").select("*").eq("is_active", true);
      if (cancelled) return;
      setItems((data ?? []) as DbMenuItem[]);
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

      if (preview.open) {
        setPreview({ open: false, name: "", candidates: [] });
        return;
      }

      setFlowOpen(false);
      setAddedId(null);
      setToast((t) => ({ ...t, visible: false }));
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [flowOpen, preview.open]);

  useEffect(() => {
    return () => {
      if (addedTimerRef.current) window.clearTimeout(addedTimerRef.current);
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  const pizzasOrdered = useMemo(() => {
    const pizzaRows = items.filter((i) => {
      if (i.is_active === false) return false;
      const cat = normalizeText(i.category || "");
      if (!PIZZA_ALIASES.has(cat)) return false;
      if (is50cmName(i.name)) return false;
      return true;
    });

    const map = new Map<string, DbMenuItem>();
    for (const row of pizzaRows) {
      const key = normalizeText(stripSize(row.name));
      if (!key) continue;
      if (!map.has(key)) map.set(key, row);
    }

    const ordered: DbMenuItem[] = [];
    const usedIds = new Set<string>();
    const entries = [...map.entries()];

    for (const wantedName of PIZZA_ORDER) {
      const wanted = normalizeText(wantedName);
      const direct = map.get(wanted);
      const found = direct || entries.find(([k]) => k.includes(wanted) || wanted.includes(k))?.[1];
      if (found && !usedIds.has(found.id)) {
        ordered.push(found);
        usedIds.add(found.id);
      }
    }

    for (const row of pizzaRows) {
      if (!usedIds.has(row.id)) ordered.push(row);
    }

    return ordered;
  }, [items]);

  function showToast(next: ToastState) {
    setToast({ ...next, visible: true });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast((t) => ({ ...t, visible: false })), 1800);
  }

  function markAdded(id: string) {
    setAddedId(id);
    if (addedTimerRef.current) window.clearTimeout(addedTimerRef.current);
    addedTimerRef.current = window.setTimeout(() => setAddedId(null), 650);
  }

  function onAdd(row: DbMenuItem) {
    const cents = getSafeCents(row);
    const candidates = buildImageCandidates(row.image, row.name);
    const best = candidates[0] ?? "";

    const cartItem: CartItem = {
      id: row.id,
      name: row.name,
      price: cents,
      image: best,
      description: row.description ?? "",
      category: row.category ?? "",
      quantity: 1,
    };

    addToCart(cartItem, { openCart: false });
    markAdded(row.id);
    showToast({ visible: true, title: "Uspešno ste dodali ✅", subtitle: row.name });
  }

  function closeAll() {
    setFlowOpen(false);
    setPreview({ open: false, name: "", candidates: [] });
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

      <div className="fixed inset-0 z-50 flex items-stretch justify-center px-3 pb-10 pt-10 sm:px-4 sm:pb-12 sm:pt-14 md:px-6 md:pb-14 md:pt-20">
        <div className="relative flex h-full max-h-full w-full max-w-[1160px] flex-col overflow-hidden rounded-[32px] border border-white/10 bg-black/22 shadow-[0_40px_120px_rgba(0,0,0,0.72)] backdrop-blur-none sm:backdrop-blur-md">
          <div className="absolute inset-0">
            <img
              src="/sections/menu.webp"
              alt=""
              className="h-full w-full object-cover opacity-[0.82]"
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
          <div className="pointer-events-none absolute inset-0 rounded-[32px] ring-1 ring-inset ring-white/8" />

          <button
            type="button"
            onClick={closeAll}
            className="absolute right-4 top-4 z-20 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/30 text-white/90 transition hover:border-[#f2b400]/18 hover:bg-[#f2b400]/10 hover:text-[#fff0be]"
            aria-label="Zatvori"
          >
            ×
          </button>

          <div className="relative flex flex-col gap-5 px-5 py-6 sm:px-7 sm:py-7 lg:flex-row lg:items-end lg:justify-between lg:gap-8 lg:px-8">
            <div className="min-w-0 max-w-2xl">
              <div className="p-kicker">Meni</div>

              <h2 className="mt-3 text-center text-[28px] font-black leading-[1.08] text-white/95 sm:text-left sm:text-[38px] lg:text-[44px]">
                Iz naših srca, do vaših osmjeha.
              </h2>

              <p className="mt-3 max-w-xl text-center text-sm leading-6 text-white/68 sm:text-left sm:text-[15px] sm:leading-7">
                Odaberi svoju pizzu, pogledaj detalje i dodaj u korpu jednim klikom.
              </p>

              <div className="mt-4 mx-auto h-px w-44 bg-gradient-to-r from-[#f2b400]/45 via-[#f2b400]/18 to-transparent sm:mx-0" />
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

          <div className="relative min-h-0 flex-1 px-5 pb-6 sm:px-7 sm:pb-7 lg:px-8">
            <div className="pointer-events-none absolute inset-0 rounded-[28px] bg-black/8" />

            <div className="relative h-full overflow-y-auto overscroll-contain pb-24 pr-1 [-webkit-overflow-scrolling:touch] sm:pb-4 sm:pr-2">
              <div className="grid grid-cols-2 gap-4 pb-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7">
                {pizzasOrdered.map((row, idx) => {
                  const price = getSafeCents(row);
                  const desc = row.description ? clampText(row.description, 78) : "";
                  const isAdded = addedId === row.id;

                  const imageCandidates = buildImageCandidates(row.image, row.name);
                  const hasPreview = imageCandidates.length > 0;

                  const sizeLabel = detectSizeLabel(row.name);
                  const displayName = stripSize(row.name);

                  const onCardKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onAdd(row);
                    }
                  };

                  const card = (
                    <div
                      key={row.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => onAdd(row)}
                      onKeyDown={onCardKeyDown}
                      className={[
                        "group relative flex flex-col overflow-hidden rounded-[28px] text-left",
                        "p-glass p-glass-hover",
                        "shadow-[0_22px_65px_rgba(0,0,0,0.55)]",
                        "transition-all duration-300 hover:-translate-y-1.5",
                        "focus:outline-none focus:ring-2 focus:ring-[#f2b400]/35",
                        isAdded ? "ring-2 ring-[#f2b400] shadow-[0_0_0_6px_rgba(242,180,0,0.14)]" : "",
                      ].join(" ")}
                      aria-label={`Dodaj ${displayName} u korpu`}
                    >
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
                          className="h-[118px] w-full object-cover transition duration-300 group-hover:scale-[1.03] sm:h-[132px]"
                        />
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/50" />

                        {hasPreview ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setPreview({ open: true, name: displayName, candidates: imageCandidates });
                            }}
                            className={[
                              "absolute bottom-3 left-3 z-10 h-8 rounded-full px-3",
                              "border border-white/10 bg-black/38 text-xs font-extrabold tracking-wide text-white/88",
                              "transition hover:bg-black/48 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100",
                            ].join(" ")}
                            aria-label={`Vidi sliku: ${displayName}`}
                          >
                            Vidi sliku
                          </button>
                        ) : null}
                      </div>

                      <div className="flex flex-1 flex-col p-4 sm:p-[18px]">
                        <div className="text-[15px] font-extrabold leading-tight text-white/94 sm:text-[16px]">
                          {displayName}
                        </div>

                        {desc ? (
                          <div className="mt-1.5 min-h-[38px] text-[13px] leading-5 text-white/62 sm:text-[13.5px]">
                            {desc}
                          </div>
                        ) : (
                          <div className="mt-1.5 min-h-[38px] text-[13px] text-white/30"> </div>
                        )}

                        <div className="mt-auto pt-4">
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
                        <div className="col-span-full my-2 hidden h-px bg-gradient-to-r from-transparent via-white/10 to-transparent xl:block" />
                      </React.Fragment>
                    );
                  }

                  return card;
                })}
              </div>
            </div>
          </div>

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
                  <div className="text-sm font-extrabold text-white/92 sm:text-[15px]">{toast.title}</div>
                  {toast.subtitle ? (
                    <div className="mt-1 truncate text-xs text-white/60 sm:text-sm">{toast.subtitle}</div>
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

          {preview.open ? (
            <div className="absolute inset-0 z-30">
              <button
                type="button"
                className="absolute inset-0 bg-black/82 backdrop-blur-none sm:backdrop-blur-sm"
                aria-label="Zatvori pregled slike"
                onClick={() => setPreview({ open: false, name: "", candidates: [] })}
              />
              <div className="absolute inset-0 flex items-center justify-center px-4 py-8">
                <div className="relative w-full max-w-[860px] overflow-hidden rounded-[28px] border border-white/10 bg-black/55 shadow-[0_40px_140px_rgba(0,0,0,0.85)]">
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/0 via-white/0 to-black/35" />
                  <div className="relative flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-extrabold text-white/92">{preview.name}</div>
                      <div className="mt-0.5 text-xs text-white/55">Pregled slike</div>
                    </div>
                    <button
                      type="button"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white/85 transition hover:bg-white/15"
                      aria-label="Zatvori"
                      onClick={() => setPreview({ open: false, name: "", candidates: [] })}
                    >
                      ×
                    </button>
                  </div>

                  <div className="relative p-4 sm:p-5">
                    <div className="relative overflow-hidden rounded-2xl bg-white/5">
                      <PreviewImage
                        candidates={preview.candidates}
                        alt={preview.name}
                        className="max-h-[70vh] w-full object-contain"
                      />
                    </div>

                    <div className="mt-4 flex items-center justify-between text-xs text-white/55">
                      <span>ESC za zatvaranje</span>
                      <span className="text-[#f2b400]/90">Padrino • premium</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}