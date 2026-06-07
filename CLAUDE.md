# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server (localhost:5173)
npm run build     # Type-check + production build
npm run lint      # ESLint
npm run preview   # Preview production build
```

There are no tests. No test runner is configured.

## Architecture

Local-first recipe management app. All data lives in the browser's IndexedDB via Dexie — no backend.

### Data flow

`src/db/database.ts` — Dexie schema (version 2) + all CRUD helpers. Tables:
- `recipes` — indexed on `id, title, createdAt, updatedAt, rating`
- `mealPlans` — indexed on `++id, weekStart`
- `nutritionCache` — primary key `name` (normalised ingredient name), caches Open Food Facts lookups for 30 days

Also exports `exportData()` and `importData(file)` (bulkPut from a previously exported file), both wired to the Settings (⚙) dropdown in the navbar. `exportData()` builds the dated `.json` and, on mobile, offers it through the **Web Share API** (`navigator.canShare`/`navigator.share` with a `File`) so it can be sent straight to Mail/AirDrop/Drive; on desktop (or if share is unavailable/cancelled-other) it falls back to a Blob download. This file flow is the only way data moves between devices — the app is otherwise fully local.

`src/types/recipe.ts` — canonical types. Key details:
- `Ingredient` has `isHeader?: boolean` — when true, the row is a section heading (or empty spacer) rather than an actual ingredient. `_id` fields exist only in component state and are stripped before saving.
- `Recipe.instructions` is a single `string` (free-text), not an array of steps.
- `Recipe.nutrition?: RecipeNutrition` — optional, calculated on demand. Contains `total`, `per100g`, `totalGrams`, `details` (per-ingredient breakdown), `servings`, `missing[]`.
- `MealPlan` only uses the `dinner` slot.

### Dark mode

Tailwind v4 is configured in `src/index.css` with `@variant dark (&:where(.dark, .dark *))` so that `dark:` utilities respond to the `.dark` class on `<html>` rather than the OS media query. `index.html` contains an inline script that sets this class synchronously before React renders (prevents flash). Default is dark. The toggle in the navbar persists the choice to `localStorage`.

### PWA / mobile (this is the `recipe-app-mobile` build)

This copy of the app is a **PWA** so it can be installed and run offline on mobile/tablet. All data still lives only in the device's IndexedDB — no backend, no cross-device sync except via file export/import.

- **Manifest** `public/manifest.webmanifest` + **icon** `public/icon.svg` (fried-egg glyph, emerald, declared `any maskable`). Linked from `index.html` along with `theme-color`, `apple-mobile-web-app-*` tags and `viewport-fit=cover`.
- **Service worker** `public/sw.js` — app-shell cache. Navigations: network-first → fall back to cached `/index.html` offline. Static assets: stale-while-revalidate. Cross-origin requests (Open Food Facts) are **not** intercepted. Registered in `src/main.tsx` only under `import.meta.env.PROD` (never in dev, to avoid clobbering Vite HMR / the proxy).
- **Responsive layout**: `src/App.tsx` has a `BottomNav` (fixed bottom tab bar, `md:hidden`) for Opskrifter/Madplan/Ny; the desktop top-nav links are `hidden md:flex`. Root wrapper has `pb-16 md:pb-0` so content clears the bar. `MealPlan` renders the 7-column grid only on `md+` (`hidden md:block`) and a vertical day-by-day list on mobile (`md:hidden`); the slot card is extracted into a shared `slotCard()` helper used by both. `RecipeDetail` nutrition stat grids are `grid-cols-2 sm:grid-cols-4` and the per-ingredient table sits in an `overflow-x-auto` wrapper. `RecipeForm` ingredient rows use responsive arbitrary grid-cols (`grid-cols-[22px_60px_60px_1fr_32px] sm:grid-cols-[28px_80px_80px_1fr_36px]`) and the dnd-kit `PointerSensor` has `activationConstraint: { distance: 8 }` so touch scroll/tap doesn't trigger drags. Form/detail cards are `p-4 sm:p-6`.

### CORS proxy for URL import (dev only) + production behavior

`vite.config.ts` registers a custom Vite middleware (`localProxyPlugin`) at `/api/proxy?url=...` that fetches external URLs server-side from Node.js, bypassing browser CORS. This proxy is **only available in dev** (`npm run dev`). Error and timeout handlers guard `res.headersSent` before writing to avoid `ERR_HTTP_HEADERS_SENT` crashes.

In a **production build** (the hosted PWA, on any device) the proxy does not exist, so the two features that used it behave differently:
- **Nutrition (Open Food Facts):** `nutritionService.ts` defines `offUrl = (u) => import.meta.env.DEV ? LOCAL_PROXY(u) : u`. OFF sends `Access-Control-Allow-Origin: *`, so in prod the API is called **directly** from the browser. Nutrition works fully on mobile (LOCAL_DB + cache already work offline).
- **URL import:** `recipeImporter.ts` exports `urlImportAvailable = import.meta.env.DEV`. When false, the `UrlImporter` component renders a short note ("virker kun i desktop-versionen … overfør via ⚙ Indstillinger → Eksporter/Importér") instead of the input. So URL import stays a PC/dev convenience; cross-device transfer is file-based.

### Recipe import pipeline (`src/lib/recipeImporter.ts`)

Tries four parsers in order, falling back to the next on failure:
1. **JSON-LD** — `<script type="application/ld+json">` with `@type: Recipe`
2. **Microdata** — `itemprop="recipeIngredient"` / `itemprop="recipeInstructions"`. Uses `extractElementContent()` (tag-depth counter) to handle multi-paragraph `<div>` content.
3. **Heuristic heading parser** (`parseByHeadings`) — scans h1–h4 for Danish/English keywords ("Ingredienser", "Fremgangsmåde", "ingredients", "directions", etc.), extracts the `<li>` list beneath each heading. Handles blog-style recipe sites with no structured data (e.g. myprotein.dk).
4. **OG/meta tags** — title + description only (always succeeds if a title exists).

`parseIngredients()` validates the candidate unit word against `KNOWN_UNITS` (a Set of all supported unit strings). If the word is not a known unit, it is kept as part of the ingredient name instead — prevents words like "rød" from landing in the unit field.

Images are fetched via the proxy and stored as base64 data URLs in IndexedDB so they work offline.

### Nutrition calculation (`src/lib/nutritionService.ts`)

`calculateRecipeNutrition(recipe)` → `RecipeNutrition`. Three-tier lookup per ingredient:
1. **Local database** (`LOCAL_DB` array in the file) — ~120 common Danish/international ingredients with values per 100g. This is the primary source — instant, no network.
2. **IndexedDB cache** — previous Open Food Facts results, valid for 30 days.
3. **Open Food Facts API** via local proxy — fallback for unknown ingredients.

**Matching logic** in `lookupLocal`: scores by `key.length * 100` when the key appears *inside* the normalised input (strong match), or `key.length` when the input appears inside the key (weak fallback). Returns `entry.keys[0]` as the canonical match label. Always prefers the longest (most specific) match. `peberfrugt` does NOT have `paprika` as a key — that key lives only in the spice entry to prevent confusion with paprika powder.

**Piece weights** in `PIECE_WEIGHTS`: stk-unit lookup finds the longest matching key (not first) to prevent e.g. `tomat` (120g) winning over `cherrytomat` (15g). Notable weights: kyllingebryst/filet 165g, cherrytomat 15g, forårsløg 25g, tortilla/wrap 50g, burgerboller 75g, æg 60g, løg 100g, tomat 120g.

**Unit conversion** in `toGrams(amount, unit, name)`: strips trailing periods, handles embedded units (e.g. `"500g"`), fractions (`½`, `1/2`, mixed `1 ½`), and maps aliases — `g/gr/gram/gm`, `kg/kilo`, `dl/deciliter`, `ml`, `l/liter`, `cl`, `tsk/tsp/teaspoon`, `spsk/tbsp/tablespoon`, `ds/dåse/can` (400g), `pk/pakke/pack` (400g), `stk/stykker/enhed` (piece weights), `håndfuld/handful` (30g), `kop/cup` (240g), `bundt/bunch` (30g), `knivspids/pinch` (1g), `skive/slice` (20g). Amounts like `lidt`, `efter smag` return 0g and are skipped.

**Invalidation**: `RecipeForm.handleSubmit` always sets `nutrition: undefined`, so editing a recipe forces recalculation. Tags can be edited inline on RecipeDetail without clearing nutrition (see below).

### Search & filtering (`src/hooks/useSearch.ts`)

Applies filters in order: tags (AND), ingredients (AND, substring), maxTime, minRating, mealTypes — then runs Fuse.js fuzzy search on the remaining set.

`FilterState` in `src/components/FilterPanel.tsx`:
```ts
{ tags: string[], ingredients: string[], maxTime: number | null, minRating: number | null, mealTypes: string[] }
```

**Meal type filters** (`MEAL_TYPES` exported from `FilterPanel.tsx`) — 9 types:
- Per-serving nutrition: `proteinrig` (≥25g protein), `let` (≤400 kcal), `fedtrig` (≥25g fat), `fedtfattig` (≤12g fat), `lavkulhydrat` (≤20g carbs), `kulhydratrig` (≥60g carbs)
- Fullness Factor: `maettende` — FF ≥ 2.5, where `FF = 41.7 / kcal^0.7 + 0.05 × protein − 0.00000725 × fat³ + 0.617` (all values per 100g from `nutrition.per100g`)
- Tag-based: `vegetar` (tags include "vegetar"/"vegansk")
- Time-based: `hurtig` (total ≤30 min)

Nutrition-based filters only match recipes that have `recipe.nutrition` calculated.

`getRecipeMealTypes(recipe)` is also exported from `FilterPanel.tsx` — returns the applicable `MealType[]` for a recipe. Used by `RecipeDetail` (coloured pills with label tooltip) and `RecipeCard` (emoji row, grouped with the metadata bar at the bottom of the card).

**Time filter** uses a slider (`src/components/ui/slider.tsx`, built on `@radix-ui/react-slider`). Dragging to max (180 min) sets `maxTime: null` (no limit).

### Drag-and-drop ingredients (`src/components/RecipeForm.tsx`)

Uses `@dnd-kit/core` + `@dnd-kit/sortable`. Ingredients in state carry a `_id` string for dnd-kit keys; this field is stripped in `handleSubmit` before passing to the database. Header rows (isHeader=true) with an empty name act as visual spacers.

### Serving scaler (`src/pages/RecipeDetail.tsx`)

`localServings` state (null = use recipe's own servings). A +/− control in the metadata bar changes it. `scaleFactor = localServings / recipe.servings` is applied to:
- Ingredient amounts (displayed via `scaleAmount()`, which parses strings, scales, and re-formats with ½ support)
- Nutrition "Hele retten" section (scaled inline)

`localServings` is never saved — navigating away resets to the recipe's stored value.

### Inline tag editor (`src/pages/RecipeDetail.tsx`)

`TagEditor` component renders tags as removable pills + a bare text input. Enter or `,` adds a tag; Backspace on empty input removes the last tag; blur saves a partial entry. Tags are saved directly via `saveRecipe` without touching `recipe.nutrition`, so nutrition data is preserved.

### Key UI decisions
- Navbar is `sticky top-0 z-20`; search bar on Home is `sticky top-14 z-10` (sits directly below navbar).
- Navbar right side: Ny opskrift button → theme toggle → settings (⚙) dropdown (export/import).
- FilterPanel dropdown must **not** have `overflow-hidden` on any ancestor — it was causing clipping.
- Ingredient display in `RecipeDetail` uses individual rounded cards per ingredient; named headers show as a label + horizontal rule; empty headers render as a plain grey dividing line.
- `NutritionPanel` in `RecipeDetail` shows three sections: **Hele retten** (scales with +/− portioner), **Pr. portion** (always based on stored servings count), **Pr. 100 g** (unscaled). Has a collapsible per-ingredient breakdown table with columns: Ingrediens, g, kcal, prot, kulh, fedt, match. Rows with no match are red; rows with a match but 0g are greyed out.
- Old `RecipeNutrition` objects missing `per100g` (from a previous schema) are detected on load and silently cleared so the page doesn't crash.
- Meal type emojis on `RecipeCard` are grouped with the metadata bar inside a shared `mt-auto` wrapper so they always sit at the card bottom regardless of description length.
