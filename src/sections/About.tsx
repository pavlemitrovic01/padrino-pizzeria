function About() {
  return (
    <section
      id="about"
      className="py-32 px-6 bg-zinc-950 text-white"
    >
      <div className="max-w-7xl mx-auto grid md:grid-cols-2 gap-16 items-center">
        
        {/* IMAGE */}
        <div className="group relative overflow-hidden rounded-2xl shadow-2xl">
          <img
            src="/menu/about.png"
            alt="Naša priča"
            className="
              w-full
              h-full
              object-cover
              transition
              duration-700
              ease-out
              group-hover:scale-105
            "
          />

          {/* Overlay */}
          <div
            className="
              absolute inset-0
              bg-gradient-to-t
              from-black/50
              via-black/20
              to-transparent
              opacity-0
              group-hover:opacity-100
              transition
              duration-700
            "
          />
        </div>

        {/* TEXT */}
        <div>
          <span className="text-amber-500 uppercase tracking-widest text-sm">
            Naša priča
          </span>

          <h2 className="mt-4 text-5xl font-serif leading-tight">
            Iz kućne kuhinje <br /> do vaših vrata
          </h2>

          <p className="mt-6 text-zinc-300 leading-relaxed">
            Padrino je nastao u porodičnoj kuhinji, iz želje da se autentični
            italijanski ukusi podele sa komšilukom. Prve pice su pravljene ručno,
            sa istom pažnjom kao za najbliže.
          </p>

          <p className="mt-4 text-zinc-400 leading-relaxed">
            Danas, i dalje negujemo iste vrednosti – kvalitet, tradiciju i brzu
            dostavu. Svaka porudžbina nosi deo naše porodične priče.
          </p>

          {/* STATS */}
          <div className="mt-10 grid grid-cols-2 gap-8">
            <div>
              <span className="block text-4xl font-serif text-amber-500">
                2014
              </span>
              <span className="text-sm text-zinc-400">
                Početak priče
              </span>
            </div>

            <div>
              <span className="block text-4xl font-serif text-amber-500">
                30min
              </span>
              <span className="text-sm text-zinc-400">
                Prosečna dostava
              </span>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}

export default About;






