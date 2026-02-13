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

function buildImageCandidates(image: string | null, name: string): string[] {
  const base = normalizeImagePath(image);
  const uniq = new Set<string>();

  if (base) uniq.add(base);

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

function SmartMenuImage(props: {
  image: string | null;
  name: string;
  alt: string;
  className: string;
}) {
  const { image, name, alt, className } = props;
  const candidates = useMemo(
    () => buildImageCandidates(image, name),
    [image, name]
  );
  const [idx, setIdx] = useState(0);

  useEffect(() => setIdx(0), [image, name]);

  const src = candidates[idx] ?? null;

  if (!src) {
    return <div className={className + " bg-white/5"} />;
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      onError={() =>
        setIdx((i) => (i < candidates.length - 1 ? i + 1 : i))
      }
    />
  );
}

export default function Menu() {
  const { addToCart } = useCart();
  const [items, setItems] = useState<DbMenuItem[]>([]);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from("menu_items").select("*");
      setItems((data ?? []) as DbMenuItem[]);
    }
    load();
  }, []);

  const pizzasOrdered = useMemo(() => {
    return items.filter((i) => {
      const cat = normalizeText(i.category || "");
      if (!PIZZA_ALIASES.has(cat)) return false;
      if (is50cmName(i.name)) return false;
      return true;
    });
  }, [items]);

  function onAdd(row: DbMenuItem) {
    const cents = getSafeCents(row);

    addToCart(
      {
        id: row.id,
        name: row.name,
        price: cents,
        image: row.image ?? "",
        description: row.description ?? "",
        category: row.category ?? "",
        quantity: 1,
      },
      { openCart: false }
    );
  }

  return (
    <section className="relative px-6 pb-12 sm:px-8">
      <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-4 lg:grid-cols-7">
        {pizzasOrdered.map((row) => {
          const price = getSafeCents(row);
          const desc = row.description ? clampText(row.description) : "";
          const sizeLabel = detectSizeLabel(row.name);
          const displayName = stripSize(row.name);

          return (
            <div
              key={row.id}
              onClick={() => onAdd(row)}
              className="group relative rounded-[26px] overflow-hidden p-glass p-glass-hover shadow-[0_20px_65px_rgba(0,0,0,0.55)] transition-all duration-200 hover:-translate-y-[3px]"
            >
              <SmartMenuImage
                image={row.image}
                name={row.name}
                alt={displayName}
                className="h-[96px] w-full object-cover"
              />

              {/* 👇 KLJUČNO: flex column + h-full */}
              <div className="p-4 flex flex-col h-full">
                <div className="text-[15px] font-extrabold text-white/92 leading-tight">
                  {displayName}
                </div>

                {desc && (
                  <div className="mt-1 text-[14px] text-white/60 leading-snug">
                    {desc}
                  </div>
                )}

                {/* Cena odmah ispod opisa */}
                <div className="mt-3">
                  <div className="h-px w-10 bg-gradient-to-r from-[#f2b400]/35 to-transparent" />
                  <div className="mt-2 text-[14px] font-extrabold text-[#f2b400]">
                    {formatEUR(price)}
                  </div>
                </div>

                {/* 👇 33cm ide NA DNO bubble-a */}
                {sizeLabel && (
                  <div className="mt-auto pt-4 text-center text-[14px] font-extrabold text-white/95 tracking-wide">
                    {sizeLabel}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
