import { useState } from "react";

type Item = {
  question: string;
  answer: string;
};

export default function FAQ() {
  const items: Item[] = [
    {
      question: "Da li Padrino vrši dostavu u Budvi?",
      answer:
        "Da, Padrino Pizzeria vrši dostavu pizze u Budvi i okolini. Sve informacije o zoni dostave su jasno prikazane tokom naručivanja.",
    },
    {
      question: "Koliko traje dostava pizze?",
      answer:
        "Prosječno vrijeme dostave u Budvi je oko 30 minuta, u zavisnosti od gužve, termina i lokacije.",
    },
    {
      question: "Kako mogu poručiti pizzu online?",
      answer:
        "Poručivanje je jednostavno — izaberite pizzu sa menija, dodajte proizvode u korpu i završite narudžbu direktno putem sajta.",
    },
    {
      question: "Kako mogu platiti porudžbinu?",
      answer:
        "Porudžbinu možete platiti gotovinom prilikom dostave ili karticom online, kroz siguran Bankart checkout, u zavisnosti od izabranog načina plaćanja.",
    },
    {
      question: "Da li dostavljate u okolini Budve?",
      answer:
        "Dostava je dostupna u Budvi i okolnim zonama. Ako niste sigurni da li ste u zoni dostave, možete nas kontaktirati prije poručivanja.",
    },
  ];

  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section
      id="faq"
      className="bg-black py-24 md:py-32"
      aria-labelledby="faq-title"
    >
      <div className="mx-auto max-w-4xl px-6">
        <div className="mb-16 text-center">
          <div className="p-kicker mb-4">FAQ</div>
          <h2 id="faq-title" className="p-title text-4xl md:text-5xl">
            Česta pitanja
          </h2>
          <p className="mx-auto mt-4 max-w-2xl leading-relaxed text-white/60">
            Odgovori na najčešća pitanja o dostavi pizze u Budvi,
            poručivanju i načinima plaćanja.
          </p>
        </div>

        <div className="space-y-4">
          {items.map((item, index) => {
            const isOpen = openIndex === index;

            return (
              <div
                key={item.question}
                className="p-glass p-glass-hover rounded-2xl"
              >
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-6 py-5 text-left"
                  onClick={() =>
                    setOpenIndex(isOpen ? null : index)
                  }
                >
                  <span className="font-serif text-lg text-white/90">
                    {item.question}
                  </span>
                  <span className="text-xl text-white/60">
                    {isOpen ? "−" : "+"}
                  </span>
                </button>

                {isOpen && (
                  <div className="px-6 pb-6 leading-relaxed text-white/65">
                    {item.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
