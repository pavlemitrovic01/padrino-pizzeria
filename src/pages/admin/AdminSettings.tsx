import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { getAdminApiBase } from "../../lib/adminApiBase";
import { supabaseAdminAuth } from "../../lib/supabaseAdminAuthClient";

type AdminRole = "owner" | "staff";

type Actor = {
  email: string;
  role: AdminRole;
};

type SiteSettings = {
  id: number;
  phone_display: string;
  phone_e164: string;
  email: string;
  address_line: string;
  hours_display: string;
  maps_url: string;
  instagram_url: string;
  whatsapp_url: string;
  viber_url: string;
  default_city: string;
  default_postcode: string;
  created_at: string;
  updated_at: string;
};

type EditorState = {
  phone_display: string;
  phone_e164: string;
  email: string;
  address_line: string;
  hours_display: string;
  maps_url: string;
  instagram_url: string;
  whatsapp_url: string;
  viber_url: string;
  default_city: string;
  default_postcode: string;
};

type AdminSettingsGetOk = {
  ok: true;
  actor: Actor;
  settings: SiteSettings;
};

type AdminSettingsGetErr = {
  ok: false;
  error: string;
};

type AdminSettingsGetResponse = AdminSettingsGetOk | AdminSettingsGetErr;

type AdminSettingsPostOk = {
  ok: true;
  actor: Actor;
  settings: SiteSettings;
};

type AdminSettingsPostErr = {
  ok: false;
  error: string;
};

type AdminSettingsPostResponse = AdminSettingsPostOk | AdminSettingsPostErr;

const ADMIN_API_BASE = getAdminApiBase();

const EMPTY_EDITOR: EditorState = {
  phone_display: "",
  phone_e164: "",
  email: "",
  address_line: "",
  hours_display: "",
  maps_url: "",
  instagram_url: "",
  whatsapp_url: "",
  viber_url: "",
  default_city: "",
  default_postcode: "",
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function toStr(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function toSafeInt(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) {
    return Math.trunc(Number(v));
  }
  return null;
}

function normalizeEmail(v: string) {
  return v.trim().toLowerCase();
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

function normalizeSettings(raw: unknown): SiteSettings | null {
  if (!isRecord(raw)) return null;

  const id = toSafeInt(raw.id);
  if (id !== 1) return null;

  return {
    id,
    phone_display: toStr(raw.phone_display).trim(),
    phone_e164: toStr(raw.phone_e164).trim(),
    email: toStr(raw.email).trim(),
    address_line: toStr(raw.address_line).trim(),
    hours_display: toStr(raw.hours_display).trim(),
    maps_url: toStr(raw.maps_url).trim(),
    instagram_url: toStr(raw.instagram_url).trim(),
    whatsapp_url: toStr(raw.whatsapp_url).trim(),
    viber_url: toStr(raw.viber_url).trim(),
    default_city: toStr(raw.default_city).trim(),
    default_postcode: toStr(raw.default_postcode).trim(),
    created_at: toStr(raw.created_at).trim(),
    updated_at: toStr(raw.updated_at).trim(),
  };
}

function editorFromSettings(settings: SiteSettings): EditorState {
  return {
    phone_display: settings.phone_display,
    phone_e164: settings.phone_e164,
    email: settings.email,
    address_line: settings.address_line,
    hours_display: settings.hours_display,
    maps_url: settings.maps_url,
    instagram_url: settings.instagram_url,
    whatsapp_url: settings.whatsapp_url,
    viber_url: settings.viber_url,
    default_city: settings.default_city,
    default_postcode: settings.default_postcode,
  };
}

async function getSessionToken(): Promise<string> {
  const { data } = await supabaseAdminAuth.auth.getSession();
  const token = typeof data?.session?.access_token === "string" ? data.session.access_token.trim() : "";
  return token;
}

async function apiGetSettings(token: string): Promise<AdminSettingsGetResponse> {
  const res = await fetch(`${ADMIN_API_BASE}/api/admin-settings`, {
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

  if (isRecord(body) && body.ok === true && isRecord(body.actor)) {
    const actorEmail = normalizeEmail(toStr(body.actor.email));
    const actorRole: AdminRole = body.actor.role === "owner" ? "owner" : "staff";
    const settings = normalizeSettings(body.settings);

    if (!actorEmail) return { ok: false, error: "Neočekivan odgovor sa admin-settings (fali actor.email)." };
    if (!settings) return { ok: false, error: "Neočekivan odgovor sa admin-settings (neispravan settings)." };

    return { ok: true, actor: { email: actorEmail, role: actorRole }, settings };
  }

  return { ok: false, error: "Neočekivan odgovor sa admin-settings." };
}

async function apiSaveSettings(token: string, payload: EditorState): Promise<AdminSettingsPostResponse> {
  const res = await fetch(`${ADMIN_API_BASE}/api/admin-settings`, {
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

  if (isRecord(body) && body.ok === true && isRecord(body.actor)) {
    const actorEmail = normalizeEmail(toStr(body.actor.email));
    const actorRole: AdminRole = body.actor.role === "owner" ? "owner" : "staff";
    const settings = normalizeSettings(body.settings);

    if (!actorEmail) return { ok: false, error: "Neočekivan odgovor sa admin-settings (fali actor.email)." };
    if (!settings) return { ok: false, error: "Neočekivan odgovor sa admin-settings (neispravan settings)." };

    return { ok: true, actor: { email: actorEmail, role: actorRole }, settings };
  }

  return { ok: false, error: "Neočekivan odgovor sa admin-settings." };
}

function inputClass(disabled: boolean) {
  return [
    "w-full rounded-xl border bg-black/30 px-3 py-2.5 text-sm text-white placeholder:text-white/35 outline-none transition",
    disabled ? "border-white/10 opacity-70 cursor-not-allowed" : "border-white/10 focus:border-white/20",
  ].join(" ");
}

function textareaClass(disabled: boolean) {
  return [
    "w-full min-h-[110px] rounded-xl border bg-black/30 px-3 py-2.5 text-sm text-white placeholder:text-white/35 outline-none transition",
    disabled ? "border-white/10 opacity-70 cursor-not-allowed" : "border-white/10 focus:border-white/20",
  ].join(" ");
}

function pill(role: AdminRole) {
  return role === "owner"
    ? "border-purple-500/20 bg-purple-500/15 text-purple-200"
    : "border-white/10 bg-white/5 text-white/75";
}

function sanitizeEditor(v: EditorState): EditorState {
  return {
    phone_display: v.phone_display.trim(),
    phone_e164: v.phone_e164.trim(),
    email: v.email.trim(),
    address_line: v.address_line.trim(),
    hours_display: v.hours_display.trim(),
    maps_url: v.maps_url.trim(),
    instagram_url: v.instagram_url.trim(),
    whatsapp_url: v.whatsapp_url.trim(),
    viber_url: v.viber_url.trim(),
    default_city: v.default_city.trim(),
    default_postcode: v.default_postcode.trim(),
  };
}

export default function AdminSettings() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [actor, setActor] = useState<Actor | null>(null);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [editor, setEditor] = useState<EditorState>(EMPTY_EDITOR);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const isOwner = actor?.role === "owner";

  const persistedSnapshot = useMemo(() => {
    if (!settings) return JSON.stringify(EMPTY_EDITOR);
    return JSON.stringify(editorFromSettings(settings));
  }, [settings]);

  const currentSnapshot = useMemo(() => JSON.stringify(sanitizeEditor(editor)), [editor]);

  const isDirty = persistedSnapshot !== currentSnapshot;

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    setToast(null);

    const token = await getSessionToken();
    if (!token) {
      setLoading(false);
      setErrorMsg("Nijeste prijavljeni. Otvorite /admin/login.");
      return;
    }

    const r = await apiGetSettings(token);
    if (!r.ok) {
      setLoading(false);
      setErrorMsg(r.error);
      return;
    }

    setActor(r.actor);
    setSettings(r.settings);
    setEditor(editorFromSettings(r.settings));
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function setField<K extends keyof EditorState>(key: K, value: EditorState[K]) {
    setEditor((prev) => ({ ...prev, [key]: value }));
  }

  function resetForm() {
    if (!settings) return;
    setEditor(editorFromSettings(settings));
    setToast(null);
    setErrorMsg(null);
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setToast(null);
    setErrorMsg(null);

    if (!isOwner) {
      setErrorMsg("Samo vlasnik (owner) može sačuvati Site Settings.");
      return;
    }

    const payload = sanitizeEditor(editor);

    if (!payload.phone_display) {
      setErrorMsg("Unesite prikaz telefona.");
      return;
    }

    if (!payload.phone_e164) {
      setErrorMsg("Unesite E.164 telefon.");
      return;
    }

    if (!payload.default_city) {
      setErrorMsg("Unesite podrazumijevani grad.");
      return;
    }

    if (!payload.default_postcode) {
      setErrorMsg("Unesite podrazumijevani poštanski broj.");
      return;
    }

    setBusy(true);
    try {
      const token = await getSessionToken();
      if (!token) {
        setErrorMsg("Nijeste prijavljeni. Otvorite /admin/login.");
        return;
      }

      const r = await apiSaveSettings(token, payload);
      if (!r.ok) {
        setErrorMsg(r.error);
        return;
      }

      setActor(r.actor);
      setSettings(r.settings);
      setEditor(editorFromSettings(r.settings));
      setToast("Sačuvano ✅ Site settings su uspješno ažurirani.");
    } finally {
      setBusy(false);
    }
  }

  const previewPhoneHref = useMemo(() => {
    const raw = editor.phone_e164.trim();
    if (!raw) return "";
    return `tel:${raw}`;
  }, [editor.phone_e164]);

  const previewMailHref = useMemo(() => {
    const raw = editor.email.trim();
    if (!raw) return "";
    return `mailto:${raw}`;
  }, [editor.email]);

  return (
    <section className="bg-black text-white py-14">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-3xl font-extrabold">Admin — Site Settings</h2>
            <p className="mt-2 text-white/70">
              Globalni podaci sajta: kontakt, linkovi i podrazumijevani checkout podaci.
            </p>
            {actor ? (
              <p className="mt-1 text-xs text-white/50">
                Ulogovan: <span className="text-white/80">{actor.email}</span> · uloga:{" "}
                <span className="text-white/80">{actor.role === "owner" ? "vlasnik" : "osoblje"}</span>
              </p>
            ) : null}
          </div>

          <div className="flex gap-2">
            <button
              className="rounded-2xl border border-white/10 bg-black/30 px-4 py-2 text-xs font-extrabold text-white hover:border-white/20 disabled:opacity-60"
              onClick={() => void load()}
              disabled={loading || busy}
              title="Osvježi settings"
            >
              Osvježi
            </button>

            <button
              className="rounded-2xl border border-white/10 bg-black/30 px-4 py-2 text-xs font-extrabold text-white hover:border-white/20 disabled:opacity-60"
              onClick={() => {
                window.location.href = "/admin";
              }}
              disabled={busy}
              title="Nazad na porudžbine"
            >
              Porudžbine
            </button>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${pill(
              actor?.role === "owner" ? "owner" : "staff",
            )}`}>
              {actor?.role === "owner" ? "Vlasnik" : "Osoblje"}
            </span>

            {settings ? (
              <span className="inline-flex items-center rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs font-semibold text-white/70">
                Zadnje ažuriranje: {safeDateTime(settings.updated_at)}
              </span>
            ) : null}

            {isDirty ? (
              <span className="inline-flex items-center rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-200">
                Nesnimljene izmjene
              </span>
            ) : null}
          </div>

          <p className="mt-3 text-sm text-white/70">
            {isOwner
              ? "Ti si owner — možeš mijenjati i sačuvati globalne podatke sajta."
              : "Ti si staff — možeš da vidiš trenutne vrijednosti, ali ne možeš da ih mijenjaš."}
          </p>

          {toast ? <p className="mt-2 text-xs text-emerald-200">{toast}</p> : null}
          {errorMsg ? <p className="mt-2 text-xs text-red-300">{errorMsg}</p> : null}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[1.35fr_0.65fr]">
          <form onSubmit={submit} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h3 className="text-lg font-extrabold">Izmjena globalnih podataka</h3>
            <p className="mt-2 text-xs text-white/60">
              Ove vrijednosti su centralni source of truth za kontakt podatke sajta i admin checkout default-e.
            </p>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-white/70">Telefon (prikaz)</label>
                <input
                  type="text"
                  value={editor.phone_display}
                  onChange={(e) => setField("phone_display", e.target.value)}
                  className={inputClass(!isOwner || busy)}
                  placeholder="+382 67 603 780"
                  disabled={!isOwner || busy}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-white/70">Telefon E.164</label>
                <input
                  type="text"
                  value={editor.phone_e164}
                  onChange={(e) => setField("phone_e164", e.target.value)}
                  className={inputClass(!isOwner || busy)}
                  placeholder="+38267603780"
                  disabled={!isOwner || busy}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-white/70">E-mail</label>
                <input
                  type="email"
                  value={editor.email}
                  onChange={(e) => setField("email", e.target.value)}
                  className={inputClass(!isOwner || busy)}
                  placeholder="padrinobudva@gmail.com"
                  disabled={!isOwner || busy}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-white/70">Radno vrijeme</label>
                <input
                  type="text"
                  value={editor.hours_display}
                  onChange={(e) => setField("hours_display", e.target.value)}
                  className={inputClass(!isOwner || busy)}
                  placeholder="12–00"
                  disabled={!isOwner || busy}
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold text-white/70">Adresa</label>
                <textarea
                  value={editor.address_line}
                  onChange={(e) => setField("address_line", e.target.value)}
                  className={textareaClass(!isOwner || busy)}
                  placeholder="Jadranski put BB (Kotorski Semafori)"
                  disabled={!isOwner || busy}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-white/70">Google Maps URL</label>
                <input
                  type="url"
                  value={editor.maps_url}
                  onChange={(e) => setField("maps_url", e.target.value)}
                  className={inputClass(!isOwner || busy)}
                  placeholder="https://maps.app.goo.gl/..."
                  disabled={!isOwner || busy}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-white/70">Instagram URL</label>
                <input
                  type="url"
                  value={editor.instagram_url}
                  onChange={(e) => setField("instagram_url", e.target.value)}
                  className={inputClass(!isOwner || busy)}
                  placeholder="https://www.instagram.com/..."
                  disabled={!isOwner || busy}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-white/70">WhatsApp URL</label>
                <input
                  type="url"
                  value={editor.whatsapp_url}
                  onChange={(e) => setField("whatsapp_url", e.target.value)}
                  className={inputClass(!isOwner || busy)}
                  placeholder="https://wa.me/38267603780"
                  disabled={!isOwner || busy}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-white/70">Viber URL</label>
                <input
                  type="text"
                  value={editor.viber_url}
                  onChange={(e) => setField("viber_url", e.target.value)}
                  className={inputClass(!isOwner || busy)}
                  placeholder="viber://chat?number=38267603780"
                  disabled={!isOwner || busy}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-white/70">Podrazumijevani grad</label>
                <input
                  type="text"
                  value={editor.default_city}
                  onChange={(e) => setField("default_city", e.target.value)}
                  className={inputClass(!isOwner || busy)}
                  placeholder="Budva"
                  disabled={!isOwner || busy}
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-white/70">
                  Podrazumijevani poštanski broj
                </label>
                <input
                  type="text"
                  value={editor.default_postcode}
                  onChange={(e) => setField("default_postcode", e.target.value)}
                  className={inputClass(!isOwner || busy)}
                  placeholder="85310"
                  disabled={!isOwner || busy}
                />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={!isOwner || busy || !isDirty}
                className="rounded-2xl bg-white px-4 py-2 text-sm font-extrabold text-black disabled:opacity-50"
                title="Sačuvaj settings"
              >
                {busy ? "Čuvam..." : "Sačuvaj settings"}
              </button>

              <button
                type="button"
                onClick={resetForm}
                disabled={busy || !settings || !isDirty}
                className="rounded-2xl border border-white/10 bg-black/30 px-4 py-2 text-sm font-extrabold text-white hover:border-white/20 disabled:opacity-50"
                title="Vrati na zadnje učitano stanje"
              >
                Resetuj izmjene
              </button>
            </div>
          </form>

          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <h3 className="text-lg font-extrabold">Brzi pregled</h3>

              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-white/45">Telefon</div>
                  <div className="mt-1 text-sm font-semibold text-white/90">
                    {editor.phone_display || <span className="text-white/35">Nije unijeto</span>}
                  </div>
                  {previewPhoneHref ? (
                    <a
                      href={previewPhoneHref}
                      className="mt-2 inline-flex text-xs font-semibold text-emerald-200 hover:text-emerald-100"
                    >
                      Test tel link
                    </a>
                  ) : null}
                </div>

                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-white/45">E-mail</div>
                  <div className="mt-1 break-all text-sm font-semibold text-white/90">
                    {editor.email || <span className="text-white/35">Nije unijeto</span>}
                  </div>
                  {previewMailHref ? (
                    <a
                      href={previewMailHref}
                      className="mt-2 inline-flex text-xs font-semibold text-emerald-200 hover:text-emerald-100"
                    >
                      Test mailto link
                    </a>
                  ) : null}
                </div>

                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-white/45">Adresa</div>
                  <div className="mt-1 text-sm font-semibold text-white/90">
                    {editor.address_line || <span className="text-white/35">Nije unijeto</span>}
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-white/45">
                    Checkout default
                  </div>
                  <div className="mt-1 text-sm font-semibold text-white/90">
                    {editor.default_city || <span className="text-white/35">Grad nije unijet</span>}
                    {" · "}
                    {editor.default_postcode || <span className="text-white/35">Poštanski broj nije unijet</span>}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <h3 className="text-lg font-extrabold">Napomena</h3>
              <p className="mt-3 text-sm leading-6 text-white/70">
                Ova stranica za sada upravlja samo bazom i admin API-jem. Sledeći korak je povezivanje ovih settings-a
                na public sekcije sajta i po potrebi na checkout default vrijednosti.
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
            Učitavam site settings…
          </div>
        ) : null}
      </div>
    </section>
  );
}