function Hero() {
  return (
    <section className="relative h-screen flex items-center px-6 overflow-hidden">
      {/* Background image */}
      <div className="absolute inset-0">
        <img
          src="https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&q=80&w=2000"
          alt="Padrino pizza"
          className="w-full h-full object-cover scale-105 opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-6xl">
        <h1 className="text-6xl md:text-8xl lg:text-9xl font-serif tracking-tight leading-none mb-8">
          Padrino{" "}
          <span className="italic font-normal text-zinc-300">
            Pizzeria
          </span>
        </h1>

        <p className="text-xl md:text-2xl text-zinc-400 max-w-xl mb-12">
          Porodična pizzeria nastala u kućnoj kuhinji, danas
          sinonim za kvalitet i brzu dostavu.
        </p>

        <div className="flex gap-6">
          <a
            href="#menu"
            className="bg-white text-black px-12 py-4 rounded-full font-bold uppercase tracking-widest text-sm hover:bg-zinc-200 transition-all shadow-xl"
          >
            Pogledaj meni
          </a>

          <a
            href="#delivery"
            className="border border-white/30 px-12 py-4 rounded-full font-bold uppercase tracking-widest text-sm hover:border-white hover:text-white transition-all backdrop-blur-sm"
          >
            Dostava
          </a>
        </div>
      </div>
    </section>
  );
}

export default Hero;

