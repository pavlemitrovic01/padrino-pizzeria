import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient.ts";

type AdminRoleState = "checking" | "none" | "admin" | "not-admin";

const ADMIN_EMAILS = new Set<string>(["pavlemitrovic01@gmail.com"]);

function normalizeEmail(v: string) {
  return v.trim().toLowerCase();
}

function isAdminEmail(email: unknown): boolean {
  const e = typeof email === "string" ? normalizeEmail(email) : "";
  return e.length > 0 && ADMIN_EMAILS.has(e);
}

function cleanUrl() {
  window.history.replaceState({}, document.title, window.location.pathname);
}

function extractSupabaseErrorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const anyErr = err as any;
    if (typeof anyErr.message === "string" && anyErr.message.trim()) return anyErr.message.trim();
    if (typeof anyErr.error_description === "string" && anyErr.error_description.trim())
      return anyErr.error_description.trim();
    if (typeof anyErr.error === "string" && anyErr.error.trim()) return anyErr.error.trim();
  }
  if (err instanceof Error && err.message.trim()) return err.message.trim();
  return "Greška pri prijavi. Pokušajte ponovo.";
}

export default function AdminLogin() {
  const [email, setEmail] = useState("");

  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [roleState, setRoleState] = useState<AdminRoleState>("checking");

  const [submitting, setSubmitting] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  const cleanedEmail = useMemo(() => normalizeEmail(email), [email]);
  const emailIsAdmin = useMemo(() => isAdminEmail(cleanedEmail), [cleanedEmail]);

  const canSend = useMemo(() => {
    if (submitting) return false;
    if (cooldownSeconds > 0) return false;
    if (!cleanedEmail) return false;
    // ✅ ključ stabilnosti: samo allowlist email može da šalje OTP
    if (!emailIsAdmin) return false;
    return true;
  }, [submitting, cooldownSeconds, cleanedEmail, emailIsAdmin]);

  async function getRoleStateFromSession(): Promise<AdminRoleState> {
    const { data } = await supabase.auth.getSession();
    const session = data?.session;
    if (!session || !session.user) return "none";
    return isAdminEmail(session.user.email) ? "admin" : "not-admin";
  }

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      setRoleState("checking");
      setError(null);

      const url = new URL(window.location.href);
      const params = url.searchParams;

      const code = params.get("code");
      const hasError = params.has("error") || params.has("error_description");

      if (hasError) {
        if (!mounted) return;
        setError("Greška pri prijavi. Pokušajte ponovo.");
        cleanUrl();
        const rs = await getRoleStateFromSession();
        if (!mounted) return;
        setRoleState(rs);
        return;
      }

      if (code) {
        try {
          const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
          if (exErr) throw exErr;
        } catch (e) {
          if (!mounted) return;
          setError(extractSupabaseErrorMessage(e));
          cleanUrl();
          const rs = await getRoleStateFromSession();
          if (!mounted) return;
          setRoleState(rs);
          return;
        }

        cleanUrl();
        const rs = await getRoleStateFromSession();
        if (!mounted) return;

        if (rs === "admin") {
          window.location.replace("/admin");
          return;
        }

        if (rs === "not-admin") {
          setRoleState("not-admin");
          return;
        }

        setError("Prijava nije uspjela. Pokušajte ponovo.");
        setRoleState("none");
        return;
      }

      const rs = await getRoleStateFromSession();
      if (!mounted) return;

      if (rs === "admin") {
        window.location.replace("/admin");
        return;
      }

      setRoleState(rs);
    }

    void bootstrap();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;

      if (!session || !session.user) {
        setRoleState("none");
        return;
      }

      if (isAdminEmail(session.user.email)) {
        window.location.replace("/admin");
        return;
      }

      setRoleState("not-admin");
    });

    return () => {
      mounted = false;
      listener?.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;

    const t = window.setInterval(() => {
      setCooldownSeconds((s) => (s > 0 ? s - 1 : 0));
    }, 1000);

    return () => window.clearInterval(t);
  }, [cooldownSeconds]);

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!cleanedEmail) return;

    // ✅ ključ stabilnosti: ne šalji otp ako nije admin email
    if (!emailIsAdmin) {
      setError("Ovaj e-mail nema admin pristup.");
      return;
    }

    if (cooldownSeconds > 0 || submitting) return;

    setSubmitting(true);
    try {
      const { error: signErr } = await supabase.auth.signInWithOtp({
        email: cleanedEmail,
        options: {
          emailRedirectTo: window.location.origin + "/admin/login",
        },
      });

      if (signErr) {
        const msg = extractSupabaseErrorMessage(signErr);
        setError(msg);

        // ✅ ako je rate limit, stavi duži cooldown (10 min) da se ne udara dalje
        if (msg.toLowerCase().includes("rate limit") || msg.toLowerCase().includes("too many")) {
          setCooldownSeconds((s) => Math.max(s, 600));
        } else {
          setCooldownSeconds((s) => Math.max(s, 60));
        }
        return;
      }

      setSent(true);
      setCooldownSeconds(60);
    } catch (e) {
      const msg = extractSupabaseErrorMessage(e);
      setError(msg);
      setCooldownSeconds((s) => Math.max(s, 60));
    } finally {
      setSubmitting(false);
    }
  }

  if (roleState === "checking") {
    return <div className="p-6 text-white">Provjeravam sesiju…</div>;
  }

  if (roleState === "not-admin") {
    return (
      <div className="p-6 max-w-sm mx-auto flex flex-col items-center">
        <h1 className="text-xl font-bold mb-4 text-white">Nemate admin pristup.</h1>
        <button
          className="bg-yellow-500 hover:bg-yellow-400 text-black font-semibold px-6 py-2 rounded-full text-base"
          onClick={() => {
            window.location.href = "/";
          }}
        >
          Nazad na meni
        </button>
      </div>
    );
  }

  if (sent) {
    return (
      <div className="p-6 max-w-sm mx-auto">
        <h1 className="text-xl font-bold text-white">Provjerite e-mail 📩</h1>
        <p className="text-white mt-2">Poslali smo magični link. Kliknite na link iz e-maila.</p>

        <div className="mt-4 text-xs text-white/60">
          {cooldownSeconds > 0
            ? `Ponovno slanje dostupno za: ${cooldownSeconds}s`
            : "Ako ne stigne, provjeri Spam/Promotions pa pokušaj ponovo."}
        </div>

        {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
      </div>
    );
  }

  return (
    <div className="p-6 max-w-sm mx-auto">
      <h1 className="text-2xl font-bold mb-4 text-white">Admin prijava</h1>

      <form onSubmit={handleLogin} className="space-y-4">
        <input
          type="email"
          required
          placeholder="E-mail"
          className="w-full px-4 py-2 rounded bg-gray-800 text-white border border-gray-700"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        {!emailIsAdmin && cleanedEmail.length > 0 ? (
          <p className="text-xs text-red-300">
            Ovaj e-mail nije na admin allowlist-i. (Ne šaljem magic link da ne bi udarao rate limit.)
          </p>
        ) : (
          <p className="text-xs text-white/50">
            Magic link se šalje samo na admin e-mail.
          </p>
        )}

        <button
          type="submit"
          disabled={!canSend}
          className={[
            "w-full font-semibold px-4 py-2 rounded-full transition",
            canSend ? "bg-yellow-500 hover:bg-yellow-400 text-black" : "bg-yellow-500/50 text-black/60",
          ].join(" ")}
        >
          {submitting
            ? "Šaljem…"
            : cooldownSeconds > 0
            ? `Sačekaj ${cooldownSeconds}s`
            : "Pošalji magični link"}
        </button>

        {error && <p className="text-red-400 text-sm">{error}</p>}
      </form>
    </div>
  );
}
