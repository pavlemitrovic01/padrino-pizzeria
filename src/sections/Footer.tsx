function Footer() {
  return (
    <footer className="bg-zinc-950 border-t border-white/10 py-16 px-6 text-white">
      <div className="max-w-7xl mx-auto grid md:grid-cols-3 gap-12 items-start">

        {/* LEFT */}
        <div>
          <h3 className="text-2xl font-serif tracking-wide">
            Padrino
          </h3>

          <p className="mt-4 text-zinc-400 text-sm max-w-sm">
            Porodična pizzeria nastala iz ljubavi prema
            autentičnim italijanskim ukusima i brzoj dostavi.
          </p>
        </div>

        {/* CENTER */}
        <div>
          <p className="text-xs uppercase tracking-widest text-zinc-500 mb-6">
            Navigacija
          </p>

          <ul className="space-y-3 text-zinc-400 text-sm">
            <li>
              <a href="#about" className="hover:text-amber-500 transition">
                O nama
              </a>
            </li>
            <li>
              <a href="#menu" className="hover:text-amber-500 transition">
                Meni
              </a>
            </li>
            <li>
              <a href="#delivery" className="hover:text-amber-500 transition">
                Dostava
              </a>
            </li>
            <li>
              <a href="#contact" className="hover:text-amber-500 transition">
                Kontakt
              </a>
            </li>
          </ul>
        </div>

        {/* RIGHT */}
        <div>
          <p className="text-xs uppercase tracking-widest text-zinc-500 mb-6">
            Pratite nas
          </p>

          <div className="flex gap-4">
            <a
              href="#"
              className="w-10 h-10 flex items-center justify-center rounded-full border border-white/10 hover:border-amber-500 hover:text-amber-500 transition"
            >
              IG
            </a>

            <a
              href="#"
              className="w-10 h-10 flex items-center justify-center rounded-full border border-white/10 hover:border-amber-500 hover:text-amber-500 transition"
            >
              FB
            </a>

            <a
              href="#"
              className="w-10 h-10 flex items-center justify-center rounded-full border border-white/10 hover:border-amber-500 hover:text-amber-500 transition"
            >
              X
            </a>
          </div>
        </div>
      </div>

      {/* BOTTOM */}
      <div className="mt-16 text-center text-zinc-500 text-xs tracking-widest uppercase">
        © 2024 Padrino Pizzeria — Sva prava zadržana
      </div>
    </footer>
  );
}

export default Footer;

