import { useEffect, useState } from "react";
import { supabaseAdminAuth } from "../../lib/supabaseAdminAuthClient";

export default function AdminMagicLinkCallback() {
  const [status, setStatus] = useState<"working" | "ok" | "error">("working");
  const [message, setMessage] = useState<string>("Uspostavljam sesiju...");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");

        if (!code) {
          setStatus("error");
          setMessage("Nedostaje code parametar u URL-u. Otvori magic link ponovo.");
          return;
        }

        const { error } = await supabaseAdminAuth.auth.exchangeCodeForSession(code);

        if (cancelled) return;

        if (error) {
          setStatus("error");
          setMessage(`Greška pri prijavi: ${error.message}`);
          return;
        }

        const { data } = await supabaseAdminAuth.auth.getSession();
        const session = data?.session ?? null;

        if (!session) {
          setStatus("error");
          setMessage(
            "Sesija nije kreirana. Proveri Redirect URLs u Supabase i da li link vodi na /admin/login."
          );
          return;
        }

        setStatus("ok");
        setMessage("Uspešno! Prebacujem na admin…");
        window.location.replace("/admin");
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "Nepoznata greška";
        setStatus("error");
        setMessage(`Greška: ${msg}`);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-black/40 p-6 text-center">
        <h1 className="text-lg font-semibold text-white">Admin prijava</h1>

        <p className="mt-3 text-sm text-white/80">{message}</p>

        {status === "error" && (
          <div className="mt-4 text-xs text-white/60">
            <p className="mb-2">Ako vidiš ovu grešku, najčešće je problem:</p>
            <ul className="list-disc text-left pl-5 space-y-1">
              <li>
                Supabase Authentication → URL Configuration → Redirect URLs ne sadrži{" "}
                <b>http://localhost:5173/admin/login</b>
              </li>
              <li>Magic link se šalje sa pogrešnim <b>emailRedirectTo</b></li>
              <li>Otvaraš link u inkognito/profilu bez localStorage</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
    