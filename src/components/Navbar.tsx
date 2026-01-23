import { useCart } from "../context/useCart";

export default function Navbar() {
  const { totalItems, openCart } = useCart();
  // const [pulse, setPulse] = useState(false);

  // useEffect(() => {
  //   if (totalItems > 0) {
  //     setPulse(true);
  //     const t = setTimeout(() => setPulse(false), 300);
  //     return () => clearTimeout(t);
  //   }
  // }, [totalItems]);

  return (
    <header className="fixed top-0 left-0 w-full z-40 bg-black/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="text-white font-serif text-2xl">Padrino</div>

        <nav className="hidden md:flex gap-8 text-white">
          <a href="#about" className="hover:text-amber-500">O nama</a>
          <a href="#menu" className="hover:text-amber-500">Meni</a>
          <a href="#delivery" className="hover:text-amber-500">Dostava</a>
          <a href="#contact" className="hover:text-amber-500">Kontakt</a>
        </nav>

        <button
          onClick={openCart}
          className="
            relative
            bg-amber-500 hover:bg-amber-600
            text-black
            px-6 py-3
            rounded-full
            font-semibold
            transition
          "
        >
          Korpa

          {totalItems > 0 && (
            <span
              className="
                absolute -top-2 -right-2
                w-6 h-6
                text-xs
                bg-black text-white
                flex items-center justify-center
                rounded-full
              "
            >
              {totalItems}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}


















