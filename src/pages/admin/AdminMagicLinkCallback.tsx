import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function AdminMagicLinkCallback() {
  const [status, setStatus] = useState<"working" | "ok" | "error">("working");
  const [message, setMessage] = useState<string>("Uspostavljam sesiju...");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        // PKCE magic link flow: Supabase dodaje ?code=... na redirect_to URL
        const url = window.location.href;

        const { data, error } = await supabase.auth.exchangeCodeForSession(url);

        if (cancelled) return;

        if (error) {
          setStatus("error");
          setMessage(`Greška pri prijavi: ${error.message}`);
          return;
        }

        // data.session može biti null u nekim edge slučajevima; zato dodatno proverimo
        const session = data?.session ?? (await supabase.auth.getSession()).data.session;

        if (!session) {
          setStatus("error");
          setMessage("Sesija nije kreirana. Proveri Redirect URLs u Supabase i da li link vodi na /admin/login.");
          return;
        }

        setStatus("ok");
        setMessage("Uspešno! Prebacujem na admin...");

        // hard redirect da bi se app osvežio sa novim session stanjem
        window.location.replace("/admin");
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "Nepoznata greška";
        setStatus("error");
        setMessage(`Greška: ${msg}`);
      }
    }

    run();
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
            <p className="mb-2">
              Ako vidiš ovu grešku, 99% je problem:
            </p>
            <ul className="list-disc text-left pl-5 space-y-1">
              <li>Supabase Authentication → URL Configuration → Redirect URLs ne sadrži <b>http://localhost:5173/admin/login</b></li>
              <li>Magic link se šalje sa pogrešnim <b>redirectTo</b></li>
              <li>Otvaraš link u drugom browser profilu gde nemaš lokalni storage (inkognito)</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
