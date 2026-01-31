import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient.ts";

type OrderStatus = "pending" | "done" | "cancelled";
type StatusFilter = "all" | OrderStatus;

type OrderRow = {
  id: string;
  created_at: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  total_price: number;
  items: unknown[] | null;
  status: OrderStatus | null;
};

type SortKey =
  | "created_desc"
  | "created_asc"
  | "price_desc"
  | "price_asc"
  | "name_asc"
  | "name_desc";

type ItemLine = {
  name: string;
  quantity: number;
  price: number;
  category?: string;
  size?: string | number | null;
  addons?: { name: string; quantity?: number; price?: number }[];
};

function statusLabel(status: OrderStatus) {
  if (status === "done") return "Završeno";
  if (status === "cancelled") return "Otkazano";
  return "Na čekanju";
}

function statusColor(status: OrderStatus) {
  if (status === "done") return "bg-green-600";
  if (status === "cancelled") return "bg-red-600";
  return "bg-orange-500";
}

function normalizeStatus(value: unknown): OrderStatus {
  if (value === "done" || value === "cancelled" || value === "pending") return value;
  return "pending";
}

/**
 * Status transition guard (stabilno, bez improvizacije)
 * Pravila:
 * - pending -> done | cancelled
 * - cancelled -> pending (samo)
 * - done -> (nema promena)
 */
function transitionError(from: OrderStatus, to: OrderStatus): string | null {
  if (from === to) return "Status je već postavljen.";
  if (from === "done") return "Završene porudžbine ne mogu menjati status.";
  if (from === "pending" && (to === "done" || to === "cancelled")) return null;
  if (from === "cancelled" && to === "pending") return null;
  if (from === "cancelled" && (to === "done" || to === "cancelled")) {
    return "Otkazana porudžbina se može vratiti samo na čekanje.";
  }
  return "Ova promena statusa nije dozvoljena.";
}

function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return transitionError(from, to) === null;
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .toLowerCase()
    .replaceAll("č", "c")
    .replaceAll("ć", "c")
    .replaceAll("š", "s")
    .replaceAll("ž", "z")
    .replaceAll("đ", "dj")
    .trim();
}

function safeNumber(value: unknown, fallback = 0) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function safeString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function parseItems(items: unknown[] | null): ItemLine[] {
  if (!Array.isArray(items)) return [];

  return items
    .map((raw) => {
      if (!raw || typeof raw !== "object") return null;

      const r = raw as Record<string, unknown>;

      const name =
        safeString(r.name) || safeString(r.title) || safeString(r.product_name) || "Stavka";

      const quantity = Math.max(1, safeNumber(r.quantity, 1));
      const price = safeNumber(r.price, 0);

      const category = typeof r.category === "string" ? r.category : undefined;
      const size = typeof r.size === "string" || typeof r.size === "number" ? r.size : null;

      const addonsRaw = r.addons;
      const addons = Array.isArray(addonsRaw)
        ? addonsRaw
            .map((a) => {
              if (!a || typeof a !== "object") return null;
              const ar = a as Record<string, unknown>;
              const aname = safeString(ar.name, "");
              if (!aname) return null;
              const aqty = safeNumber(ar.quantity, 1);
              const aprice = safeNumber(ar.price, 0);
              return { name: aname, quantity: aqty, price: aprice };
            })
            .filter((x): x is NonNullable<typeof x> => Boolean(x))
        : [];

      return { name, quantity, price, category, size, addons };
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x));
}

async function copyToClipboard(text: string) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // fallback
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }
}

function minutesSince(iso: string): number {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 0;
  const diff = Date.now() - t;
  if (!Number.isFinite(diff) || diff <= 0) return 0;
  return Math.floor(diff / 60000);
}

function formatAgeSr(mins: number) {
  if (mins <= 0) return "upravo sada";
  if (mins < 60) return `pre ${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `pre ${h} h ${m} min` : `pre ${h} h`;
}

type AgingLevel = "none" | "warn" | "urgent";
function agingLevelForPending(ageMinutes: number): AgingLevel {
  if (ageMinutes >= 20) return "urgent";
  if (ageMinutes >= 10) return "warn";
  return "none";
}

const SOUND_STORAGE_KEY = "adminSoundEnabled";
const SOUND_PATH = "/sounds/new-order.mp3";

export default function AdminOrders() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [updateErrorById, setUpdateErrorById] = useState<Record<string, string | undefined>>({});

  // UX: pretraga + filter + sortiranje
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("created_desc");

  // UX: detalji porudžbine
  const [openId, setOpenId] = useState<string | null>(null);

  // UX: osvježavanje
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  // UX: novo (highlight + badge)
  const [newOrderIds, setNewOrderIds] = useState<Set<string>>(() => new Set());
  const knownIdsRef = useRef<Set<string>>(new Set());
  const highlightTimeoutsRef = useRef<Map<string, number>>(new Map());

  // UX: toast za nove porudžbine
  const [toastText, setToastText] = useState<string | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  // UX: sound
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SOUND_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const lastBeepAtRef = useRef<number>(0);
  const soundErrorRef = useRef<string | null>(null);

  // Sound: avoid Range issues by loading as blob + objectURL (reused)
  const soundUrlRef = useRef<string | null>(null);
  const soundBlobLoadedRef = useRef<boolean>(false);

  // UX: scroll to first new (Option 3 banner)
  const orderRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

  const showToast = (text: string) => {
    setToastText(text);
    if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = window.setTimeout(() => {
      setToastText(null);
      toastTimeoutRef.current = null;
    }, 5_000);
  };

  const clearSoundObjectUrl = () => {
    if (soundUrlRef.current) {
      try {
        URL.revokeObjectURL(soundUrlRef.current);
      } catch {
        // ignore
      }
      soundUrlRef.current = null;
    }
    soundBlobLoadedRef.current = false;
  };

  const ensureSoundLoaded = async (): Promise<string | null> => {
    if (soundBlobLoadedRef.current && soundUrlRef.current) return soundUrlRef.current;

    try {
      const res = await fetch(SOUND_PATH, { cache: "no-store" });
      if (!res.ok) {
        soundErrorRef.current = `Ne mogu da učitam zvuk (${res.status}). Provjeri: public/sounds/new-order.mp3`;
        return null;
      }

      const blob = await res.blob();
      if (!blob || blob.size <= 0) {
        soundErrorRef.current =
          "Zvuk fajl je prazan ili neispravan. Provjeri: public/sounds/new-order.mp3";
        return null;
      }

      clearSoundObjectUrl();

      const url = URL.createObjectURL(blob);
      soundUrlRef.current = url;
      soundBlobLoadedRef.current = true;
      return url;
    } catch {
      soundErrorRef.current =
        "Ne mogu da učitam zvuk (network). Provjeri da fajl postoji: public/sounds/new-order.mp3";
      return null;
    }
  };

  const playSound = async (opts?: { force?: boolean }) => {
    const force = Boolean(opts?.force);

    if (!force) {
      if (!soundEnabled) return;
      if (document.visibilityState !== "visible") return;

      const now = Date.now();
      if (now - lastBeepAtRef.current < 2000) return; // rate limit
      lastBeepAtRef.current = now;
    }

    try {
      const src = await ensureSoundLoaded();
      if (!src) return false;

      const audio = new Audio(src);
      audio.volume = force ? 0.6 : 0.9;
      audio.currentTime = 0;

      await audio.play();
      soundErrorRef.current = null;
      return true;
    } catch {
      soundErrorRef.current =
        "Zvuk je blokiran (browser) ili ne može da se pusti. Klikni Sound: ON da aktiviraš.";
      return false;
    }
  };

  const clearNewHighlight = (orderId: string) => {
    setNewOrderIds((prev) => {
      if (!prev.has(orderId)) return prev;
      const next = new Set(prev);
      next.delete(orderId);
      return next;
    });

    const t = highlightTimeoutsRef.current.get(orderId);
    if (t) {
      window.clearTimeout(t);
      highlightTimeoutsRef.current.delete(orderId);
    }
  };

  const markNewOrder = (orderId: string) => {
    setNewOrderIds((prev) => {
      if (prev.has(orderId)) return prev;
      const next = new Set(prev);
      next.add(orderId);
      return next;
    });

    const existing = highlightTimeoutsRef.current.get(orderId);
    if (existing) window.clearTimeout(existing);

    const timeoutId = window.setTimeout(() => clearNewHighlight(orderId), 90_000);
    highlightTimeoutsRef.current.set(orderId, timeoutId);
  };

  // NOTE (hardening): Na grešci ne brišemo poslednje uspešno stanje.
  // Zadržavamo listu porudžbina i prikazujemo error banner + retry.
  const loadOrders = async (opts?: { silent?: boolean }) => {
    const silent = Boolean(opts?.silent);

    if (!silent) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    // Ne resetujemo error za silent refresh da ne “treperi” UI.
    // Za manual/initial load ga resetujemo.
    if (!silent) setError(null);

    try {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, created_at, customer_name, customer_phone, customer_address, total_price, items, status"
        )
        .order("created_at", { ascending: false });

      if (error) {
        setError("Greška pri učitavanju porudžbina.");
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const rows = (data ?? []) as OrderRow[];

      const hadKnown = knownIdsRef.current.size > 0;

      // detektuj nove pending porudžbine samo na silent refresh-u
      let newlyDetectedPending = 0;

      if (silent && hadKnown) {
        for (const r of rows) {
          if (!knownIdsRef.current.has(r.id)) {
            const st = normalizeStatus(r.status);
            if (st === "pending") {
              markNewOrder(r.id);
              newlyDetectedPending += 1;
            }
          }
        }
      }

      // toast + sound samo kad je tab aktivan
      if (silent && newlyDetectedPending > 0 && document.visibilityState === "visible") {
        const text =
          newlyDetectedPending === 1
            ? "Nova porudžbina (na čekanju)"
            : "Nove porudžbine: " + String(newlyDetectedPending) + " (na čekanju)";
        showToast(text);
        void playSound();
      }

      knownIdsRef.current = new Set(rows.map((r) => r.id));

      setOrders(rows);
      setError(null);
      setLastUpdatedAt(new Date().toISOString());
      setLoading(false);
      setRefreshing(false);
    } catch {
      setError("Greška pri povezivanju sa bazom.");
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      if (!mounted) return;
      await loadOrders();
    };

    void run();

    return () => {
      mounted = false;

      for (const t of highlightTimeoutsRef.current.values()) {
        window.clearTimeout(t);
      }
      highlightTimeoutsRef.current.clear();

      if (toastTimeoutRef.current) {
        window.clearTimeout(toastTimeoutRef.current);
        toastTimeoutRef.current = null;
      }

      clearSoundObjectUrl();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // AUTO-REFRESH: poll 15s samo dok je tab aktivan
  useEffect(() => {
    const POLL_MS = 15_000;

    const tick = () => {
      if (document.visibilityState !== "visible") return;
      if (updatingId) return;
      if (refreshing) return;
      void loadOrders({ silent: true });
    };

    const id = window.setInterval(tick, POLL_MS);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void loadOrders({ silent: true });
      }
    };

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updatingId, refreshing]);

  const totals = useMemo(() => {
    const all = orders.length;
    const pending = orders.filter((o) => normalizeStatus(o.status) === "pending").length;
    const done = orders.filter((o) => normalizeStatus(o.status) === "done").length;
    const cancelled = orders.filter((o) => normalizeStatus(o.status) === "cancelled").length;
    return { all, pending, done, cancelled };
  }, [orders]);

  const filteredSorted = useMemo(() => {
    const q = normalizeText(query);

    let next = orders;

    if (statusFilter !== "all") {
      next = next.filter((o) => normalizeStatus(o.status) === statusFilter);
    }

    if (q.length > 0) {
      next = next.filter((o) => {
        const hay = [o.customer_name, o.customer_phone, o.customer_address, o.total_price, o.created_at]
          .map(normalizeText)
          .join(" ");
        return hay.includes(q);
      });
    }

    const collator = new Intl.Collator("sr-Latn-ME", { sensitivity: "base" });

    const sorted = [...next].sort((a, b) => {
      if (sortKey === "created_desc") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortKey === "created_asc") {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (sortKey === "price_desc") return (b.total_price ?? 0) - (a.total_price ?? 0);
      if (sortKey === "price_asc") return (a.total_price ?? 0) - (b.total_price ?? 0);
      if (sortKey === "name_asc")
        return collator.compare(a.customer_name ?? "", b.customer_name ?? "");
      return collator.compare(b.customer_name ?? "", a.customer_name ?? "");
    });

    return sorted;
  }, [orders, query, statusFilter, sortKey]);

  const newPendingInView = useMemo(() => {
    if (newOrderIds.size === 0) return 0;
    let count = 0;
    for (const o of filteredSorted) {
      const st = normalizeStatus(o.status);
      if (st === "pending" && newOrderIds.has(o.id)) count += 1;
    }
    return count;
  }, [filteredSorted, newOrderIds]);

  const scrollToFirstNewInView = () => {
    if (newOrderIds.size === 0) return;

    const first = filteredSorted.find((o) => {
      const st = normalizeStatus(o.status);
      return st === "pending" && newOrderIds.has(o.id);
    });

    if (!first) return;

    const el = orderRefs.current.get(first.id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  async function updateStatus(orderId: string, next: OrderStatus) {
    const current = orders.find((o) => o.id === orderId);
    const currentStatus = normalizeStatus(current?.status);

    if (!current) return;
    if (updatingId) return;
    if (currentStatus === next) return;

    // GUARD: blokiraj nedozvoljene tranzicije
    const guardMsg = transitionError(currentStatus, next);
    if (guardMsg) {
      setUpdateErrorById((prev) => ({ ...prev, [orderId]: guardMsg }));
      return;
    }

    const msg =
      next === "done"
        ? "Da li ste sigurni da želite da označite porudžbinu kao završenu?"
        : next === "cancelled"
        ? "Da li ste sigurni da želite da otkažete porudžbinu?"
        : "Da li ste sigurni da želite da vratite otkazanu porudžbinu na čekanje?";

    if (!window.confirm(msg)) return;

    setUpdatingId(orderId);
    setUpdateErrorById((prev) => ({ ...prev, [orderId]: undefined }));

    try {
      const { error } = await supabase.from("orders").update({ status: next }).eq("id", orderId);
      if (error) {
        setUpdateErrorById((prev) => ({
          ...prev,
          [orderId]: "Greška pri ažuriranju statusa.",
        }));
        return;
      }

      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: next } : o)));
      clearNewHighlight(orderId);
    } catch {
      setUpdateErrorById((prev) => ({
        ...prev,
        [orderId]: "Greška pri ažuriranju statusa.",
      }));
    } finally {
      setUpdatingId(null);
    }
  }

  // klik na Sound: OFF → ON mora da proba play u istom handleru (user gesture)
  const enableSound = async () => {
    clearSoundObjectUrl();

    const ok = await playSound({ force: true });
    if (!ok) {
      setSoundEnabled(false);
      try {
        localStorage.setItem(SOUND_STORAGE_KEY, "0");
      } catch {
        // ignore
      }
      showToast(soundErrorRef.current ?? "Ne mogu da pustim zvuk.");
      return;
    }

    setSoundEnabled(true);
    try {
      localStorage.setItem(SOUND_STORAGE_KEY, "1");
    } catch {
      // ignore
    }
    showToast("Zvuk uključen");
  };

  const disableSound = () => {
    setSoundEnabled(false);
    try {
      localStorage.setItem(SOUND_STORAGE_KEY, "0");
    } catch {
      // ignore
    }
    showToast("Zvuk isključen");
  };

  const FilterPill = ({
    active,
    label,
    onClick,
  }: {
    active: boolean;
    label: string;
    onClick: () => void;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className={[
        "px-3 py-1 rounded-full text-xs font-semibold border transition",
        active
          ? "bg-white text-black border-white"
          : "bg-black/40 text-gray-200 border-white/10 hover:border-white/25",
      ].join(" ")}
    >
      {label}
    </button>
  );

  // Hardening: ako već imamo porudžbine, ne prekidamo UI zbog error-a.
  if (loading && orders.length === 0) {
    return <div className="p-8 text-gray-400">Učitavanje porudžbina…</div>;
  }

  const hasOrders = orders.length > 0;

  // Ako nema ništa i postoji error — prikaži retry ekran.
  if (!hasOrders && error) {
    return (
      <div className="p-8">
        <div className="rounded-2xl border border-red-500/25 bg-red-500/[0.06] p-6">
          <p className="text-white font-extrabold text-lg">Ne mogu da učitam porudžbine</p>
          <p className="text-sm text-red-200 mt-2">{error}</p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => void loadOrders()}
              className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-black"
            >
              Pokušaj ponovo
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Ako se problem ponavlja, proveri konekciju i Supabase status.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* TOAST */}
      {toastText && (
        <div className="fixed top-5 right-5 z-50">
          <div className="rounded-2xl border border-white/10 bg-black/80 backdrop-blur px-4 py-3 shadow-lg">
            <p className="text-sm font-extrabold text-white">{toastText}</p>
            <p className="text-xs text-gray-400 mt-0.5">Automatsko osvježavanje je aktivno</p>
            {soundErrorRef.current && <p className="text-xs text-yellow-300 mt-1">{soundErrorRef.current}</p>}
          </div>
        </div>
      )}

      {/* ERROR BANNER (non-blocking) */}
      {error && hasOrders && (
        <div className="mb-4 rounded-2xl border border-red-500/25 bg-red-500/[0.06] px-4 py-3">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-extrabold text-red-200">Problem sa učitavanjem</p>
              <p className="text-xs text-red-200/80 mt-0.5">{error}</p>
            </div>
            <div className="shrink-0 flex gap-2">
              <button
                type="button"
                onClick={() => void loadOrders()}
                className="rounded-2xl bg-white px-4 py-2 text-xs font-extrabold text-black"
                title="Pokušaj ponovo"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-white">Admin — Porudžbine</h1>
          <p className="text-sm text-gray-400 mt-1">
            Ukupno: <span className="text-gray-200 font-semibold">{totals.all}</span>
            {" · "}
            Na čekanju: <span className="text-gray-200 font-semibold">{totals.pending}</span>
            {" · "}
            Završeno: <span className="text-gray-200 font-semibold">{totals.done}</span>
            {" · "}
            Otkazano: <span className="text-gray-200 font-semibold">{totals.cancelled}</span>
          </p>
          <p className="text-xs text-gray-600 mt-1">
            Posljednje osvježavanje:{" "}
            <span className="text-gray-400">
              {lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleString("sr-Latn-ME") : "—"}
            </span>
          </p>
        </div>

        <div className="flex flex-col gap-3 w-full md:w-[560px]">
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pretraga po imenu, telefonu ili adresi…"
              className="w-full rounded-2xl bg-black/40 border border-white/10 px-4 py-3 text-sm text-white placeholder:text-gray-500 outline-none focus:border-white/25"
            />
            <button
              type="button"
              onClick={() => void loadOrders({ silent: true })}
              disabled={refreshing}
              className="shrink-0 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-black disabled:opacity-60"
              title="Osvježi"
            >
              {refreshing ? "Osvježavam…" : "Osvježi"}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <FilterPill active={statusFilter === "all"} label="Sve" onClick={() => setStatusFilter("all")} />
            <FilterPill
              active={statusFilter === "pending"}
              label="Na čekanju"
              onClick={() => setStatusFilter("pending")}
            />
            <FilterPill active={statusFilter === "done"} label="Završeno" onClick={() => setStatusFilter("done")} />
            <FilterPill
              active={statusFilter === "cancelled"}
              label="Otkazano"
              onClick={() => setStatusFilter("cancelled")}
            />

            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => (soundEnabled ? disableSound() : void enableSound())}
                className={[
                  "rounded-2xl border px-3 py-2 text-xs font-bold transition",
                  soundEnabled
                    ? "bg-yellow-500 text-black border-yellow-500"
                    : "bg-black/40 text-gray-200 border-white/10 hover:border-white/25",
                ].join(" ")}
                title="Zvuk za nove porudžbine"
              >
                {soundEnabled ? "Sound: ON" : "Sound: OFF"}
              </button>

              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="rounded-2xl bg-black/40 border border-white/10 px-3 py-2 text-xs text-white outline-none focus:border-white/25"
              >
                <option value="created_desc">Najnovije prvo</option>
                <option value="created_asc">Najstarije prvo</option>
                <option value="price_desc">Cijena ↓</option>
                <option value="price_asc">Cijena ↑</option>
                <option value="name_asc">Ime A–Z</option>
                <option value="name_desc">Ime Z–A</option>
              </select>
            </div>
          </div>

          <p className="text-xs text-gray-500">
            Prikazujem: <span className="text-gray-300 font-semibold">{filteredSorted.length}</span>
          </p>
        </div>
      </div>

      {/* OPCIJA 3: inline banner iznad liste (klik -> skrol na prvu novu) */}
      {newPendingInView > 0 && (
        <div className="mb-4">
          <button
            type="button"
            onClick={scrollToFirstNewInView}
            className="w-full rounded-2xl border border-yellow-400/30 bg-yellow-500/10 px-4 py-3 text-left hover:border-yellow-400/45 transition"
            title="Skroluj na prvu novu porudžbinu"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-extrabold text-yellow-200">Nove porudžbine: {newPendingInView}</p>
                <p className="text-xs text-yellow-200/70 mt-0.5">Klikni da skroluješ na prvu novu porudžbinu</p>
              </div>
              <span className="shrink-0 px-3 py-1 rounded-full text-xs font-extrabold bg-yellow-500 text-black">
                PRIKAŽI
              </span>
            </div>
          </button>
        </div>
      )}

      {filteredSorted.length === 0 ? (
        <div className="p-8 text-gray-400">Nema porudžbina za ovaj filter.</div>
      ) : (
        <div className="space-y-4">
          {filteredSorted.map((o) => {
            const st = normalizeStatus(o.status);
            const items = parseItems(o.items);
            const itemsCount = items.reduce((sum, it) => sum + (it.quantity ?? 1), 0);
            const isUpdatingThis = updatingId === o.id;
            const isOpen = openId === o.id;

            const isNew = st === "pending" && newOrderIds.has(o.id);

            const ageMins = st === "pending" ? minutesSince(o.created_at) : 0;
            const aging = st === "pending" ? agingLevelForPending(ageMins) : "none";

            const agingCardClass =
              aging === "urgent"
                ? "border-red-500/30 ring-2 ring-red-500/15 bg-red-500/[0.03]"
                : aging === "warn"
                ? "border-yellow-500/25 ring-2 ring-yellow-500/10 bg-yellow-500/[0.03]"
                : "border-white/10";

            const cardClass = isNew ? "border-yellow-400/40 ring-2 ring-yellow-500/20" : agingCardClass;

            const agePill =
              st === "pending" && aging !== "none" ? (
                <span
                  className={[
                    "px-2 py-1 rounded-full text-[10px] font-extrabold",
                    aging === "urgent" ? "bg-red-500 text-white" : "bg-yellow-500 text-black",
                  ].join(" ")}
                  title="Starost pending porudžbine"
                >
                  {aging === "urgent" ? "HITNO" : "ČEKA DUŽE"}
                </span>
              ) : null;

            const ageText =
              st === "pending" ? (
                <span
                  className={[
                    "ml-2 font-semibold",
                    aging === "urgent"
                      ? "text-red-300"
                      : aging === "warn"
                      ? "text-yellow-200"
                      : "text-gray-400",
                  ].join(" ")}
                  title="Starost porudžbine"
                >
                  ({formatAgeSr(ageMins)})
                </span>
              ) : null;

            return (
              <div
                key={o.id}
                ref={(el) => {
                  orderRefs.current.set(o.id, el);
                }}
                className={["rounded-2xl border p-5 transition bg-[#121212]", cardClass].join(" ")}
              >
                <div className="flex justify-between items-start gap-6">
                  <div className="min-w-0">
                    <p className="text-white font-semibold truncate">{o.customer_name}</p>

                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <p className="text-sm text-gray-400">{o.customer_phone}</p>
                      <button
                        type="button"
                        onClick={() => void copyToClipboard(o.customer_phone)}
                        className="text-xs rounded-full border border-white/10 px-2 py-1 text-gray-200 hover:border-white/25"
                        title="Kopiraj telefon"
                      >
                        Kopiraj
                      </button>
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <p className="text-sm text-gray-400 truncate">{o.customer_address}</p>
                      <button
                        type="button"
                        onClick={() => void copyToClipboard(o.customer_address)}
                        className="text-xs rounded-full border border-white/10 px-2 py-1 text-gray-200 hover:border-white/25"
                        title="Kopiraj adresu"
                      >
                        Kopiraj
                      </button>
                    </div>

                    <div className="mt-3 flex items-center gap-3">
                      <span
                        className={["px-3 py-1 rounded-full text-xs font-bold text-white", statusColor(st)].join(" ")}
                      >
                        {statusLabel(st)}
                      </span>

                      {isNew && (
                        <span className="px-2 py-1 rounded-full text-[10px] font-extrabold bg-yellow-500 text-black">
                          NOVO
                        </span>
                      )}

                      {agePill}

                      <span className="text-xs text-gray-400">Status</span>

                      <button
                        type="button"
                        onClick={() => {
                          setOpenId((prev) => (prev === o.id ? null : o.id));
                          if (isNew) clearNewHighlight(o.id);
                        }}
                        className="ml-2 text-xs rounded-full border border-white/10 px-3 py-1 text-gray-200 hover:border-white/25"
                      >
                        {isOpen ? "Sakrij detalje" : "Detalji"}
                      </button>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-white font-bold">{o.total_price} RSD</p>
                    <p className="text-xs text-gray-400">{itemsCount} stavki</p>
                    <p className="mt-3 text-xs text-gray-500">
                      Kreirano: {new Date(o.created_at).toLocaleString("sr-Latn-ME")}
                      {ageText}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mt-4">
                  <button
                    type="button"
                    className="px-4 py-2 rounded bg-green-600 text-white font-semibold disabled:opacity-60"
                    disabled={isUpdatingThis || !canTransition(st, "done")}
                    onClick={() => void updateStatus(o.id, "done")}
                  >
                    Označi kao završeno
                  </button>

                  <button
                    type="button"
                    className="px-4 py-2 rounded bg-red-600 text-white font-semibold disabled:opacity-60"
                    disabled={isUpdatingThis || !canTransition(st, "cancelled")}
                    onClick={() => void updateStatus(o.id, "cancelled")}
                  >
                    Otkaži
                  </button>

                  <button
                    type="button"
                    className="px-4 py-2 rounded bg-orange-600 text-white font-semibold disabled:opacity-60"
                    disabled={isUpdatingThis || !canTransition(st, "pending")}
                    onClick={() => void updateStatus(o.id, "pending")}
                  >
                    Vrati na čekanje
                  </button>
                </div>

                {updateErrorById[o.id] && <p className="text-xs text-red-400 mt-2">{updateErrorById[o.id]}</p>}

                {isOpen && (
                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
                    <p className="text-sm font-semibold text-white mb-3">Stavke</p>

                    {items.length === 0 ? (
                      <p className="text-sm text-gray-400">Nema stavki u porudžbini.</p>
                    ) : (
                      <div className="space-y-3">
                        {items.map((it, idx) => {
                          const addons = it.addons ?? [];
                          return (
                            <div
                              key={String(o.id) + "-" + String(idx)}
                              className="rounded-xl border border-white/10 bg-black/30 p-3"
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                  <p className="text-white font-semibold truncate">{it.name}</p>
                                  <p className="text-xs text-gray-400 mt-1">
                                    Količina:{" "}
                                    <span className="text-gray-200 font-semibold">{it.quantity}</span>
                                    {it.size !== null && it.size !== undefined && it.size !== "" ? (
                                      <>
                                        {" · "}Veličina:{" "}
                                        <span className="text-gray-200 font-semibold">{String(it.size)}</span>
                                      </>
                                    ) : null}
                                  </p>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="text-white font-bold">{it.price} RSD</p>
                                </div>
                              </div>

                              {addons.length > 0 && (
                                <div className="mt-3">
                                  <p className="text-xs text-gray-400 mb-2">Dodaci</p>
                                  <div className="flex flex-col gap-1">
                                    {addons.map((a, aidx) => (
                                      <div
                                        key={String(o.id) + "-" + String(idx) + "-a-" + String(aidx)}
                                        className="flex items-center justify-between text-xs rounded-lg border border-white/10 bg-black/30 px-2 py-1"
                                      >
                                        <span className="text-gray-200">
                                          {a.name}
                                          {typeof a.quantity === "number" && a.quantity > 1
                                            ? " ×" + String(a.quantity)
                                            : ""}
                                        </span>
                                        <span className="text-gray-400">
                                          {typeof a.price === "number" && a.price > 0 ? String(a.price) + " RSD" : ""}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
