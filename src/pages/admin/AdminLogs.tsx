import { useMemo, useState } from "react";
import { clearClientLogs, getClientLogs, type ClientLogEvent } from "../../lib/logger";

function formatTs(ts: number): string {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
}

function levelBadge(level: ClientLogEvent["level"]) {
  const base = "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-extrabold border";
  if (level === "error") return `${base} border-red-500/30 bg-red-500/[0.10] text-red-200`;
  if (level === "warn") return `${base} border-yellow-500/30 bg-yellow-500/[0.10] text-yellow-200`;
  return `${base} border-emerald-500/30 bg-emerald-500/[0.10] text-emerald-200`;
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '"[unserializable]"';
  }
}

export default function AdminLogs() {
  const [tick, setTick] = useState(0);
  const [copied, setCopied] = useState(false);

  const logs = useMemo(() => {
    // tick je samo za ručno osvježavanje
    void tick;
    const all = getClientLogs();
    // najnovije gore
    return [...all].sort((a, b) => b.ts - a.ts);
  }, [tick]);

  const exportText = useMemo(() => {
    return safeStringify({
      exportedAt: new Date().toISOString(),
      count: logs.length,
      logs,
    });
  }, [logs]);

  const onRefresh = () => setTick((x) => x + 1);

  const onClear = () => {
    const ok = window.confirm("Da li si siguran da želiš da obrišeš sve lokalne logove?");
    if (!ok) return;

    clearClientLogs();
    setTick((x) => x + 1);
  };

  const onCopy = async () => {
    setCopied(false);
    const text = exportText;

    // Modern clipboard
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
        return;
      }
    } catch {
      // fallback ispod
    }

    // Fallback (stari browseri)
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "true");
      ta.style.position = "fixed";
      ta.style.top = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Ako ni to ne radi, korisnik i dalje može ručno da selektuje iz UI-a
      setCopied(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 sm:p-6">
      <div className="mx-auto w-full max-w-5xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold">Admin — Logovi</h1>
            <p className="mt-1 text-sm text-white/60">
              Lokalni frontend logovi (console + ring buffer u localStorage). Koristi se za brzi debug u produkciji.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={onRefresh}
              className="rounded-2xl border border-white/15 bg-black/40 px-4 py-3 text-sm font-extrabold text-white hover:border-white/25"
              title="Osvježi listu logova"
            >
              Osvježi
            </button>

            <button
              type="button"
              onClick={onCopy}
              className="rounded-2xl bg-white px-4 py-3 text-sm font-extrabold text-black"
              title="Kopiraj logove u clipboard"
            >
              {copied ? "Kopirano ✅" : "Kopiraj logove"}
            </button>

            <button
              type="button"
              onClick={onClear}
              className="rounded-2xl border border-red-500/25 bg-red-500/[0.06] px-4 py-3 text-sm font-extrabold text-red-200 hover:border-red-500/35"
              title="Obriši lokalne logove"
            >
              Obriši
            </button>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-white/10 bg-[#121212] p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-extrabold">
              Događaji: <span className="text-white/80">{logs.length}</span>
            </div>
            <div className="text-xs text-white/50">
              Savjet: kad prijaviš grešku, klikni{" "}
              <span className="font-bold text-white/70">Kopiraj logove</span> i pošalji tekst.
            </div>
          </div>

          {logs.length === 0 ? (
            <div className="mt-4 rounded-xl border border-white/10 bg-black/40 p-4 text-sm text-white/60">
              Trenutno nema logova. (Otvori app, uradi akciju, ili sačekaj grešku — logovi se čuvaju lokalno.)
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {logs.map((e, idx) => (
                <div key={`${e.ts}-${e.level}-${idx}`} className="rounded-xl border border-white/10 bg-black/40 p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <span className={levelBadge(e.level)}>{e.level.toUpperCase()}</span>
                      <span className="text-xs text-white/50">{formatTs(e.ts)}</span>
                    </div>
                    <div className="text-xs text-white/40 break-all">{`#${idx + 1}`}</div>
                  </div>

                  <div className="mt-2 text-sm font-extrabold break-words">{e.message}</div>

                  {e.context ? (
                    <pre className="mt-2 overflow-auto rounded-xl border border-white/10 bg-[#0f0f0f] p-3 text-xs text-white/70">
                      {safeStringify(e.context)}
                    </pre>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-4 text-xs text-white/45">
          Napomena: logovi su per-browser/per-device i ne šalju se na server (read-only monitoring bez eksternih servisa).
        </div>
      </div>
    </div>
  );
}