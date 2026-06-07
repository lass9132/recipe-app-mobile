# Udgiv appen på GitHub Pages

Denne guide viser hvordan du lægger appen på GitHub Pages, så du kan åbne den på
mobil/tablet og "Tilføj til hjemmeskærm". Al data bliver stadig kun lokalt på hver enhed.

Appen er allerede gjort klar til GitHub Pages:
- `vite.config.ts` bruger `base: './'` (relative stier — virker i en undermappe `/REPO/`).
- Appen bruger **HashRouter** (URLs som `…/#/mealplan`), så sideopdatering aldrig giver 404.
- `.github/workflows/deploy.yml` bygger og udgiver automatisk ved hvert push.

---

## Forudsætninger (engangs)

1. **Git** installeret. Tjek i en terminal: `git --version`. Ellers hent: https://git-scm.com/download/win
2. En **GitHub-konto**: https://github.com
3. **Vigtigt om gratis konti:** GitHub Pages er gratis på **offentlige** repositories.
   (Privat repo + Pages kræver et betalt GitHub Pro-abonnement.) Lav derfor et **public** repo,
   medmindre du har Pro. Koden indeholder ingen hemmeligheder — kun din egen opskrifts-app.

---

## Trin 1 — Opret et repository på GitHub

1. Gå til https://github.com/new
2. **Repository name:** fx `opskrifter`
3. Vælg **Public**
4. Lad "Add a README/.gitignore/license" være **slået fra** (vi pusher selv).
5. Klik **Create repository**.

Noter URL'en der vises, fx: `https://github.com/DITBRUGERNAVN/opskrifter.git`

---

## Trin 2 — Push appen op

Åbn en terminal **i denne mappe** (`recipe-app-mobile`) og kør (udskift `DITBRUGERNAVN`):

```bash
git init
git add .
git commit -m "Opskrifts-app (PWA)"
git branch -M main
git remote add origin https://github.com/DITBRUGERNAVN/opskrifter.git
git push -u origin main
```

> Mappens indhold bliver repo-roden (`package.json` skal ligge i roden — det gør den her).
> `node_modules` og `dist` pushes ikke (de står i `.gitignore`); GitHub bygger selv i skyen.

Bliver du bedt om login, brug din GitHub-bruger + et **Personal Access Token** som adgangskode
(GitHub → Settings → Developer settings → Tokens), eller log ind via browseren hvis den popper op.

---

## Trin 3 — Slå GitHub Pages til (via Actions)

1. På dit repo: **Settings** → **Pages** (venstre menu).
2. Under **Build and deployment → Source**, vælg **GitHub Actions**.
   (IKKE "Deploy from a branch".)

Det er alt — ingen yderligere konfiguration. Workflowen `deploy.yml` står for resten.

---

## Trin 4 — Vent på udrulning

1. Gå til fanen **Actions** i repoet.
2. Du ser et kørende job "Deploy til GitHub Pages" (startet af dit push). Det tager ~1 minut.
3. Når det er grønt: gå til **Settings → Pages** — øverst står din adresse:

   ```
   https://DITBRUGERNAVN.github.io/opskrifter/
   ```

Åbn den i en browser — appen kører nu.

---

## Trin 5 — Installér på mobil/tablet

1. Åbn adressen på telefonen.
2. **iPhone/iPad (Safari):** Del-knappen → **Føj til hjemmeskærm**.
3. **Android (Chrome):** menuen (⋮) → **Installér app** / **Føj til startskærm**.

Appen får sit eget ikon, åbner i fuldskærm og virker offline.

---

## Daglig brug: flyt data mellem enheder

Hver enhed (PC, mobil, tablet) har sin egen lokale database. For at flytte opskrifter:

1. På enhed A: **⚙ Indstillinger → Eksporter opskrifter**.
   - På mobil åbner systemets delemenu (Mail, AirDrop, Drev …) — send filen til dig selv.
   - På PC downloades en `.json`-fil — send den fx via mail.
2. På enhed B: **⚙ Indstillinger → Importér opskrifter** → vælg filen.

> URL-import (indsæt link → hent opskrift) virker kun i desktop-udviklingsversionen
> (`npm run dev`). I den udgivne app importerer du i stedet via fil.

---

## Sådan opdaterer du appen senere

Ret koden lokalt, og kør:

```bash
git add .
git commit -m "Beskriv din ændring"
git push
```

Pushet udløser automatisk en ny bygning, og siden opdateres efter ~1 minut.
(Telefonen henter den nye version næste gang den er online; service-workeren opdaterer i baggrunden.)

---

## Fejlfinding

- **Actions-jobbet fejler i `npm ci`:** sørg for at `package-lock.json` er committed (den ligger i roden).
- **Siden er blank / 404 på assets:** tjek at `vite.config.ts` har `base: './'` (det har den).
- **Pages viser repoets README i stedet for appen:** Source skal være **GitHub Actions** (Trin 3), ikke en branch.
- **Privat repo, Pages utilgængelig:** gør repoet **Public** (Settings → General → Danger Zone → Change visibility), eller opgrader til GitHub Pro.
