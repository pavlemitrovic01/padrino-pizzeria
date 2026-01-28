import { FormEvent, useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient.ts";

type AdminRoleState = "checking" | "none" | "admin" | "not-admin";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roleState, setRoleState] = useState<AdminRoleState>("checking");

  function cleanUrl() {
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  async function getRoleStateFromSession(): Promise<AdminRoleState> {
    const { data } = await supabase.auth.getSession();
    const session = data?.session;

    if (!session || !session.user) return "none";

    const role =
      typeof session.user.user_metadata?.role === "string"
        ? session.user.user_metadata.role
        : null;

    return role === "admin" ? "admin" : "not-admin";
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

      // 1) Ako callback vrati error param, ne redirectujemo.
      if (hasError) {
        if (!mounted) return;
        setError("Greška pri prijavi. Pokušajte ponovo.");
        cleanUrl();
        const rs = await getRoleStateFromSession();
        if (!mounted) return;
        setRoleState(rs);
        return;
      }

      // 2) Ako imamo code=, uradi exchange pa provjeri sesiju.
      if (code) {
        try {
          await supabase.auth.exchangeCodeForSession(code);
        } catch {
          if (!mounted) return;
          setError("Greška pri prijavi. Pokušajte ponovo.");
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

      // 3) Nema callback parametara — samo provjeri session.
      const rs = await getRoleStateFromSession();
      if (!mounted) return;

      if (rs === "admin") {
        window.location.replace("/admin");
        return;
      }

      setRoleState(rs);
    }

    void bootstrap();

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return;

        if (!session || !session.user) {
          setRoleState("none");
          return;
        }

        const role =
          typeof session.user.user_metadata?.role === "string"
            ? session.user.user_metadata.role
            : null;

        if (role === "admin") {
          window.location.replace("/admin");
          return;
        }

        setRoleState("not-admin");
      }
    );

    return () => {
      mounted = false;
      listener?.subscription.unsubscribe();
    };
  }, []);

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin + "/admin/login",
      },
    });

    if (error) {
      setError("Greška pri slanju magičnog linka.");
      return;
    }

    setSent(true);
  }

  if (roleState === "checking") {
    return <div className="p-6 text-white">Provjeravam sesiju…</div>;
  }

  if (roleState === "not-admin") {
    return (
      <div className="p-6 max-w-sm mx-auto flex flex-col items-center">
        <h1 className="text-xl font-bold mb-4 text-white">
          Nemate admin pristup.
        </h1>
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
        <p className="text-white mt-2">
          Poslali smo magični link. Kliknite na link iz e-maila.
        </p>
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
        <button
          type="submit"
          className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-semibold px-4 py-2 rounded-full"
        >
          Pošalji magični link
        </button>
        {error && <p className="text-red-400 text-sm">{error}</p>}
      </form>
    </div>
  );
}
