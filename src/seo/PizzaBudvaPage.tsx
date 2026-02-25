import { useEffect } from "react";
import { setCanonical, setOgUrl, setRobots, setTitle } from "../lib/seo";

export default function PizzaBudvaPage() {
  useEffect(() => {
    // ✅ SEO for landing page (runtime, bez diranja index.html source-of-truth)
    setTitle("Pizza Budva | Padrino Budva — Dostava & Takeaway");
    setCanonical("https://padrinobudva.com/pizza-budva");
    setOgUrl("https://padrinobudva.com/pizza-budva");
    setRobots("index, follow");
  }, []);

  return (
    <main className="min-h-screen bg-black text-white">
      {/* Hero header */}
      <section className="mx-auto max-w-5xl px-6 pt-24 pb-10">
        <div className="flex flex-col gap-6">
          <a
            href="/"
            className="inline-flex w-fit items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/90 hover:bg-white/10"
          >
            ← Nazad na početnu
          </a>

          <header className="space-y-4">
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight">
              Pizza Budva — Padrino Budva
            </h1>
            <p className="text-white/75 text-base md:text-lg leading-relaxed">
              Tražiš <strong>pizza Budva</strong> koja stiže brzo, ima stabilan kvalitet i ukus koji
              se pamti? Padrino Budva je mesto gde se pizza pravi sa jasnom idejom: dobro testo,
              provereni sastojci i pečenje koje daje onu “pravu” koricu. Bilo da si u centru,
              u blizini obale ili ti treba dostava ka okolnim naseljima, ovde si na pravom mestu
              za <strong>picerija Budva</strong> iskustvo bez komplikovanja.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href="/#meni"
                className="inline-flex items-center justify-center rounded-2xl bg-white px-6 py-3 font-semibold text-black hover:bg-white/90"
              >
                Pogledaj meni
              </a>
              <a
                href="/#kontakt"
                className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-6 py-3 font-semibold text-white hover:bg-white/10"
              >
                Kontakt i lokacija
              </a>
            </div>
          </header>
        </div>
      </section>

      {/* Content */}
      <section className="mx-auto max-w-5xl px-6 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main text */}
          <article className="lg:col-span-2 space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8">
              <h2 className="text-xl md:text-2xl font-semibold">Zašto Padrino kada kucaš “pizza Budva”?</h2>
              <p className="mt-4 text-white/75 leading-relaxed">
                U lokalnoj pretrazi ljudi obično žele jednu stvar: da brzo pronađu pouzdanu opciju.
                Naša prednost je u tome što smo fokusirani na konzistentnost — da ista pizza bude
                jednako dobra svaki put. Kada poručuješ, bitno je da znaš šta dobijaš: jasno
                definisan meni, ukus koji je prepoznatljiv i dostavu/takeaway koji radi bez
                iznenađenja.
              </p>
              <p className="mt-4 text-white/75 leading-relaxed">
                Ako si turista, verovatno tražiš najbolju pizzu u Budvi bez gubljenja vremena.
                Ako si lokalac, želiš mesto koje je “siguran izbor” za ekipu, porodicu ili brz obrok.
                Zato ovu stranicu pravimo kao jasan odgovor na upite poput{" "}
                <strong>padrino budva</strong>, <strong>pizza budva</strong> i{" "}
                <strong>fast food budva</strong> — da sve informacije budu na jednom mestu.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8">
              <h2 className="text-xl md:text-2xl font-semibold">Dostava pizze u Budvi i okolini</h2>
              <p className="mt-4 text-white/75 leading-relaxed">
                Dostava je praktična kada želiš da ostaneš kod kuće, u apartmanu ili na poslu.
                Da bi iskustvo bilo stabilno, najvažnije je da su zone i uslovi jasni.
                Najbrži način je da otvoriš meni i napraviš porudžbinu direktno na sajtu.
                Ako si van zone, uvek postoji opcija da nas pozoveš i proveriš najbolju varijantu.
              </p>

              <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-5">
                <h3 className="font-semibold">Zone dostave (najčešće)</h3>
                <p className="mt-2 text-white/75 leading-relaxed">
                  Budva, Bečići, Rafailovići, Pržno, Sveti Stefan, Seoce, Jaz, Lastva.
                  (Tačni uslovi dostave i minimalni iznosi su prikazani u checkout-u, pre potvrde porudžbine.)
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8">
              <h2 className="text-xl md:text-2xl font-semibold">Kvalitet i ukus — bez marketing magle</h2>
              <p className="mt-4 text-white/75 leading-relaxed">
                Dobra pizza je jednostavna kada je osnova dobra: testo, sos, sir i pečenje.
                Naš fokus je da dobiješ pizzu koja je ukusna i kada je pojedeš odmah, ali i kada
                stigne na dostavu. Zato u meniju držimo jasne opcije, a porudžbina na sajtu je
                napravljena da bude brza: izabereš, dodaš u korpu, potvrdiš — gotovo.
              </p>
              <p className="mt-4 text-white/75 leading-relaxed">
                Ako tražiš “fast food Budva” jer želiš nešto brzo, pizza je često najbolji balans:
                zasitno, deljivo, i možeš da biraš kombinacije. Za ekipu — uzmi nekoliko različitih
                pica. Za solo varijantu — jedna klasika uvek radi posao. A ako prvi put poručuješ,
                kreni od najpopularnijih opcija na meniju.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8">
              <h2 className="text-xl md:text-2xl font-semibold">Kako najbrže poručiti</h2>
              <ol className="mt-4 list-decimal pl-5 text-white/75 space-y-2">
                <li>Otvori meni i izaberi pizzu.</li>
                <li>Dodaj u korpu i proveri detalje porudžbine.</li>
                <li>Unesi podatke i potvrdi — videćeš sve pre finalnog slanja.</li>
                <li>
                  Ako imaš specifičan zahtev ili si van zone, idi na{" "}
                  <a className="underline hover:text-white" href="/#kontakt">
                    kontakt
                  </a>{" "}
                  i pozovi nas.
                </li>
              </ol>

              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <a
                  href="/#meni"
                  className="inline-flex items-center justify-center rounded-2xl bg-white px-6 py-3 font-semibold text-black hover:bg-white/90"
                >
                  Poruči odmah
                </a>
                <a
                  href="/"
                  className="inline-flex items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-6 py-3 font-semibold text-white hover:bg-white/10"
                >
                  Nazad na početnu
                </a>
              </div>
            </div>
          </article>

          {/* Sidebar */}
          <aside className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="text-sm text-white/60">Brzi linkovi</div>
              <div className="mt-4 flex flex-col gap-3">
                <a className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 hover:bg-black/40" href="/#meni">
                  Meni
                </a>
                <a className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 hover:bg-black/40" href="/#delivery">
                  Dostava
                </a>
                <a className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 hover:bg-black/40" href="/#faq">
                  FAQ
                </a>
                <a className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 hover:bg-black/40" href="/#kontakt">
                  Kontakt
                </a>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="text-sm text-white/60">Napomena</div>
              <p className="mt-3 text-white/75 leading-relaxed">
                Ova stranica je napravljena da bude jasna ulazna tačka za lokalne pretrage
                (“pizza budva”, “picerija budva”, “padrino budva”). Za kompletan meni i porudžbinu,
                koristi link “Meni”.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}