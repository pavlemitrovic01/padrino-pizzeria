import { AdminMenuRow, MenuCategory, VisibilityFilter, CATEGORY_OPTIONS, VISIBILITY_OPTIONS, safeDateTime } from "../../lib/adminMenuLib";
import { formatEUR } from "../../lib/money";

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

type MenuItemListProps = {
  loading: boolean;
  errorMsg: string | null;
  items: AdminMenuRow[];
  filteredItems: AdminMenuRow[];
  query: string;
  onQueryChange: (q: string) => void;
  categoryFilter: "all" | MenuCategory;
  onCategoryFilterChange: (v: "all" | MenuCategory) => void;
  visibilityFilter: VisibilityFilter;
  onVisibilityFilterChange: (v: VisibilityFilter) => void;
  selectedId: string | null;
  onSelect: (item: AdminMenuRow) => void;
  onNew: () => void;
  onRefresh: () => void;
};

export default function MenuItemList({
  loading,
  errorMsg,
  items,
  filteredItems,
  query,
  onQueryChange,
  categoryFilter,
  onCategoryFilterChange,
  visibilityFilter,
  onVisibilityFilterChange,
  selectedId,
  onSelect,
  onNew,
  onRefresh,
}: MenuItemListProps) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Lista stavki</h2>
          <p className="mt-1 text-sm text-white/55">Pronađi stavku, proveri redoslijed i otvori je za izmjene.</p>
        </div>

        <button
          type="button"
          onClick={onNew}
          className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-white/85 transition hover:border-white/20"
        >
          + Nova stavka
        </button>
      </div>

      <div className="mt-5 space-y-3">
        <input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Pretraga po nazivu, opisu, kategoriji..."
          className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-white/20"
        />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <select
            value={categoryFilter}
            onChange={(e) => onCategoryFilterChange(e.target.value as "all" | MenuCategory)}
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
            onChange={(e) => onVisibilityFilterChange(e.target.value as VisibilityFilter)}
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
            onClick={onRefresh}
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
              const selected = item.id === selectedId;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelect(item)}
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
  );
}
