import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { normalizeText } from "../../lib/parsing";
import {
  MenuCategory,
  VisibilityFilter,
  AdminMenuRow,
  EditorState,
  MAX_IMAGE_SIZE_BYTES,
  EMPTY_EDITOR,
  parseEuroInputToCents,
  normalizeImageInput,
  getSessionToken,
  apiGetMenuItems,
  apiUpsertMenuItem,
  apiUploadMenuImage,
  apiDeleteMenuImage,
  editorFromRow,
  sortMenuItems,
  getNextSortOrder,
} from "../../lib/adminMenuLib";
import MenuItemList from "./MenuItemList";
import MenuEditorPanel from "./MenuEditorPanel";

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
        <MenuItemList
          loading={loading}
          errorMsg={errorMsg}
          items={items}
          filteredItems={filteredItems}
          query={query}
          onQueryChange={setQuery}
          categoryFilter={categoryFilter}
          onCategoryFilterChange={setCategoryFilter}
          visibilityFilter={visibilityFilter}
          onVisibilityFilterChange={setVisibilityFilter}
          selectedId={editor.id}
          onSelect={selectItem}
          onNew={resetEditor}
          onRefresh={() => void refreshMenu(editor.id)}
        />
        <MenuEditorPanel
          selectedExisting={selectedExisting}
          editor={editor}
          setEditor={setEditor}
          saving={saving}
          togglingVisibility={togglingVisibility}
          movingOrder={movingOrder}
          uploadingImage={uploadingImage}
          deletingImage={deletingImage}
          toast={toast}
          errorMsg={errorMsg}
          canMoveUp={canMoveUp}
          canMoveDown={canMoveDown}
          nameError={nameError}
          categoryError={categoryError}
          priceError={priceError}
          items={items}
          imageInputRef={imageInputRef}
          onSubmit={onSubmit}
          onToggleVisibility={() => void onToggleVisibility()}
          onMoveUp={() => void onMoveSelected(-1)}
          onMoveDown={() => void onMoveSelected(1)}
          onImageFileChange={onImageFileChange}
          onOpenImagePicker={openImagePicker}
          onDeleteImage={() => void onDeleteImage()}
          onReset={resetEditor}
        />
      </section>
    </div>
  );
}