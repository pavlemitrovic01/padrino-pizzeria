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
        "Prosječno vrijeme dostave u Budvi je oko 30 minuta, u zavisnosti od gužve i lokacije.",
    },
    {
      question: "Kako mogu poručiti pizzu online?",
      answer:
        "Poručivanje je jednostavno – izaberite pizzu sa menija, dodajte u korpu i završite narudžbu direktno putem sajta.",
    },
    {
      question: "Da li je moguće platiti pouzećem?",
      answer:
        "Trenutno je dostupno plaćanje pouzećem prilikom dostave.",
    },
    {
      question: "Da li dostavljate u okolini Budve?",
      answer:
        "Dostava je dostupna u Budvi i okolnim zonama. Ukoliko niste sigurni da li ste u zoni dostave, možete nas kontaktirati.",
    },
  ];

  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section
      id="faq"
      className="bg-black py-24 md:py-32"
      aria-labelledby="faq-title"
    >
      <div className="max-w-4xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="p-kicker mb-4">FAQ</div>
          <h2 id="faq-title" className="p-title text-4xl md:text-5xl">
            Česta pitanja
          </h2>
          <p className="mt-4 text-white/60 max-w-2xl mx-auto leading-relaxed">
            Odgovori na najčešća pitanja o dostavi pizze u Budvi,
            poručivanju i načinu plaćanja.
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
                  className="w-full text-left px-6 py-5 flex justify-between items-center"
                  onClick={() =>
                    setOpenIndex(isOpen ? null : index)
                  }
                >
                  <span className="font-serif text-lg text-white/90">
                    {item.question}
                  </span>
                  <span className="text-white/60 text-xl">
                    {isOpen ? "−" : "+"}
                  </span>
                </button>

                {isOpen && (
                  <div className="px-6 pb-6 text-white/65 leading-relaxed">
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
