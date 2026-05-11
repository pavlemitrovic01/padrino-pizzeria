---
name: doc-lens
description: Izvlači samo relevantan deo iz ROADMAP-a ili BIBLE-a za konkretan task. Koristi scout (Haiku) za extraction. Sprečava punjenje konteksta celim dokumentima.
---

# doc-lens — Document Extraction Lens

## Uloga

Sprečava da se ROADMAP (~170 linija) i BIBLE (~790 linija) čitaju celi svaki put. Posle workflow v3 doc consolidation veličine su znatno manje, ali skill ostaje za buduće rast.
Uzima task fokus → vraća samo relevantne delove → ništa više.

## Kako pozvati

```
/doc-lens roadmap [fokus]
/doc-lens bible [fokus]
```

**Primeri:**
```
/doc-lens roadmap arrival motion
/doc-lens roadmap R5 scope
/doc-lens bible anti-goals
/doc-lens bible color CL3
/doc-lens bible panel treatment
```

## Dostupni dokumenti

| Parametar | Fajl |
|-----------|------|
| `roadmap` | `workflow/projects/[aktivni-projekat]/ROADMAP.md` |
| `bible` | `workflow/projects/[aktivni-projekat]/BIBLE.md` |

> Putanja zavisi od aktivnog projekta — proveri u `workflow/STATE.md` "Kontekst" polje.

## Proces

### Korak 1 — Spawn scout

Spawni `scout` (Agent tool, `subagent_type: scout`) sa ovim promptom:

```
TASK: Iz dokumenta [PUTANJA] pronađi i vrati sve sekcije koje sadrže reč ili frazu: [FOKUS]
FILES: [PUTANJA]
RETURN: verbatim citati svih matching sekcija — naslov sekcije, tačan sadržaj, broj linije. Ako ima više matching sekcija, vrati sve. Ne biraj, ne filtriraj, ne parafraziraj.
FORBIDDEN: ne donosi zaključke, ne procenjuj, ne biraj "best match", ne interpretiraj šta je relevantno, ne predlažaj, ne širi scope, ne piši ništa van traženih citata
```

### Korak 2 — Filter i prezentacija

Nakon što scout vrati ekstrakciju:

1. Proveri da li je ekstrakcija relevantna za task fokus
2. Ako jeste → vrati direktno korisniku sa jasnim headerom
3. Ako nije dovoljno specifična → refinuj fokus i spawni ponovo (max 1 dodatni spawn)

### Korak 3 — Output format

```
DOC-LENS: [dokument] / [fokus]

[Relevantne sekcije — direktni citati sa naslovima]

LINIJE: [opseg linija u dokumentu]
PRESKOČENO: [šta nije relevantno za ovaj fokus — samo ako je korisno znati]
```

## Pravila

- Nikad ne čitaj ceo dokument sam — uvek delegiraj scout-u.
- Ako fokus nije dovoljno specifičan → postavi jedno pitanje pre spawna.
- Ako scout ne pronađe ništa relevantno → vrati "NOT FOUND" i predloži alternativni fokus.
- Ne interpretuj ekstrakciju. Ne dodaj svoje zaključke. Vraćaj samo šta piše u dokumentu.
- Ekstrakcija je tačka — Sonnet/Opus donose zaključke sami.
