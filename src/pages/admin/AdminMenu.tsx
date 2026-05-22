import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatEUR } from "../../lib/money";
import { normalizeText } from "../../lib/parsing";
import {
  MenuCategory,
  VisibilityFilter,
  AdminMenuRow,
  EditorState,
  MAX_IMAGE_SIZE_BYTES,
  CATEGORY_OPTIONS,
  VISIBILITY_OPTIONS,
  EMPTY_EDITOR,
  parseEuroInputToCents,
  normalizeImageInput,
  normalizeCategory,
  safeDateTime,
  buildPreviewCandidates,
  isAdminStorageUrl,
  getSessionToken,
  apiGetMenuItems,
  apiUpsertMenuItem,
  apiUploadMenuImage,
  apiDeleteMenuImage,
  editorFromRow,
  sortMenuItems,
  getNextSortOrder,
} from "../../lib/adminMenuLib";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result) {
        reject(new Error("Neuspješno čitanje fajla."));
        return;
      }
      resolve(result);
    };

    reader.onerror = () => {
      reject(new Error("Neuspješno čitanje fajla."));
    };

    reader.readAsDataURL(file);
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

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={[
        "rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]",
        active
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-200"
          : "border-amber-500/20 bg-amber-500/10 text-amber-200",
      ].join(" ")}
    >
      {active ? "Aktivna" : "Skrivena"}
    </span>
  );
}

export default function AdminMenu() {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [items, setItems] = useState<AdminMenuRow[]>([]);
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | MenuCategory>("all");
  const [visibilityFilter, setVisibilityFilter] = useState<VisibilityFilter>("all");

  const [editor, setEditor] = useState<EditorState>(EMPTY_EDITOR);
  const [saving, setSaving] = useState(false);
  const [togglingVisibility, setTogglingVisibility] = useState(false);
  const [movingOrder, setMovingOrder] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [deletingImage, setDeletingImage] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const nameError = editor.name.trim() === "";
  const categoryError = !editor.category;
  const priceCents = parseEuroInputToCents(editor.priceInput);
  const priceError = priceCents === null;

  const filteredItems = useMemo(() => {
    const q = normalizeText(query);

    return items.filter((item) => {
      if (categoryFilter !== "all" && item.category !== categoryFilter) return false;
      if (visibilityFilter === "active" && !item.is_active) return false;
      if (visibilityFilter === "hidden" && item.is_active) return false;
      if (!q) return true;

      const haystack = normalizeText(
        [
          item.name,
          item.description ?? "",
          item.category,
          item.image ?? "",
          item.is_active ? "aktivna" : "skrivena",
          String(item.sort_order),
        ].join(" "),
      );
      return haystack.includes(q);
    });
  }, [items, query, categoryFilter, visibilityFilter]);

  const selectedExisting = useMemo(() => {
    if (!editor.id) return null;
    return items.find((item) => item.id === editor.id) ?? null;
  }, [editor.id, items]);

  const reorderScope = useMemo(() => {
    if (!selectedExisting) return [];
    if (query.trim()) return [];

    return filteredItems.filter((item) => item.category === selectedExisting.category);
  }, [filteredItems, selectedExisting, query]);

  const selectedReorderIndex = useMemo(() => {
    if (!selectedExisting) return -1;
    return reorderScope.findIndex((item) => item.id === selectedExisting.id);
  }, [reorderScope, selectedExisting]);

  const canMoveUp = selectedReorderIndex > 0;
  const canMoveDown = selectedReorderIndex >= 0 && selectedReorderIndex < reorderScope.length - 1;

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
    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  }

  function selectItem(item: AdminMenuRow) {
    setEditor(editorFromRow(item));
    setToast(null);
    setErrorMsg(null);
    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
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
        sort_order: editor.id ? selectedExisting?.sort_order : getNextSortOrder(items),
        is_active: editor.isActive,
      });

      if (!response.ok) {
        setErrorMsg(response.error);
        return;
      }

      setItems((prev) => {
        const exists = prev.some((item) => item.id === response.item.id);
        const nextItems = exists
          ? prev.map((item) => (item.id === response.item.id ? response.item : item))
          : [...prev, response.item];

        return sortMenuItems(nextItems);
      });

      setEditor(editorFromRow(response.item));
      setToast(editor.id ? "Izmjene su sačuvane." : "Nova stavka je uspješno dodata.");
    } finally {
      setSaving(false);
    }
  }

  async function onToggleVisibility() {
    if (!selectedExisting || togglingVisibility) return;

    setTogglingVisibility(true);
    setErrorMsg(null);
    setToast(null);

    try {
      const token = await getSessionToken();
      if (!token) {
        setErrorMsg("Nijeste prijavljeni. Otvorite /admin/login.");
        return;
      }

      const response = await apiUpsertMenuItem(token, {
        id: selectedExisting.id,
        is_active: !selectedExisting.is_active,
      });

      if (!response.ok) {
        setErrorMsg(response.error);
        return;
      }

      setItems((prev) => sortMenuItems(prev.map((item) => (item.id === response.item.id ? response.item : item))));
      setEditor(editorFromRow(response.item));
      setToast(response.item.is_active ? "Stavka je ponovo prikazana." : "Stavka je sakrivena.");
    } finally {
      setTogglingVisibility(false);
    }
  }

  async function onMoveSelected(direction: -1 | 1) {
    if (!selectedExisting || movingOrder) return;
    if (query.trim()) {
      setErrorMsg("Za pomjeranje prvo očisti pretragu.");
      return;
    }

    const currentIndex = reorderScope.findIndex((item) => item.id === selectedExisting.id);
    if (currentIndex < 0) return;

    const target = reorderScope[currentIndex + direction] ?? null;
    if (!target) return;

    setMovingOrder(true);
    setErrorMsg(null);
    setToast(null);

    const originalSelectedOrder = selectedExisting.sort_order;
    const originalTargetOrder = target.sort_order;
    const tempOrder = getNextSortOrder(items) + 1000;

    try {
      const token = await getSessionToken();
      if (!token) {
        setErrorMsg("Nijeste prijavljeni. Otvorite /admin/login.");
        return;
      }

      const step1 = await apiUpsertMenuItem(token, {
        id: selectedExisting.id,
        sort_order: tempOrder,
      });
      if (!step1.ok) {
        setErrorMsg(step1.error);
        return;
      }

      const step2 = await apiUpsertMenuItem(token, {
        id: target.id,
        sort_order: originalSelectedOrder,
      });
      if (!step2.ok) {
        await apiUpsertMenuItem(token, {
          id: selectedExisting.id,
          sort_order: originalSelectedOrder,
        });
        setErrorMsg(step2.error);
        await refreshMenu(selectedExisting.id);
        return;
      }

      const step3 = await apiUpsertMenuItem(token, {
        id: selectedExisting.id,
        sort_order: originalTargetOrder,
      });
      if (!step3.ok) {
        await apiUpsertMenuItem(token, {
          id: selectedExisting.id,
          sort_order: originalSelectedOrder,
        });
        await apiUpsertMenuItem(token, {
          id: target.id,
          sort_order: originalTargetOrder,
        });
        setErrorMsg(step3.error);
        await refreshMenu(selectedExisting.id);
        return;
      }

      await refreshMenu(selectedExisting.id);
      setToast(direction < 0 ? "Stavka je pomjerena nagore." : "Stavka je pomjerena nadole.");
    } finally {
      setMovingOrder(false);
    }
  }

  async function onImageFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;

    if (!file) {
      return;
    }

    setErrorMsg(null);
    setToast(null);

    if (!file.type.startsWith("image/")) {
      setErrorMsg("Dozvoljen je samo image fajl.");
      e.target.value = "";
      return;
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setErrorMsg("Slika je prevelika. Maksimum je 5MB.");
      e.target.value = "";
      return;
    }

    setUploadingImage(true);

    try {
      const token = await getSessionToken();
      if (!token) {
        setErrorMsg("Nijeste prijavljeni. Otvorite /admin/login.");
        return;
      }

      const base64 = await fileToDataUrl(file);
      const response = await apiUploadMenuImage(token, {
        fileName: file.name,
        contentType: file.type,
        base64,
        itemName: editor.name.trim() || file.name,
      });

      if (!response.ok) {
        setErrorMsg(response.error);
        return;
      }

      setEditor((prev) => ({ ...prev, image: response.publicUrl }));
      setToast("Slika je uspješno uploadovana i upisana u image polje.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload slike nije uspio.";
      setErrorMsg(msg || "Upload slike nije uspio.");
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  }

  function openImagePicker() {
    if (saving || togglingVisibility || movingOrder || uploadingImage || deletingImage) return;
    imageInputRef.current?.click();
  }

  async function onDeleteImage() {
    const currentImage = editor.image.trim();
    if (!currentImage || deletingImage) return;

    const confirmed = window.confirm(
      "Da li si siguran da želiš obrisati ovu sliku iz storage-a? Ova akcija je nepovratna.",
    );
    if (!confirmed) return;

    setDeletingImage(true);
    setErrorMsg(null);
    setToast(null);

    try {
      const token = await getSessionToken();
      if (!token) {
        setErrorMsg("Nijeste prijavljeni. Otvorite /admin/login.");
        return;
      }

      const deleteResponse = await apiDeleteMenuImage(token, { image: currentImage });
      if (!deleteResponse.ok) {
        setErrorMsg(deleteResponse.error);
        return;
      }

      if (editor.id) {
        const updateResponse = await apiUpsertMenuItem(token, { id: editor.id, image: null });
        if (!updateResponse.ok) {
          setEditor((prev) => ({ ...prev, image: "" }));
          setToast("Slika obrisana iz storage-a, ali ažuriranje baze nije uspjelo. Sačuvaj izmjene ručno.");
          return;
        }

        setItems((prev) =>
          sortMenuItems(prev.map((item) => (item.id === updateResponse.item.id ? updateResponse.item : item))),
        );
      }

      setEditor((prev) => ({ ...prev, image: "" }));
      setToast(editor.id ? "Slika je obrisana iz storage-a i iz baze." : "Slika je obrisana iz storage-a.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Brisanje slike nije uspjelo.";
      setErrorMsg(msg || "Brisanje slike nije uspjelo.");
    } finally {
      setDeletingImage(false);
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
              Vlasnik ovde dobija osnovu za uređivanje postojećih stavki iz baze: naziv, opis, kategorija, slika,
              cijena, vidljivost i redoslijed.
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
              <p className="mt-1 text-sm text-white/55">Pronađi stavku, proveri redoslijed i otvori je za izmjene.</p>
            </div>

            <button
              type="button"
              onClick={resetEditor}
              className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-white/85 transition hover:border-white/20"
            >
              + Nova stavka
            </button>
          </div>

          <div className="mt-5 space-y-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pretraga po nazivu, opisu, kategoriji..."
              className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-white/20"
            />

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as "all" | MenuCategory)}
                className="w-full min-w-0 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-white/20"
              >
                <option value="all">Sve kategorije</option>
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              <select
                value={visibilityFilter}
                onChange={(e) => setVisibilityFilter(e.target.value as VisibilityFilter)}
                className="w-full min-w-0 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-white/20"
              >
                {VISIBILITY_OPTIONS.map((opt) => (
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

            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-white/45">
              Redoslijed radi unutar iste kategorije. Dok je pretraga aktivna, pomjeranje je zaključano.
            </div>
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
                            <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
                              #{item.sort_order}
                            </span>

                            <p className="text-sm font-semibold text-white">{item.name}</p>

                            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
                              {item.category}
                            </span>

                            <StatusBadge active={item.is_active} />
                          </div>

                          <p className="mt-1 line-clamp-2 text-sm text-white/55">{item.description?.trim() || "Bez opisa"}</p>

                          <p className="mt-2 text-xs text-white/35">Kreirano: {safeDateTime(item.created_at)}</p>
                        </div>

                        <div className="shrink-0 text-right">
                          <p className="text-sm font-semibold text-white">{formatEUR(item.price_eur_cents)}</p>
                          <p className="mt-1 max-w-[180px] truncate text-xs text-white/35">{item.image?.trim() || "Bez slike"}</p>
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
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">{selectedExisting ? "Izmjena stavke" : "Nova stavka"}</h2>
              <p className="mt-1 text-sm text-white/55">
                {selectedExisting
                  ? "Menjaš postojeću stavku iz menija."
                  : "Dodaj novu stavku u postojeću menu_items tabelu."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {selectedExisting ? (
                <>
                  <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
                    Redoslijed #{selectedExisting.sort_order}
                  </span>
                  <StatusBadge active={selectedExisting.is_active} />
                </>
              ) : null}

              {selectedExisting ? (
                <div className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/55">
                  ID: <span className="font-mono text-white/75">{selectedExisting.id}</span>
                </div>
              ) : null}
            </div>
          </div>

          {selectedExisting ? (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void onToggleVisibility()}
                  disabled={togglingVisibility || saving || movingOrder || uploadingImage || deletingImage}
                  className={[
                    "rounded-2xl border px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
                    selectedExisting.is_active
                      ? "border-amber-500/20 bg-amber-500/10 text-amber-200 hover:border-amber-500/30"
                      : "border-emerald-500/20 bg-emerald-500/10 text-emerald-200 hover:border-emerald-500/30",
                  ].join(" ")}
                >
                  {togglingVisibility
                    ? "Čuvam status…"
                    : selectedExisting.is_active
                      ? "Sakrij stavku"
                      : "Prikaži stavku"}
                </button>

                <button
                  type="button"
                  onClick={() => void onMoveSelected(-1)}
                  disabled={!canMoveUp || movingOrder || saving || togglingVisibility || uploadingImage || deletingImage}
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-white/85 transition hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {movingOrder ? "Pomjeram…" : "Pomjeri gore"}
                </button>

                <button
                  type="button"
                  onClick={() => void onMoveSelected(1)}
                  disabled={!canMoveDown || movingOrder || saving || togglingVisibility || uploadingImage || deletingImage}
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-white/85 transition hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {movingOrder ? "Pomjeram…" : "Pomjeri dolje"}
                </button>
              </div>

              <p className="text-xs text-white/45">
                Pomjeranje radi unutar iste kategorije i trenutno vidljivog filtera. Ako je uključena pretraga,
                prvo je očisti.
              </p>
            </div>
          ) : null}

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

              <div className="space-y-3">
                <input
                  value={editor.image}
                  onChange={(e) => setEditor((prev) => ({ ...prev, image: e.target.value }))}
                  placeholder="/menu/capricciosa.webp"
                  className="w-full min-w-0 overflow-hidden text-ellipsis rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-white/20"
                />

                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={onImageFileChange}
                  className="hidden"
                />

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={openImagePicker}
                    disabled={saving || togglingVisibility || movingOrder || uploadingImage || deletingImage}
                    className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-white/85 transition hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {uploadingImage ? "Uploadujem sliku…" : "Upload image"}
                  </button>

                  {isAdminStorageUrl(editor.image) ? (
                    <button
                      type="button"
                      onClick={() => void onDeleteImage()}
                      disabled={saving || togglingVisibility || movingOrder || uploadingImage || deletingImage}
                      className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200 transition hover:border-red-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deletingImage ? "Brišem sliku…" : "Obriši sliku"}
                    </button>
                  ) : null}
                </div>
              </div>

              <p className="mt-2 text-xs text-white/40">
                Možeš i dalje ručno unijeti path/URL. Upload dugme šalje sliku u storage i automatski popunjava image
                polje.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-white/80">Status javnog prikaza</p>
                <StatusBadge active={editor.isActive} />
              </div>

              <p className="mt-2 text-xs text-white/45">
                Aktivna stavka se vidi na sajtu. Skrivena ostaje u bazi i može kasnije ponovo da se prikaže.
              </p>

              <label className="mt-4 flex items-center gap-3 text-sm text-white/80">
                <input
                  type="checkbox"
                  checked={editor.isActive}
                  onChange={(e) => setEditor((prev) => ({ ...prev, isActive: e.target.checked }))}
                  className="h-4 w-4 rounded border-white/20 bg-black/20"
                />
                Stavka je aktivna
              </label>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-white/80">Redoslijed</p>
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
                  {selectedExisting ? `#${selectedExisting.sort_order}` : `#${getNextSortOrder(items)}`}
                </span>
              </div>

              <p className="mt-2 text-xs text-white/45">
                Nova stavka ide na kraj liste. Postojeće stavke pomjeraj dugmadima gore/dolje.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-sm font-semibold text-white/80">Preview slike</p>

              <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                <PreviewImage image={editor.image} alt={editor.name.trim() || "Preview"} />
              </div>

              <div className="mt-3 truncate text-xs text-white/45">
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
                disabled={saving || togglingVisibility || movingOrder || uploadingImage || deletingImage}
                className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? "Čuvam…" : selectedExisting ? "Sačuvaj izmjene" : "Dodaj stavku"}
              </button>

              <button
                type="button"
                onClick={resetEditor}
                disabled={saving || togglingVisibility || movingOrder || uploadingImage || deletingImage}
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