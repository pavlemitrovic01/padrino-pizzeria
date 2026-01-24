function Contact() {
  return (
    <section
      id="contact"
      className="py-32 px-6 bg-zinc-900 text-white"
    >
      <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-16 items-start">
        
        {/* LEFT – INFO */}
        <div>
          <span className="text-amber-500 uppercase tracking-widest text-sm">
            Kontakt
          </span>

          <h2 className="mt-4 text-5xl font-serif leading-tight">
            Javite nam se
          </h2>

          <p className="mt-6 text-zinc-400 max-w-md">
            Imate li pitanje, sugestiju ili želite suradnju?
            Pišite nam – brzo odgovaramo.
          </p>

          <div className="mt-10 space-y-6 text-zinc-300">
            <div>
              <p className="text-sm uppercase tracking-widest text-zinc-500">
                Telefon
              </p>
              <p className="text-lg">+382markozvanibobi</p>
            </div>

            <div>
              <p className="text-sm uppercase tracking-widest text-zinc-500">
                E-mail
              </p>
              <p className="text-lg">info@padrino.bobilend</p>
            </div>

            <div>
              <p className="text-sm uppercase tracking-widest text-zinc-500">
                Adresa
              </p>
              <p className="text-lg">
                Kralja Bobija 15, Beograd
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT – FORM */}
        <form
          className="
            p-10
            rounded-2xl
            bg-zinc-950
            border border-white/10
            space-y-6
          "
        >
          <div>
            <label className="block text-xs uppercase tracking-widest text-zinc-500 mb-2">
              Ime
            </label>
            <input
              type="text"
              placeholder="Vaše ime"
              className="
                w-full
                bg-transparent
                border-b border-white/20
                py-3
                outline-none
                text-white
                focus:border-amber-500
                transition
              "
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-widest text-zinc-500 mb-2">
              E-mail
            </label>
            <input
              type="email"
              placeholder="Vaš e-mail"
              className="
                w-full
                bg-transparent
                border-b border-white/20
                py-3
                outline-none
                text-white
                focus:border-amber-500
                transition
              "
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-widest text-zinc-500 mb-2">
              Poruka
            </label>
            <textarea
              rows={4}
              placeholder="Vaša poruka"
              className="
                w-full
                bg-transparent
                border-b border-white/20
                py-3
                outline-none
                text-white
                focus:border-amber-500
                transition
                resize-none
              "
            />
          </div>

          <button
            type="submit"
            className="
              mt-6
              w-full
              py-4
              rounded-full
              bg-amber-500
              text-black
              font-semibold
              uppercase
              tracking-widest
              hover:bg-amber-400
              transition
            "
          >
            Pošaljite poruku
          </button>
        </form>
      </div>
    </section>
  );
}

export default Contact;


