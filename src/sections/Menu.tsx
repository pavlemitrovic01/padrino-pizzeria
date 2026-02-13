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
  const [idx, setIdx] = useState(0);

  useEffect(() => setIdx(0), [image, name]);

  const src = candidates[idx] ?? null;
  if (!src) return <div className={className + " bg-white/5"} aria-hidden="true" />;

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      onError={() => setIdx((i) => (i < candidates.length - 1 ? i + 1 : i))}
    />
  );
}

function PreviewImage(props: { candidates: string[]; alt: string; className?: string }) {
  const { candidates, alt, className } = props;
  const [idx, setIdx] = useState(0);

  useEffect(() => setIdx(0), [candidates.join("|")]);

  const src = candidates[idx] ?? null;
  if (!src) return <div className={["bg-white/5 rounded-2xl", className ?? ""].join(" ")} aria-hidden="true" />;

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      draggable={false}
      decoding="async"
      onError={() => setIdx((i) => (i < candidates.length - 1 ? i + 1 : i))}
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
      const { data } = await supabase.from("menu_items").select("*");
      if (cancelled) return;
      setItems((data ?? []) as DbMenuItem[]);
    }
    load();
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
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-none sm:backdrop-blur-sm"
        onClick={closeAll}
      />

      <div className="fixed inset-0 z-50 flex justify-center items-stretch px-4 pb-14 pt-12 sm:pt-16 md:pt-20">
        <div className="relative w-full max-w-[1080px] h-full max-h-full flex flex-col overflow-hidden rounded-[30px] ring-1 ring-white/10 shadow-[0_40px_120px_rgba(0,0,0,0.70)] bg-black/20 backdrop-blur-none sm:backdrop-blur-md">
          {/* Background image (prosvetljeno, da se vidi menu.webp) */}
          <div className="absolute inset-0">
            <img
              src="/sections/menu.webp"
              alt=""
              className="h-full w-full object-cover opacity-85"
              draggable={false}
              loading="eager"
              decoding="async"
            />
            <div className="absolute inset-0 bg-black/40" />
            <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/30 to-black/50" />
          </div>

          <div className="pointer-events-none absolute -top-36 -left-36 h-96 w-96 rounded-full bg-[#f2b400]/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-44 -right-44 h-[520px] w-[520px] rounded-full bg-white/6 blur-3xl" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/0 via-white/0 to-black/25" />

          {/* X (top-right) */}
          <button
            type="button"
            onClick={closeAll}
            className="absolute right-4 top-4 z-20 h-11 w-11 rounded-full bg-white/10 text-white/90 hover:bg-white/15 transition flex items-center justify-center"
            aria-label="Zatvori"
          >
            ×
          </button>

          {/* Header (FIX: ne sužava naslov) */}
          <div className="relative flex flex-col gap-5 px-6 py-6 sm:flex-row sm:items-start sm:justify-between sm:gap-8 sm:px-8 sm:py-7">
            {/* Left becomes flex-1 so it keeps width; title is single text node (no forced line breaks) */}
            <div className="min-w-0 w-full sm:flex-1">
              <div className="p-kicker">Meni</div>
              <h2 className="mt-2 text-[24px] sm:text-[34px] leading-[1.12] sm:leading-tight font-extrabold tracking-normal sm:tracking-wide text-white/92 text-center sm:text-left">
                Iz naših srca, do vaših osmjeha.
              </h2>
              <div className="mt-4 h-px w-56 mx-auto sm:mx-0 bg-gradient-to-r from-[#f2b400]/35 to-transparent" />
            </div>

            {/* CTA: pomeren ulevo bez skupljanja levog bloka */}
            <div className="flex w-full shrink-0 items-center justify-center sm:w-auto sm:justify-end sm:mr-14">
              <button
                type="button"
                onClick={goToCart}
                className="h-11 px-5 rounded-full bg-[#f2b400] text-black font-extrabold shadow-[0_18px_60px_rgba(0,0,0,0.45)] hover:brightness-105 active:brightness-95 transition"
              >
                Idi na korpu
              </button>
            </div>
          </div>

          <div className="relative px-6 pb-8 sm:px-8 flex-1 min-h-0">
            <div className="pointer-events-none absolute inset-0 rounded-[26px] bg-black/10" />

            <div className="relative h-full overflow-y-auto pr-2 pb-24 sm:pb-4 overscroll-contain [-webkit-overflow-scrolling:touch]">
              <div className="grid grid-cols-2 gap-4 sm:gap-6 pb-3 md:grid-cols-4 lg:grid-cols-7">
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
                        "group text-left relative",
                        "rounded-[26px] overflow-hidden",
                        "p-glass p-glass-hover",
                        "shadow-[0_20px_65px_rgba(0,0,0,0.55)]",
                        "transition-all duration-200",
                        "hover:-translate-y-[3px]",
                        "focus:outline-none focus:ring-2 focus:ring-[#f2b400]/35",
                        isAdded ? "ring-2 ring-[#f2b400] shadow-[0_0_0_6px_rgba(242,180,0,0.14)]" : "",
                      ].join(" ")}
                      aria-label={`Dodaj ${displayName} u korpu`}
                    >
                      <div
                        className={[
                          "absolute right-3 top-3 z-10",
                          "h-7 w-7 rounded-full",
                          "bg-emerald-500 text-black",
                          "flex items-center justify-center font-black",
                          "shadow-[0_10px_30px_rgba(0,0,0,0.55)]",
                          "transition-all duration-200",
                          isAdded ? "opacity-100 scale-100" : "opacity-0 scale-90",
                        ].join(" ")}
                        aria-hidden="true"
                      >
                        ✓
                      </div>

                      <div className="relative">
                        <SmartMenuImage
                          image={row.image}
                          name={row.name}
                          alt={displayName}
                          className="h-[96px] w-full object-cover"
                        />
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/0 via-black/0 to-black/35" />

                        {hasPreview ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setPreview({ open: true, name: displayName, candidates: imageCandidates });
                            }}
                            className={[
                              "absolute left-3 bottom-3 z-10",
                              "h-8 px-3 rounded-full",
                              "border border-white/10",
                              "bg-black/35 sm:bg-black/30",
                              "backdrop-blur-none sm:backdrop-blur-md",
                              "text-xs font-extrabold tracking-wide text-white/85",
                              "hover:bg-black/45 sm:hover:bg-black/40",
                              "transition",
                              "sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100",
                            ].join(" ")}
                            aria-label={`Vidi sliku: ${displayName}`}
                          >
                            Vidi sliku
                          </button>
                        ) : null}
                      </div>

                      <div className="p-4">
                        <div className="text-[15px] font-extrabold text-white/92 leading-tight">
                          {displayName}
                        </div>

                        {desc ? (
                          <div className="mt-1 text-[14px] text-white/60 leading-snug">{desc}</div>
                        ) : (
                          <div className="mt-1 text-[14px] text-white/35"> </div>
                        )}

                        <div className="mt-3">
                          <div className="h-px w-10 bg-gradient-to-r from-[#f2b400]/35 to-transparent" />

                          {/* Cena + size ispod cene (belo, bold) */}
                          <div className="mt-2">
                            <div className="text-[14px] font-extrabold text-[#f2b400]">{formatEUR(price)}</div>
                            {sizeLabel ? (
                              <div className="mt-1 text-[14px] font-extrabold text-white/92">{sizeLabel}</div>
                            ) : null}
                          </div>
                        </div>

                        <div className="mt-3 text-[10px] tracking-wide text-white/0 group-hover:text-white/45 transition">
                          Klikni za dodavanje
                        </div>
                      </div>
                    </div>
                  );

                  if (idx === 6) {
                    return (
                      <React.Fragment key={`wrap-${row.id}`}>
                        {card}
                        <div className="hidden lg:block col-span-full h-px my-2 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
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
              "pointer-events-none absolute left-0 right-0 bottom-0 z-20",
              "px-4 pb-[max(16px,env(safe-area-inset-bottom))]",
              "transition-all duration-200",
              toast.visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3",
            ].join(" ")}
            aria-live="polite"
            aria-atomic="true"
          >
            <div className="mx-auto max-w-[720px]">
              <div
                className={[
                  "pointer-events-auto",
                  "p-glass",
                  "px-4 py-3 sm:px-5 sm:py-4",
                  "flex items-center justify-between gap-3",
                ].join(" ")}
              >
                <div className="min-w-0">
                  <div className="text-sm sm:text-[15px] font-extrabold text-white/90">{toast.title}</div>
                  {toast.subtitle ? (
                    <div className="mt-1 text-xs sm:text-sm text-white/60 truncate">{toast.subtitle}</div>
                  ) : null}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={goToCart}
                    className="h-10 px-4 rounded-full bg-[#f2b400] text-black font-extrabold hover:brightness-105 active:brightness-95 transition"
                  >
                    Idi na korpu
                  </button>

                  <button
                    type="button"
                    onClick={() => setToast((t) => ({ ...t, visible: false }))}
                    className="h-10 w-10 rounded-full bg-white/10 text-white/85 hover:bg-white/15 transition"
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
                className="absolute inset-0 bg-black/80 backdrop-blur-none sm:backdrop-blur-sm"
                aria-label="Zatvori pregled slike"
                onClick={() => setPreview({ open: false, name: "", candidates: [] })}
              />
              <div className="absolute inset-0 flex items-center justify-center px-4 py-8">
                <div className="relative w-full max-w-[820px] overflow-hidden rounded-[26px] border border-white/10 bg-black/55 shadow-[0_40px_140px_rgba(0,0,0,0.85)]">
                  <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-white/0 via-white/0 to-black/35" />
                  <div className="relative flex items-center justify-between gap-3 px-5 py-4 border-b border-white/10">
                    <div className="min-w-0">
                      <div className="text-sm font-extrabold text-white/92 truncate">{preview.name}</div>
                      <div className="mt-0.5 text-xs text-white/55">Pregled slike</div>
                    </div>
                    <button
                      type="button"
                      className="h-10 w-10 rounded-full bg-white/10 text-white/85 hover:bg-white/15 transition"
                      aria-label="Zatvori"
                      onClick={() => setPreview({ open: false, name: "", candidates: [] })}
                    >
                      ×
                    </button>
                  </div>

                  <div className="relative p-4 sm:p-5">
                    <div className="relative overflow-hidden rounded-2xl bg-white/5">
                      <PreviewImage candidates={preview.candidates} alt={preview.name} className="w-full max-h-[70vh] object-contain" />
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
