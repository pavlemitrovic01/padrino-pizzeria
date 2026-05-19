import { useEffect } from "react";
import { SITE_URL } from "../lib/config";

const PAGE_URL = `${SITE_URL}/pizza-budva`;

function upsertJsonLd(id: string, json: unknown) {
  if (typeof document === "undefined") return;

  const prev = document.getElementById(id);
  if (prev && prev.parentNode) prev.parentNode.removeChild(prev);

  const script = document.createElement("script");
  script.id = id;
  script.type = "application/ld+json";
  script.text = JSON.stringify(json);
  document.head.appendChild(script);
}

export default function PizzaBudvaPage() {
  useEffect(() => {
    // ✅ Structured data (JSON-LD): Breadcrumbs + FAQ + Restaurant signal
    upsertJsonLd("ld-breadcrumb-pizza-budva", {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Padrino Budva",
          item: SITE_URL,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Pizza Budva",
          item: PAGE_URL,
        },
      ],
    });

    upsertJsonLd("ld-faq-pizza-budva", {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "Da li radite dostavu pizze u Budvi?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Da. Dostava je dostupna u Budvi i najčešćim zonama oko Budve. Tačne uslove (minimalni iznos i fee) vidiš u checkout-u pre potvrde porudžbine.",
          },
        },
        {
          "@type": "Question",
          name: "Da li mogu da poručim online ili je potrebno da zovem?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Možeš da poručiš online direktno na sajtu. Ako si van zone dostave ili imaš specifičan zahtev, najbolje je da nas pozoveš preko Kontakt sekcije.",
          },
        },
        {
          "@type": "Question",
          name: "Gde mogu da vidim meni i cene?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Meni je dostupan na sajtu. Klikni na “Pogledaj meni” ili idi na sekciju Meni na početnoj stranici.",
          },
        },
        {
          "@type": "Question",
          name: "Da li je ovo fast food opcija u Budvi?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Ako tražiš brz i siguran obrok, pizza je odličan izbor. Padrino je praktična fast food opcija u Budvi — poruči online ili preuzmi za poneti.",
          },
        },
      ],
    });

    upsertJsonLd("ld-restaurant-pizza-budva", {
      "@context": "https://schema.org",
      "@type": "Restaurant",
      "@id": `${SITE_URL}/#restaurant`,
      name: "Padrino Budva",
      url: SITE_URL,
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: "4.9",
        reviewCount: "1094",
      },
      areaServed: [
        "Budva",
        "Bečići",
        "Rafailovići",
        "Pržno",
        "Sveti Stefan",
        "Seoce",
        "Jaz",
        "Lastva",
      ],
      hasMenu: `${SITE_URL}/#meni`,
      priceRange: "€€",
      image: `${SITE_URL}/sections/hero.webp`,
    });

    return () => {
      if (typeof document === "undefined") return;
      ["ld-breadcrumb-pizza-budva", "ld-faq-pizza-budva", "ld-restaurant-pizza-budva"].forEach((id) => {
        const el = document.getElementById(id);
        if (el && el.parentNode) el.parentNode.removeChild(el);
      });
    };
  }, []);

  return (
    <main className="min-h-screen bg-black text-white">
      <section className="mx-auto max-w-5xl px-6 pt-24 pb-10">
        <div className="flex flex-col gap-6">
          <a
            href="/"
            className="inline-flex w-fit items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/90 hover:bg-white/10"
          >
            ← Nazad na početnu
          </a>

          <header className="space-y-4">
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight">Pizza Budva — Padrino Budva</h1>
            <p className="text-white/75 text-base md:text-lg leading-relaxed">
              Tražiš <strong>pizza Budva</strong> koja stiže brzo, ima stabilan kvalitet i ukus koji se pamti? Padrino
              Budva je mesto gde se pizza pravi sa jasnom idejom: dobro testo, provereni sastojci i pečenje koje daje
              onu “pravu” koricu. Bilo da si u centru, u blizini obale ili ti treba dostava ka okolnim naseljima, ovde
              si na pravom mestu za <strong>picerija Budva</strong> iskustvo bez komplikovanja.
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

            <div className="pt-2 text-sm text-white/60">
              Lokalno poverenje: <span className="text-white/80 font-semibold">4.9</span> ocena na{" "}
              <span className="text-white/80 font-semibold">1.094</span> recenzija.
            </div>
          </header>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <article className="lg:col-span-2 space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8">
              <h2 className="text-xl md:text-2xl font-semibold">Zašto Padrino kada kucaš “pizza Budva”?</h2>
              <p className="mt-4 text-white/75 leading-relaxed">
                U lokalnoj pretrazi ljudi obično žele jednu stvar: da brzo pronađu pouzdanu opciju. Naša prednost je u
                tome što smo fokusirani na konzistentnost — da ista pizza bude jednako dobra svaki put. Kada poručuješ,
                bitno je da znaš šta dobijaš: jasno definisan meni, ukus koji je prepoznatljiv i dostavu/takeaway koji
                radi bez iznenađenja.
              </p>
              <p className="mt-4 text-white/75 leading-relaxed">
                Ako si turista, verovatno tražiš najbolju pizzu u Budvi bez gubljenja vremena. Ako si lokalac, želiš
                mesto koje je “siguran izbor” za ekipu, porodicu ili brz obrok. Zato ovu stranicu pravimo kao jasan
                odgovor na upite poput <strong>padrino budva</strong>, <strong>pizza budva</strong> i{" "}
                <strong>fast food budva</strong> — da sve informacije budu na jednom mestu.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8">
              <h2 className="text-xl md:text-2xl font-semibold">Dostava pizze u Budvi i okolini</h2>
              <p className="mt-4 text-white/75 leading-relaxed">
                Dostava je praktična kada želiš da ostaneš kod kuće, u apartmanu ili na poslu. Da bi iskustvo bilo
                stabilno, najvažnije je da su zone i uslovi jasni. Najbrži način je da otvoriš meni i napraviš porudžbinu
                direktno na sajtu. Ako si van zone, uvek postoji opcija da nas pozoveš i proveriš najbolju varijantu.
              </p>

              <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-5">
                <h3 className="font-semibold">Zone dostave</h3>
                <p className="mt-2 text-white/75 leading-relaxed">
                  Budva, Bečići, Rafailovići, Pržno, Sveti Stefan, Seoce, Jaz, Lastva. (Tačni uslovi dostave i minimalni
                  iznosi su prikazani u checkout-u, pre potvrde porudžbine.)
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8">
              <h2 className="text-xl md:text-2xl font-semibold">Kvalitet i ukus — bez marketing magle</h2>
              <p className="mt-4 text-white/75 leading-relaxed">
                Dobra pizza je jednostavna kada je osnova dobra: testo, sos, sir i pečenje. Naš fokus je da dobiješ pizzu
                koja je ukusna i kada je pojedeš odmah, ali i kada stigne na dostavu. Zato u meniju držimo jasne opcije,
                a porudžbina na sajtu je napravljena da bude brza: izabereš, dodaš u korpu, potvrdiš — gotovo.
              </p>
              <p className="mt-4 text-white/75 leading-relaxed">
                Ako tražiš “fast food Budva” jer želiš nešto brzo, pizza je često najbolji balans: zasitno, deljivo, i
                možeš da biraš kombinacije. Za ekipu — uzmi nekoliko različitih pica. Za solo varijantu — jedna klasika
                uvek radi posao. A ako prvi put poručuješ, kreni od najpopularnijih opcija na meniju.
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

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 md:p-8">
              <h2 className="text-xl md:text-2xl font-semibold">FAQ</h2>

              <div className="mt-4 space-y-4">
                <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                  <div className="font-semibold">Da li radite dostavu u Budvi?</div>
                  <div className="mt-2 text-white/75">
                    Da. Dostava je dostupna u Budvi i najčešćim zonama oko Budve. Tačne uslove vidiš u checkout-u pre
                    potvrde porudžbine.
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                  <div className="font-semibold">Da li mogu da poručim online?</div>
                  <div className="mt-2 text-white/75">
                    Možeš. Poruči direktno na sajtu. Ako si van zone ili imaš specifičan zahtev, pozovi nas preko Kontakt
                    sekcije.
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                  <div className="font-semibold">Gde je meni i cene?</div>
                  <div className="mt-2 text-white/75">
                    Meni je na sajtu — klikni “Pogledaj meni” ili idi na sekciju Meni na početnoj stranici.
                  </div>
                </div>
              </div>
            </div>
          </article>

          <aside className="space-y-6">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="text-sm text-white/60">Brzi linkovi</div>
              <div className="mt-4 flex flex-col gap-3">
                <a className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 hover:bg-black/40" href="/#meni">
                  Meni
                </a>
                <a
                  className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 hover:bg-black/40"
                  href="/#delivery"
                >
                  Dostava
                </a>
                <a className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 hover:bg-black/40" href="/faq">
                  FAQ
                </a>
                <a
                  className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 hover:bg-black/40"
                  href="/#kontakt"
                >
                  Kontakt
                </a>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="text-sm text-white/60">Napomena</div>
              <p className="mt-3 text-white/75 leading-relaxed">
                Ova stranica je napravljena kao ulazna tačka za lokalne pretrage (“pizza budva”, “picerija budva”,
                “padrino budva”). Za porudžbinu i kompletan meni koristi “Meni”.
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
              <div className="text-sm text-white/60">SEO signal</div>
              <p className="mt-3 text-white/75 leading-relaxed">
                Stranica ima strukturirane podatke (FAQ + breadcrumbs + restaurant signal) kako bi Google lakše razumeo
                temu i relevantnost za “pizza Budva”.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}