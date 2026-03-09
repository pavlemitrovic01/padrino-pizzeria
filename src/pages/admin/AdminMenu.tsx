import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { supabaseAdminAuth } from "../../lib/supabaseAdminAuthClient";
import { formatEUR } from "../../lib/money";

type MenuCategory = "pizza" | "pica" | "sosovi" | "dodaci";

type AdminMenuRow = {
  id: string;
  name: string;
  description: string | null;
  category: MenuCategory;
  image: string | null;
  price_eur_cents: number;
  created_at: string;
};

type AdminMenuGetOk = {
  ok: true;
  items: AdminMenuRow[];
};

type AdminMenuGetErr = {
  ok: false;
  error: string;
};

type AdminMenuGetResponse = AdminMenuGetOk | AdminMenuGetErr;

type AdminMenuPostOk = {
  ok: true;
  item: AdminMenuRow;
};

type AdminMenuPostErr = {
  ok: false;
  error: string;
};

type AdminMenuPostResponse = AdminMenuPostOk | AdminMenuPostErr;

type EditorState = {
  id: string | null;
  name: string;
  description: string;
  category: MenuCategory;
  image: string;
  priceInput: string;
};

function resolveAdminApiBase(): string {
  const isDev =
    typeof import.meta !== "undefined" &&
    typeof import.meta.env !== "undefined" &&
    import.meta.env.DEV === true;

  if (!isDev) return "";

  try {
    const host = window.location.hostname;
    const port = window.location.port;
    const isLocalHost = host === "localhost" || host === "127.0.0.1";

    // Novi Phase 2 endpoint testiramo lokalno kroz vercel dev na :3000
    if (isLocalHost && port === "3000") {
      return "";
    }
  } catch {
    // fallback ispod
  }

  // Zadržavamo postojeći source-of-truth obrazac za ostale dev tokove
  return "https://padrinobudva.com";
}

const ADMIN_API_BASE = resolveAdminApiBase();

const CATEGORY_OPTIONS: Array<{ value: MenuCategory; label: string }> = [
  { value: "pizza", label: "Pizza" },
  { value: "pica", label: "Pića" },
  { value: "sosovi", label: "Sosevi" },
  { value: "dodaci", label: "Dodaci" },
];

const EMPTY_EDITOR: EditorState = {
  id: null,
  name: "",
  description: "",
  category: "pizza",
  image: "",
  priceInput: "",
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function toStr(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function toNullableStr(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s ? s : null;
}

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

function normalizeCategory(value: string): MenuCategory {
  const s = normalizeText(value);
  if (s === "pica") return "pica";
  if (s === "sosovi" || s === "sosevi") return "sosovi";
  if (s === "dodaci") return "dodaci";
  return "pizza";
}

function safeDateTime(value: string) {
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return "-";
  try {
    return new Intl.DateTimeFormat("sr-Latn-ME", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  } catch {
    return d.toLocaleString();
  }
}

function centsToInput(cents: number): string {
  if (!Number.isFinite(cents)) return "";
  return (Math.max(0, cents) / 100).toFixed(2);
}

function parseEuroInputToCents(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;
  if (!/^\d+([.]\d{1,2})?$/.test(normalized)) return null;

  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0) return null;

  return Math.round(amount * 100);
}

function normalizeImageInput(value: string): string {
  return value.trim();
}

function buildPreviewCandidates(image: string): string[] {
  const raw = image.trim();
  if (!raw) return [];

  const uniq = new Set<string>();
  uniq.add(raw);

  if (raw.startsWith("/")) {
    const file = raw.split("/").filter(Boolean).at(-1) ?? "";
    if (file) uniq.add(`/menu/${file}`);
  }

  return [...uniq];
}

function normalizeMenuRow(raw: unknown): AdminMenuRow | null {
  if (!isRecord(raw)) return null;

  const id = toStr(raw.id).trim();
  const name = toStr(raw.name).trim();
  const description = toNullableStr(raw.description);
  const category = normalizeCategory(toStr(raw.category));
  const image = toNullableStr(raw.image);
  const created_at = toStr(raw.created_at).trim();

  const centsRaw = raw.price_eur_cents;
  const cents =
    typeof centsRaw === "number" && Number.isFinite(centsRaw)
      ? Math.round(centsRaw)
      : typeof centsRaw === "string" && centsRaw.trim() !== "" && Number.isFinite(Number(centsRaw))
        ? Math.round(Number(centsRaw))
        : null;

  if (!id || !name || cents === null) return null;

  return {
    id,
    name,
    description,
    category,
    image,
    price_eur_cents: Math.max(0, cents),
    created_at,
  };
}

async function getSessionToken(): Promise<string> {
  const { data } = await supabaseAdminAuth.auth.getSession();
  const token = typeof data?.session?.access_token === "string" ? data.session.access_token.trim() : "";
  return token;
}

async function apiGetMenuItems(token: string): Promise<AdminMenuGetResponse> {
  try {
    const res = await fetch(`${ADMIN_API_BASE}/api/admin-menu`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    const body: unknown = await res.json().catch(() => null);

    if (!res.ok) {
      const msg =
        isRecord(body) && typeof body.error === "string" && body.error.trim()
          ? body.error.trim()
          : `HTTP ${res.status}`;
      return { ok: false, error: msg };
    }

    if (isRecord(body) && body.ok === true && Array.isArray(body.items)) {
      const items = body.items.map(normalizeMenuRow).filter((x): x is AdminMenuRow => Boolean(x));
      return { ok: true, items };
    }

    return { ok: false, error: "Neočekivan odgovor sa admin-menu." };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Network request failed";
    return { ok: false, error: msg || "Network request failed" };
  }
}

async function apiUpsertMenuItem(
  token: string,
  payload: {
    id?: string;
    name: string;
    description: string | null;
    category: MenuCategory;
    image: string | null;
    price_eur_cents: number;
  },
): Promise<AdminMenuPostResponse> {
  try {
    const res = await fetch(`${ADMIN_API_BASE}/api/admin-menu`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const body: unknown = await res.json().catch(() => null);

    if (!res.ok) {
      const msg =
        isRecord(body) && typeof body.error === "string" && body.error.trim()
          ? body.error.trim()
          : `HTTP ${res.status}`;
      return { ok: false, error: msg };
    }

    if (isRecord(body) && body.ok === true) {
      const item = normalizeMenuRow(body.item);
      if (!item) {
        return { ok: false, error: "Neočekivan odgovor sa admin-menu (neispravna stavka)." };
      }
      return { ok: true, item };
    }

    return { ok: false, error: "Neočekivan odgovor sa admin-menu." };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Network request failed";
    return { ok: false, error: msg || "Network request failed" };
  }
}

function editorFromRow(row: AdminMenuRow): EditorState {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    category: row.category,
    image: row.image ?? "",
    priceInput: centsToInput(row.price_eur_cents),
  };
}

function sortMenuItems(items: AdminMenuRow[]): AdminMenuRow[] {
  return [...items].sort((a, b) => {
    const cat = normalizeText(a.category).localeCompare(normalizeText(b.category));
    if (cat !== 0) return cat;
    return normalizeText(a.name).localeCompare(normalizeText(b.name));
  });
}

function fieldClassName(hasError: boolean) {
  return [
    "w-full rounded-2xl border bg-white/5 px-4 py-3 text-sm text-white outline-none transition",
    hasError ? "border-red-500/40" : "border-white/10",
    "placeholder:text-white/30 focus:border-white/20",
  ].join(" ");
}

function PreviewImage(props: { image: string; alt: string }) {
  const { image, alt } = props;
  const candidates = useMemo(() => buildPreviewCandidates(image), [image]);
  const key = useMemo(() => candidates.join("|"), [candidates]);
  const [state, setState] = useState<{ key: string; idx: number }>({ key, idx: 0 });
  const idx = state.key === key ? state.idx : 0;
  const src = candidates[idx] ?? null;

  if (!src) {
    return <div className="flex h-52 items-center justify-center text-sm text-white/35">Nema preview slike</div>;
  }

  return (
    <img
      src={src}
      alt={alt}
      className="h-52 w-full object-cover"
      decoding="async"
      onError={() =>
        setState((current) => {
          const next = current.key === key ? current : { key, idx: 0 };
          return { key, idx: next.idx < candidates.length - 1 ? next.idx + 1 : next.idx };
        })
      }
    />
  );
}

export default function AdminMenu() {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [items, setItems] = useState<AdminMenuRow[]>([]);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | MenuCategory>("all");

  const [editor, setEditor] = useState<EditorState>(EMPTY_EDITOR);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const nameError = editor.name.trim() === "";
  const categoryError = !editor.category;
  const priceCents = parseEuroInputToCents(editor.priceInput);
  const priceError = priceCents === null;

  const filteredItems = useMemo(() => {
    const q = normalizeText(query);

    return items.filter((item) => {
      if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
      if (!q) return true;

      const haystack = normalizeText([item.name, item.description ?? "", item.category, item.image ?? ""].join(" "));
      return haystack.includes(q);
    });
  }, [items, query, categoryFilter]);

  const selectedExisting = useMemo(() => {
    if (!editor.id) return null;
    return items.find((item) => item.id === editor.id) ?? null;
  }, [editor.id, items]);

  const refreshMenu = useCallback(async (preserveSelectionId?: string | null) => {
    setLoading(true);
    setErrorMsg(null);
    setToast(null);

    const token = await getSessionToken();
    if (!token) {
      setLoading(false);
      setErrorMsg("Nijeste prijavljeni. Otvorite /admin/login.");
      return;
    }

    const response = await apiGetMenuItems(token);
    if (!response.ok) {
      setLoading(false);
      setErrorMsg(response.error);
      return;
    }

    const nextItems = sortMenuItems(response.items);
    setItems(nextItems);

    if (preserveSelectionId) {
      const current = nextItems.find((item) => item.id === preserveSelectionId) ?? null;
      if (current) {
        setEditor(editorFromRow(current));
      }
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadInitial() {
      const token = await getSessionToken();
      if (cancelled) return;

      if (!token) {
        setErrorMsg("Nijeste prijavljeni. Otvorite /admin/login.");
        setLoading(false);
        return;
      }

      const response = await apiGetMenuItems(token);
      if (cancelled) return;

      if (!response.ok) {
        setErrorMsg(response.error);
        setLoading(false);
        return;
      }

      setItems(sortMenuItems(response.items));
      setLoading(false);
    }

    void loadInitial();

    return () => {
      cancelled = true;
    };
  }, []);

  function resetEditor() {
    setEditor(EMPTY_EDITOR);
    setToast(null);
    setErrorMsg(null);
  }

  function selectItem(item: AdminMenuRow) {
    setEditor(editorFromRow(item));
    setToast(null);
    setErrorMsg(null);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const name = editor.name.trim();
    const description = editor.description.trim();
    const image = normalizeImageInput(editor.image);

    if (!name) {
      setErrorMsg("Naziv stavke je obavezan.");
      return;
    }

    if (!editor.category) {
      setErrorMsg("Kategorija je obavezna.");
      return;
    }

    if (priceCents === null) {
      setErrorMsg("Cijena mora biti broj, npr. 9.50.");
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    setToast(null);

    try {
      const token = await getSessionToken();
      if (!token) {
        setErrorMsg("Nijeste prijavljeni. Otvorite /admin/login.");
        return;
      }

      const response = await apiUpsertMenuItem(token, {
        id: editor.id ?? undefined,
        name,
        description: description || null,
        category: editor.category,
        image: image || null,
        price_eur_cents: priceCents,
      });

      if (!response.ok) {
        setErrorMsg(response.error);
        return;
      }

      setItems((prev) => {
        const exists = prev.some((item) => item.id === response.item.id);
        const nextItems = exists
          ? prev.map((item) => (item.id === response.item.id ? response.item : item))
          : [response.item, ...prev];

        return sortMenuItems(nextItems);
      });

      setEditor(editorFromRow(response.item));
      setToast(editor.id ? "Izmjene su sačuvane." : "Nova stavka je uspješno dodata.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-white/10 bg-white/5 p-5 md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/45">Phase 2</p>
            <h1 className="mt-2 text-2xl font-semibold text-white md:text-3xl">Meni</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/60">
              Vlasnik ovde dobija osnovu za uređivanje postojećih stavki iz baze: naziv, opis, kategorija, slika i
              cijena.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.22em] text-white/40">Ukupno stavki</p>
              <p className="mt-1 text-lg font-semibold text-white">{items.length}</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
              <p className="text-[11px] uppercase tracking-[0.22em] text-white/40">Prikazano</p>
              <p className="mt-1 text-lg font-semibold text-white">{filteredItems.length}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 md:p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Lista stavki</h2>
              <p className="mt-1 text-sm text-white/55">Pronađi stavku i otvori je za izmjene.</p>
            </div>

            <button
              type="button"
              onClick={resetEditor}
              className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-white/85 transition hover:border-white/20"
            >
              + Nova stavka
            </button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-[1fr_220px_auto]">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pretraga po nazivu, opisu, kategoriji..."
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-white/20"
            />

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as "all" | MenuCategory)}
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-white/20"
            >
              <option value="all">Sve kategorije</option>
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => void refreshMenu(editor.id)}
              className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-white/85 transition hover:border-white/20"
            >
              Osveži
            </button>
          </div>

          <div className="mt-5">
            {loading ? (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-white/60">Učitavam meni…</div>
            ) : errorMsg && items.length === 0 ? (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-sm text-red-100">
                {errorMsg}
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-white/60">
                Nema stavki za zadati filter.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredItems.map((item) => {
                  const selected = item.id === editor.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => selectItem(item)}
                      className={[
                        "w-full rounded-2xl border p-4 text-left transition",
                        selected
                          ? "border-white/20 bg-white/10"
                          : "border-white/10 bg-black/20 hover:border-white/20 hover:bg-white/[0.07]",
                      ].join(" ")}
                    >
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-white">{item.name}</p>
                            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
                              {item.category}
                            </span>
                          </div>

                          <p className="mt-1 line-clamp-2 text-sm text-white/55">{item.description?.trim() || "Bez opisa"}</p>

                          <p className="mt-2 text-xs text-white/35">Kreirano: {safeDateTime(item.created_at)}</p>
                        </div>

                        <div className="shrink-0 text-right">
                          <p className="text-sm font-semibold text-white">{formatEUR(item.price_eur_cents)}</p>
                          <p className="mt-1 text-xs text-white/35">{item.image?.trim() || "Bez slike"}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 md:p-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">{selectedExisting ? "Izmjena stavke" : "Nova stavka"}</h2>
              <p className="mt-1 text-sm text-white/55">
                {selectedExisting
                  ? "Menjaš postojeću stavku iz menija."
                  : "Dodaj novu stavku u postojeću menu_items tabelu."}
              </p>
            </div>

            {selectedExisting ? (
              <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/55">
                ID: <span className="font-mono text-white/75">{selectedExisting.id}</span>
              </div>
            ) : null}
          </div>

          <form className="mt-5 space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="mb-2 block text-sm font-semibold text-white/80">Naziv</label>
              <input
                value={editor.name}
                onChange={(e) => setEditor((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Npr. Capricciosa 33 cm"
                className={fieldClassName(nameError)}
              />
              {nameError ? <p className="mt-2 text-xs text-red-200">Naziv je obavezan.</p> : null}
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-white/80">Opis</label>
              <textarea
                value={editor.description}
                onChange={(e) => setEditor((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Sastojci ili kratki opis stavke"
                rows={4}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-white/20"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-white/80">Kategorija</label>
              <select
                value={editor.category}
                onChange={(e) => setEditor((prev) => ({ ...prev, category: normalizeCategory(e.target.value) }))}
                className={fieldClassName(categoryError)}
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-white/80">Cijena (EUR)</label>
              <input
                value={editor.priceInput}
                onChange={(e) => setEditor((prev) => ({ ...prev, priceInput: e.target.value }))}
                inputMode="decimal"
                placeholder="Npr. 9.50"
                className={fieldClassName(priceError)}
              />
              {priceError ? <p className="mt-2 text-xs text-red-200">Unesi validnu cijenu, npr. 9.50.</p> : null}
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-white/80">Slika (path ili URL)</label>
              <input
                value={editor.image}
                onChange={(e) => setEditor((prev) => ({ ...prev, image: e.target.value }))}
                placeholder="/menu/capricciosa.webp"
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-white/20"
              />
              <p className="mt-2 text-xs text-white/40">
                U ovoj fazi slika je string path/URL. Upload radimo kasnije samo ako bude potreban.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-sm font-semibold text-white/80">Preview slike</p>

              <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                <PreviewImage image={editor.image} alt={editor.name.trim() || "Preview"} />
              </div>

              <div className="mt-3 text-xs text-white/45">
                {editor.image.trim() ? `Path/URL: ${editor.image.trim()}` : "Unesi path ili URL slike za preview."}
              </div>
            </div>

            {errorMsg ? (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {errorMsg}
              </div>
            ) : null}

            {toast ? (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                {toast}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Čuvam…" : selectedExisting ? "Sačuvaj izmjene" : "Dodaj stavku"}
              </button>

              <button
                type="button"
                onClick={resetEditor}
                disabled={saving}
                className="rounded-2xl border border-white/10 bg-black/20 px-5 py-3 text-sm font-semibold text-white/80 transition hover:border-white/20 disabled:opacity-60"
              >
                Očisti formu
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}