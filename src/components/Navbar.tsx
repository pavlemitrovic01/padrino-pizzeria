import { useCart } from "../context/useCart";

export default function Navbar() {
  const { totalItems, openCart } = useCart();

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-black/80 backdrop-blur text-white">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <a href="/" className="text-xl font-bold tracking-wide">
          Padrino
        </a>

        <nav className="flex items-center gap-6">
          <a
            href="#menu"
            className="hover:text-yellow-400 transition"
          >
            Izbornik
          </a>

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
        </nav>
      </div>
    </header>
  );
}

















