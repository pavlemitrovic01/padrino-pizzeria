import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { supabaseAdminAuth } from "../../lib/supabaseAdminAuthClient";

type AdminRole = "owner" | "staff";

type AdminUserRow = {
  email: string;
  role: AdminRole;
  enabled: boolean;
  created_at: string;
};

type Actor = {
  email: string;
  role: AdminRole;
};

type AdminUsersGetOk = {
  ok: true;
  actor: Actor;
  users: AdminUserRow[];
};

type AdminUsersGetErr = {
  ok: false;
  error: string;
};

type AdminUsersGetResponse = AdminUsersGetOk | AdminUsersGetErr;

type AdminUsersPostOk = {
  ok: true;
  email: string;
  role: AdminRole;
  enabled: boolean;
};

type AdminUsersPostErr = {
  ok: false;
  error: string;
};

type AdminUsersPostResponse = AdminUsersPostOk | AdminUsersPostErr;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function toStr(v: unknown): string {
  return typeof v === "string" ? v : "";
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

const ADMIN_API_BASE = import.meta.env.DEV ? "https://padrinobudva.com" : "";

async function getSessionToken(): Promise<string> {
  const { data } = await supabaseAdminAuth.auth.getSession();
  const token = typeof data?.session?.access_token === "string" ? data.session.access_token.trim() : "";
  return token;
}

async function apiGetUsers(token: string): Promise<AdminUsersGetResponse> {
  const res = await fetch(`${ADMIN_API_BASE}/api/admin-users`, {
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

  if (isRecord(body) && body.ok === true && isRecord(body.actor) && Array.isArray(body.users)) {
    const actorEmail = normalizeEmail(toStr(body.actor.email));
    const actorRole: AdminRole = body.actor.role === "owner" ? "owner" : "staff";

    const users: AdminUserRow[] = body.users
      .map((u: unknown) => {
        if (!isRecord(u)) return null;

        const email = normalizeEmail(toStr(u.email));
        const role: AdminRole = u.role === "owner" ? "owner" : "staff";
        const enabled = typeof u.enabled === "boolean" ? u.enabled : false;
        const created_at = toStr(u.created_at);

        if (!email) return null;
        return { email, role, enabled, created_at };
      })
      .filter((x): x is AdminUserRow => Boolean(x));

    return { ok: true, actor: { email: actorEmail, role: actorRole }, users };
  }

  return { ok: false, error: "Neočekivan odgovor sa admin-users." };
}

async function apiUpsertUser(
  token: string,
  payload: { email: string; role: AdminRole; enabled: boolean },
): Promise<AdminUsersPostResponse> {
  const res = await fetch(`${ADMIN_API_BASE}/api/admin-users`, {
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
    const email = normalizeEmail(toStr(body.email));
    const role: AdminRole = body.role === "owner" ? "owner" : "staff";
    const enabled = typeof body.enabled === "boolean" ? body.enabled : true;

    if (!email) return { ok: false, error: "Neočekivan odgovor sa admin-users (fali email)." };
    return { ok: true, email, role, enabled };
  }

  return { ok: false, error: "Neočekivan odgovor sa admin-users." };
}

function pill(enabled: boolean) {
  return enabled
    ? "bg-emerald-500/15 text-emerald-200 border-emerald-500/20"
    : "bg-red-500/15 text-red-200 border-red-500/20";
}

const ROLE_UI: Record<AdminRole, { label: string; desc: string; short: string }> = {
  staff: {
    label: "Osoblje",
    short: "osoblje",
    desc: "Može da vidi i upravlja porudžbinama (status, resend, copy). Ne može da mijenja listu admin korisnika.",
  },
  owner: {
    label: "Vlasnik",
    short: "vlasnik",
    desc: "Puni admin pristup, uključujući dodavanje/gašenje admin korisnika i promjenu uloga (Korisnici stranica).",
  },
};

function rolePill(role: AdminRole) {
  return role === "owner"
    ? "bg-purple-500/15 text-purple-200 border-purple-500/20"
    : "bg-white/10 text-white/70 border-white/10";
}

export default function AdminUsers() {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [actor, setActor] = useState<Actor | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AdminRole>("staff");
  const [enabled, setEnabled] = useState(true);

  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const isOwner = actor?.role === "owner";
  const cleanedEmail = useMemo(() => normalizeEmail(email), [email]);

  const existingUser = useMemo(() => {
    if (!cleanedEmail) return null;
    return users.find((u) => u.email === cleanedEmail) ?? null;
  }, [users, cleanedEmail]);

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

    const r = await apiGetUsers(token);
    if (!r.ok) {
      setLoading(false);
      setErrorMsg(r.error);
      return;
    }

    setActor(r.actor);
    setUsers(r.users);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const quickAdd = useCallback(
    async (nextRole: AdminRole) => {
      setToast(null);
      setErrorMsg(null);

      if (!isOwner) {
        setErrorMsg("Samo vlasnik (owner) može mijenjati listu admin korisnika.");
        return;
      }

      if (!cleanedEmail) {
        setErrorMsg("Unesite e-mail.");
        return;
      }

      setBusy(true);
      try {
        const token = await getSessionToken();
        if (!token) {
          setErrorMsg("Nijeste prijavljeni. Otvorite /admin/login.");
          return;
        }

        const r = await apiUpsertUser(token, { email: cleanedEmail, role: nextRole, enabled: true });
        if (!r.ok) {
          setErrorMsg(r.error);
          return;
        }

        setToast(`Sačuvano: ${r.email} (${ROLE_UI[r.role].short}, ${r.enabled ? "aktivan" : "neaktivan"})`);
        setEmail("");
        setRole("staff");
        setEnabled(true);

        await load();
      } finally {
        setBusy(false);
      }
    },
    [cleanedEmail, isOwner, load],
  );

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setToast(null);
    setErrorMsg(null);

    if (!isOwner) {
      setErrorMsg("Samo vlasnik (owner) može mijenjati listu admin korisnika.");
      return;
    }

    if (!cleanedEmail) {
      setErrorMsg("Unesite e-mail.");
      return;
    }

    setBusy(true);
    try {
      const token = await getSessionToken();
      if (!token) {
        setErrorMsg("Nijeste prijavljeni. Otvorite /admin/login.");
        return;
      }

      const r = await apiUpsertUser(token, { email: cleanedEmail, role, enabled });
      if (!r.ok) {
        setErrorMsg(r.error);
        return;
      }

      setToast(`Sačuvano: ${r.email} (${ROLE_UI[r.role].short}, ${r.enabled ? "aktivan" : "neaktivan"})`);
      setEmail("");
      setRole("staff");
      setEnabled(true);

      await load();
    } finally {
      setBusy(false);
    }
  }

  async function quickUpdate(target: AdminUserRow, patch: Partial<Pick<AdminUserRow, "role" | "enabled">>) {
    setToast(null);
    setErrorMsg(null);

    if (!isOwner) {
      setErrorMsg("Samo vlasnik (owner) može mijenjati listu admin korisnika.");
      return;
    }

    setBusy(true);
    try {
      const token = await getSessionToken();
      if (!token) {
        setErrorMsg("Nijeste prijavljeni. Otvorite /admin/login.");
        return;
      }

      const nextRole: AdminRole = patch.role ?? target.role;
      const nextEnabled: boolean = typeof patch.enabled === "boolean" ? patch.enabled : target.enabled;

      const r = await apiUpsertUser(token, { email: target.email, role: nextRole, enabled: nextEnabled });
      if (!r.ok) {
        setErrorMsg(r.error);
        return;
      }

      setToast(`Sačuvano: ${r.email} (${ROLE_UI[r.role].short}, ${r.enabled ? "aktivan" : "neaktivan"})`);
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="bg-black text-white py-14">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-3xl font-extrabold">Admin — Korisnici</h2>
            <p className="mt-2 text-white/70">
              Admin pristup se kontroliše u tabeli <span className="font-semibold">admin_users</span>.
            </p>
            {actor ? (
              <p className="mt-1 text-xs text-white/50">
                Ulogovan: <span className="text-white/80">{actor.email}</span> · uloga:{" "}
                <span className="text-white/80">{ROLE_UI[actor.role].short}</span>
              </p>
            ) : null}
          </div>

          <div className="flex gap-2">
            <button
              className="rounded-2xl border border-white/10 bg-black/30 px-4 py-2 text-xs font-extrabold text-white hover:border-white/20 disabled:opacity-60"
              onClick={() => void load()}
              disabled={loading || busy}
              title="Osvježi listu"
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
          <p className="text-sm text-white/70">
            {isOwner
              ? "Ti si vlasnik (owner) — možeš dodavati/uklanjati admin pristup i mijenjati uloge na ovoj stranici."
              : "Ti si osoblje (staff) — možeš da vidiš listu, ali samo vlasnik može da pravi izmjene."}
          </p>

          <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
            {(["owner", "staff"] as const).map((r) => (
              <div key={r} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                <div className="flex items-start gap-2">
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${rolePill(
                      r,
                    )}`}
                    title={`DB uloga: ${r}`}
                  >
                    {ROLE_UI[r].label}
                  </span>
                  <p className="text-xs text-white/70">{ROLE_UI[r].desc}</p>
                </div>
              </div>
            ))}
          </div>

          {toast ? <p className="mt-2 text-xs text-emerald-200">{toast}</p> : null}
          {errorMsg ? <p className="mt-2 text-xs text-red-300">{errorMsg}</p> : null}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h3 className="text-lg font-extrabold">Dodaj admin korisnika</h3>
            <p className="mt-2 text-xs text-white/60">
              Unesi e-mail. Preporuka: <span className="text-white/80 font-semibold">osoblje</span> za operativu
              (porudžbine), a <span className="text-white/80 font-semibold">vlasnik</span> samo za vlasnika sajta
              (može mijenjati Korisnike).
            </p>

            <form onSubmit={submit} className="mt-4 space-y-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@domain.com"
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-white/40 outline-none focus:border-white/20"
                disabled={!isOwner || busy}
              />

              {existingUser ? (
                <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/70">
                  Već postoji u listi:{" "}
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 font-semibold ${rolePill(
                      existingUser.role,
                    )}`}
                    title={`DB uloga: ${existingUser.role}`}
                  >
                    {ROLE_UI[existingUser.role].short}
                  </span>{" "}
                  ·{" "}
                  <span
                    className={`inline-flex items-center rounded-full border px-2 py-0.5 font-semibold ${pill(
                      existingUser.enabled,
                    )}`}
                  >
                    {existingUser.enabled ? "aktivan" : "neaktivan"}
                  </span>
                </div>
              ) : null}

              {isOwner ? (
                <>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs font-semibold text-white hover:border-white/20 disabled:opacity-50"
                      onClick={() => void quickAdd("staff")}
                      disabled={!cleanedEmail || busy}
                      title="Brzo dodaj kao osoblje (aktivan)"
                    >
                      Brzo dodaj: osoblje
                    </button>

                    <button
                      type="button"
                      className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs font-semibold text-white hover:border-white/20 disabled:opacity-50"
                      onClick={() => void quickAdd("owner")}
                      disabled={!cleanedEmail || busy}
                      title="Brzo dodaj kao vlasnik (aktivan)"
                    >
                      Brzo dodaj: vlasnik
                    </button>
                  </div>

                  <p className="text-xs text-white/50">
                    Brzo dodavanje odmah postavlja korisnika kao <span className="text-white/70">aktivan</span>. Za
                    deaktivaciju koristi dugme u listi.
                  </p>
                </>
              ) : null}

              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold text-white/70">Uloga</p>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={!isOwner || busy}
                      onClick={() => setRole("staff")}
                      className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                        role === "staff"
                          ? "border-white/20 bg-black/40 text-white"
                          : "border-white/10 bg-black/20 text-white/80 hover:border-white/20"
                      } disabled:opacity-50`}
                      title="Osoblje: porudžbine"
                    >
                      Osoblje
                    </button>

                    <button
                      type="button"
                      disabled={!isOwner || busy}
                      onClick={() => setRole("owner")}
                      className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                        role === "owner"
                          ? "border-white/20 bg-black/40 text-white"
                          : "border-white/10 bg-black/20 text-white/80 hover:border-white/20"
                      } disabled:opacity-50`}
                      title="Vlasnik: puni admin"
                    >
                      Vlasnik
                    </button>
                  </div>

                  <p className="mt-2 text-xs text-white/50">{ROLE_UI[role].desc}</p>
                </div>

                <label className="inline-flex items-center gap-2 text-xs text-white/70">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                    disabled={!isOwner || busy}
                  />
                  Aktivan (enabled)
                </label>
              </div>

              <button
                type="submit"
                disabled={!isOwner || busy}
                className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs font-semibold text-white hover:border-white/20 disabled:opacity-50"
              >
                {busy ? "Čuvam…" : "Sačuvaj"}
              </button>

              {!isOwner ? (
                <p className="text-xs text-white/50">
                  Samo vlasnik može mijenjati listu. Ako treba, dodaj owner u bazi (admin_users).
                </p>
              ) : null}
            </form>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <h3 className="text-lg font-extrabold">Lista admin korisnika</h3>

            {loading ? (
              <p className="mt-3 text-white/70">Učitavam…</p>
            ) : users.length === 0 ? (
              <p className="mt-3 text-white/70">Nema admin korisnika.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {users.map((u) => {
                  const isSelf = actor?.email === u.email;

                  return (
                    <div key={u.email} className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-white truncate">{u.email}</p>
                          <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/60">
                            <span>Uloga:</span>
                            <span
                              className={`inline-flex items-center rounded-full border px-2 py-0.5 font-semibold ${rolePill(
                                u.role,
                              )}`}
                              title={`DB uloga: ${u.role}`}
                            >
                              {ROLE_UI[u.role].short}
                            </span>
                            <span className="text-white/40">·</span>
                            <span>Kreiran:</span>
                            <span className="text-white/80">{safeDateTime(u.created_at)}</span>
                            {isSelf ? <span className="ml-1 text-white/50">(ti)</span> : null}
                          </p>

                          <div className="mt-2">
                            <span
                              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${pill(
                                u.enabled,
                              )}`}
                            >
                              {u.enabled ? "aktivan" : "neaktivan"}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 shrink-0">
                          <button
                            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs font-semibold text-white hover:border-white/20 disabled:opacity-50"
                            disabled={!isOwner || busy || isSelf}
                            onClick={() => void quickUpdate(u, { enabled: !u.enabled })}
                            title={isSelf ? "Ne možeš mijenjati sebe (server guard)" : "Aktiviraj/Deaktiviraj"}
                          >
                            {u.enabled ? "Deaktiviraj" : "Aktiviraj"}
                          </button>

                          <button
                            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs font-semibold text-white hover:border-white/20 disabled:opacity-50"
                            disabled={!isOwner || busy || isSelf}
                            onClick={() => void quickUpdate(u, { role: u.role === "owner" ? "staff" : "owner" })}
                            title={isSelf ? "Ne možeš mijenjati svoju ulogu (server guard)" : "Promijeni ulogu"}
                          >
                            {u.role === "owner" ? "Postavi kao osoblje" : "Postavi kao vlasnik"}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 text-xs text-white/50">
          Napomena: Server već ima zaštite (ne možeš deaktivirati/demote sebe, i ne možeš ukloniti posljednjeg vlasnika).
        </div>
      </div>
    </section>
  );
}