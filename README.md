# 🍳 Opskrifter

En personlig, **lokal-først** opskriftsapp: gem opskrifter, beregn næringsindhold automatisk, filtrér efter måltidstype og planlæg ugens aftensmad. Alt ligger i din egen browser — ingen konto, ingen server, ingen sky.

Bygget som en **PWA**, så den kan installeres på mobil/tablet og virke offline.

---

## ✨ Funktioner

- **Opskriftssamling** — opret, redigér, bedøm og søg (fuzzy-søgning på titel, ingredienser og tags).
- **Automatisk næringsberegning** — kalorier, protein, kulhydrat og fedt pr. ret, pr. portion og pr. 100 g, med en detaljeret tabel pr. ingrediens. Bygger på en indbygget dansk ingrediensdatabase (~130 varer) + Open Food Facts som fallback.
- **Måltidstype-filtre** — proteinrig, let, mættende (Fullness Factor), fedtfattig, lavkulhydrat m.fl. Vises også som ikoner på opskriftskortene.
- **Ugentlig madplan** + automatisk **indkøbsliste**.
- **Import fra link** — indsæt en URL, så udfyldes formularen automatisk (kun i desktop-/dev-versionen — se nedenfor). Understøtter også "indsæt kildekode" for sider med bot-beskyttelse.
- **Lys/mørk tilstand** (mørk som standard).
- **Eksport/import** af alle data som én JSON-fil — din måde at flytte opskrifter mellem enheder.
- **Responsivt design** — egen bund-navigation og layout til mobil/tablet.
- **Offline** — service worker cacher app-skallen; data ligger i IndexedDB.

---

## 🚀 Kom i gang (udvikling)

Kræver [Node.js](https://nodejs.org) (LTS).

```bash
npm install      # installér afhængigheder
npm run dev      # start udviklingsserver på http://localhost:5173
npm run build    # type-tjek + produktionsbuild til dist/
npm run preview  # forhåndsvis produktionsbuild lokalt
npm run lint     # ESLint
```

---

## 📱 Installér på mobil/tablet

Når appen er udgivet (se nedenfor), åbnes adressen i browseren og tilføjes til hjemmeskærmen:

- **iPhone/iPad (Safari):** Del-knappen → *Føj til hjemmeskærm*
- **Android (Chrome):** menuen (⋮) → *Installér app*

Derefter opfører den sig som en almindelig app og virker offline.

---

## ☁️ Udgivelse (GitHub Pages)

Appen er klar til GitHub Pages: relative stier (`base: './'`), **HashRouter** (ingen 404 ved sideopdatering) og en GitHub Actions-workflow der bygger og udruller automatisk ved hvert push til `main`.

Trin-for-trin guide: **[DEPLOY-GITHUB-PAGES.md](./DEPLOY-GITHUB-PAGES.md)**.

Kort fortalt: opret et public repo → push koden → **Settings → Pages → Source: GitHub Actions**. Herefter udruller hvert push automatisk.

---

## 💾 Data og synkronisering

Appen er **lokal-først**: alle opskrifter og madplaner gemmes i enhedens IndexedDB. Der er ingen automatisk synkronisering mellem enheder — det er bevidst.

Sådan flytter du data mellem PC, mobil og tablet:

1. ⚙ **Indstillinger → Eksporter opskrifter** (på mobil åbnes systemets delemenu; på desktop hentes en `.json`-fil).
2. Send filen til den anden enhed (mail, AirDrop, Drev …).
3. ⚙ **Indstillinger → Importér opskrifter** → vælg filen.

---

## ⚠️ Begrænsninger

- **URL-import** (indsæt link → hent opskrift) kræver en lokal proxy, der kun kører i `npm run dev`. I den udgivne PWA er funktionen skjult — brug i stedet fil-import. (Cloudflare-beskyttede sider kan heller ikke hentes automatisk; brug "indsæt kildekode" i desktop-versionen.)
- **Næringstal er vejledende** — den indbyggede database dækker almindelige danske ingredienser; ukendte slås op via Open Food Facts og kan variere.

---

## 🛠️ Teknologi

React 19 · TypeScript · Vite · Tailwind CSS v4 · Dexie (IndexedDB) · React Router · Fuse.js · Framer Motion · dnd-kit · Open Food Facts.

---

## 📁 Struktur (overblik)

```
src/
  pages/        Home, RecipeDetail, NewRecipe, EditRecipe, MealPlan
  components/   RecipeForm, RecipeCard, FilterPanel, UrlImporter, ui/
  lib/          nutritionService.ts (næring), recipeImporter.ts (import)
  db/           database.ts (Dexie-skema + eksport/import)
  hooks/        useRecipes, useSearch
public/         manifest.webmanifest, sw.js, ikoner
```

Detaljeret arkitektur for udviklere/AI-assistenter findes i **[CLAUDE.md](./CLAUDE.md)**.
