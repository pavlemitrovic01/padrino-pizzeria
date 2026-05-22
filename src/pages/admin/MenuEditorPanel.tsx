import { ChangeEvent, FormEvent, useMemo, useState } from "react";
import {
  AdminMenuRow,
  EditorState,
  CATEGORY_OPTIONS,
  normalizeCategory,
  isAdminStorageUrl,
  getNextSortOrder,
  buildPreviewCandidates,
} from "../../lib/adminMenuLib";

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

type MenuEditorPanelProps = {
  selectedExisting: AdminMenuRow | null;
  editor: EditorState;
  setEditor: React.Dispatch<React.SetStateAction<EditorState>>;
  saving: boolean;
  togglingVisibility: boolean;
  movingOrder: boolean;
  uploadingImage: boolean;
  deletingImage: boolean;
  toast: string | null;
  errorMsg: string | null;
  canMoveUp: boolean;
  canMoveDown: boolean;
  nameError: boolean;
  categoryError: boolean;
  priceError: boolean;
  items: AdminMenuRow[];
  imageInputRef: React.RefObject<HTMLInputElement | null>;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  onToggleVisibility: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onImageFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onOpenImagePicker: () => void;
  onDeleteImage: () => void;
  onReset: () => void;
};

export default function MenuEditorPanel({
  selectedExisting,
  editor,
  setEditor,
  saving,
  togglingVisibility,
  movingOrder,
  uploadingImage,
  deletingImage,
  toast,
  errorMsg,
  canMoveUp,
  canMoveDown,
  nameError,
  categoryError,
  priceError,
  items,
  imageInputRef,
  onSubmit,
  onToggleVisibility,
  onMoveUp,
  onMoveDown,
  onImageFileChange,
  onOpenImagePicker,
  onDeleteImage,
  onReset,
}: MenuEditorPanelProps) {
  return (
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
              onClick={onToggleVisibility}
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
              onClick={onMoveUp}
              disabled={!canMoveUp || movingOrder || saving || togglingVisibility || uploadingImage || deletingImage}
              className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-white/85 transition hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {movingOrder ? "Pomjeram…" : "Pomjeri gore"}
            </button>

            <button
              type="button"
              onClick={onMoveDown}
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
                onClick={onOpenImagePicker}
                disabled={saving || togglingVisibility || movingOrder || uploadingImage || deletingImage}
                className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-white/85 transition hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {uploadingImage ? "Uploadujem sliku…" : "Upload image"}
              </button>

              {isAdminStorageUrl(editor.image) ? (
                <button
                  type="button"
                  onClick={onDeleteImage}
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
            onClick={onReset}
            disabled={saving || togglingVisibility || movingOrder || uploadingImage || deletingImage}
            className="rounded-2xl border border-white/10 bg-black/20 px-5 py-3 text-sm font-semibold text-white/80 transition hover:border-white/20 disabled:opacity-60"
          >
            Očisti formu
          </button>
        </div>
      </form>
    </div>
  );
}
