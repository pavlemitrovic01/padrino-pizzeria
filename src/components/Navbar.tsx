import { useCart } from "../context/useCart";
import { supabase } from "../lib/supabaseClient.ts";
import { useEffect, useState } from "react";

export default function Navbar() {
  const { totalItems, openCart } = useCart();
  const [isAdminRoute, setIsAdminRoute] = useState(false);
  const [isAdminSession, setIsAdminSession] = useState(false);

  useEffect(() => {
    // detektuj admin rutu (path ili hash)
    const path =
      window.location.pathname ||
      (window.location.hash.startsWith("#/")
        ? window.location.hash.slice(1)
        : "");

    const admin = path === "/admin" || path === "/admin/";
    setIsAdminRoute(admin);

    if (!admin) return;

    supabase.auth.getSession().then(({ data }) => {
      const session = data?.session;
      const role = session?.user?.user_metadata?.role;
      setIsAdminSession(role === "admin");
    });
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/admin/login";
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-black/80 backdrop-blur text-white">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <a href="/" className="text-xl font-bold tracking-wide">
          Padrino
        </a>

        <nav className="flex items-center gap-4">
          {/* ADMIN LOGOUT */}
          {isAdminRoute && isAdminSession && (
            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-full font-semibold transition"
            >
              Logout
            </button>
          )}

          {/* KORPA – samo na public delu */}
          {!isAdminRoute && (
            <button
              onClick={openCart}
              className="relative flex items-center gap-2 bg-yellow-500 text-black px-4 py-2 rounded-full font-semibold hover:bg-yellow-400 transition"
            >
              🛒 Korpa
              {totalItems > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full">
                  {totalItems}
                </span>
              )}
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}











