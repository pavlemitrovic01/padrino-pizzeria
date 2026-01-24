import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin + "/#/admin",
      },
    });

    if (error) {
      setError("Greška pri slanju magic linka.");
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold">Proveri email 📩</h1>
        <p>Poslali smo magic link. Klikni link iz emaila.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-sm mx-auto">
      <h1 className="text-2xl font-bold mb-4">Admin Login</h1>

      <form onSubmit={handleLogin} className="space-y-4">
        <input
          type="email"
          required
          placeholder="Admin email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border px-3 py-2 rounded"
        />

        <button
          type="submit"
          className="w-full bg-black text-white py-2 rounded"
        >
          Pošalji magic link
        </button>

        {error && <p className="text-red-600">{error}</p>}
      </form>
    </div>
  );
}

