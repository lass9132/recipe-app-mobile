import type { Recipe, NutritionFacts, RecipeNutrition } from '@/types/recipe'
import { db } from '@/db/database'

const LOCAL_PROXY = (url: string) => `/api/proxy?url=${encodeURIComponent(url)}`
// I dev går kald gennem den lokale Node-proxy (omgår CORS). I produktion (PWA på mobil/tablet)
// findes proxyen ikke — Open Food Facts tillader CORS, så vi kalder API'et direkte fra browseren.
const offUrl = (url: string) => (import.meta.env.DEV ? LOCAL_PROXY(url) : url)
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 dage

// ---------------------------------------------------------------------------
// Lokal næringsdatabase — per 100g, bruges som primær kilde
// Nøgler er danske søgeord (eller engelske for internationale ingredienser).
// Matchning sker ved at tjekke om nøglen findes i det normaliserede ingrediensnavn.
// ---------------------------------------------------------------------------
const LOCAL_DB: Array<{ keys: string[]; facts: NutritionFacts }> = [
  // --- Kød ---
  { keys: ['kylling', 'chicken'], facts: { kcal: 115, protein: 23, carbs: 0, fat: 2.5 } },
  { keys: ['oksekød', 'oksemørbrad', 'oksefarsen', 'hakkede oksekød', 'beef', 'bøf'], facts: { kcal: 215, protein: 18, carbs: 0, fat: 16 } },
  { keys: ['svinemørbrad', 'mørbrad'], facts: { kcal: 115, protein: 22.3, carbs: 0, fat: 1.9 } },
  { keys: ['minutkotelet', 'svinekotelet', 'kotelet'], facts: { kcal: 110, protein: 22.5, carbs: 0, fat: 2 } },
  { keys: ['hakket svinekød', 'svinefars', 'hakket grisekød', 'grisefars'], facts: { kcal: 166, protein: 19, carbs: 0, fat: 10 } },
  { keys: ['flæskesteg', 'flæsk'], facts: { kcal: 268, protein: 18.3, carbs: 0.1, fat: 21.7 } },
  { keys: ['svinekød', 'svine', 'pork'], facts: { kcal: 160, protein: 21, carbs: 0, fat: 8 } },
  { keys: ['skinke', 'skinkekød', 'kogeskinke'], facts: { kcal: 115, protein: 18, carbs: 1, fat: 4 } },
  { keys: ['bacon'], facts: { kcal: 260, protein: 15, carbs: 0, fat: 23 } },
  { keys: ['laks', 'salmon'], facts: { kcal: 208, protein: 20, carbs: 0, fat: 13 } },
  { keys: ['torsk', 'cod'], facts: { kcal: 82, protein: 18, carbs: 0, fat: 0.7 } },
  { keys: ['rejer', 'shrimp'], facts: { kcal: 85, protein: 18, carbs: 0.9, fat: 1 } },
  { keys: ['tun', 'tuna'], facts: { kcal: 130, protein: 29, carbs: 0, fat: 1 } },
  { keys: ['mørbraden', 'mørbrad'], facts: { kcal: 140, protein: 22, carbs: 0, fat: 5 } },

  // --- Mejeri & æg ---
  { keys: ['piskefløde', 'piske fløde', '38% fløde', '38%'], facts: { kcal: 302, protein: 2.3, carbs: 2.8, fat: 32, fiber: 0 } },
  { keys: ['madlavningsfløde', 'madfløde', '18% fløde', '18%'], facts: { kcal: 170, protein: 2.6, carbs: 3.7, fat: 18 } },
  { keys: ['8% fløde', '8%'], facts: { kcal: 87, protein: 2.8, carbs: 4.4, fat: 8 } },
  { keys: ['fløde'], facts: { kcal: 240, protein: 2.5, carbs: 3, fat: 25 } },
  { keys: ['cremefraiche', 'creme fraiche'], facts: { kcal: 215, protein: 2.5, carbs: 3.5, fat: 22 } },
  { keys: ['mælk'], facts: { kcal: 47, protein: 3.4, carbs: 4.8, fat: 1.5 } },
  { keys: ['smør', 'butter'], facts: { kcal: 717, protein: 0.9, carbs: 0.1, fat: 81 } },
  { keys: ['mozzarella'], facts: { kcal: 280, protein: 18, carbs: 2.2, fat: 22 } },
  { keys: ['parmesan'], facts: { kcal: 392, protein: 36, carbs: 3.2, fat: 26 } },
  { keys: ['cheddar'], facts: { kcal: 402, protein: 25, carbs: 1.3, fat: 33 } },
  { keys: ['fetaost', 'feta'], facts: { kcal: 264, protein: 14, carbs: 4, fat: 21 } },
  { keys: ['flødeost', 'philadelphia', 'cream cheese'], facts: { kcal: 250, protein: 6, carbs: 4, fat: 24 } },
  { keys: ['ost', 'cheese'], facts: { kcal: 360, protein: 24, carbs: 1.5, fat: 29 } },
  { keys: ['æg', 'egg'], facts: { kcal: 147, protein: 13, carbs: 1.1, fat: 10 } },
  { keys: ['yoghurt'], facts: { kcal: 61, protein: 3.5, carbs: 4.7, fat: 3.3 } },
  { keys: ['skyr'], facts: { kcal: 63, protein: 10.5, carbs: 4, fat: 0.2 } },

  // --- Grøntsager ---
  { keys: ['forårsløg', 'forårsløgsstilk', 'spring onion', 'green onion', 'scallion'], facts: { kcal: 32, protein: 1.8, carbs: 7.3, fat: 0.2, fiber: 2.6 } },
  { keys: ['løg', 'onion'], facts: { kcal: 40, protein: 1.1, carbs: 9.3, fat: 0.1, fiber: 1.7 } },
  { keys: ['hvidløg', 'garlic'], facts: { kcal: 149, protein: 6.4, carbs: 33, fat: 0.5 } },
  { keys: ['hakkede tomater', 'dåsetomater'], facts: { kcal: 24, protein: 1.2, carbs: 4.5, fat: 0.2, fiber: 1.5 } },
  { keys: ['tomatpure', 'tomatpuré', 'tomatpasta', 'tomat pure', 'tomato paste', 'koncentreret tomat'], facts: { kcal: 82, protein: 3.5, carbs: 15, fat: 0.5 } },
  { keys: ['tomat', 'tomato'], facts: { kcal: 18, protein: 0.9, carbs: 3.9, fat: 0.2, fiber: 1.2 } },
  { keys: ['spinat', 'spinach'], facts: { kcal: 23, protein: 2.9, carbs: 3.6, fat: 0.4, fiber: 2.2 } },
  { keys: ['gulerod', 'gulerødder', 'carrot'], facts: { kcal: 41, protein: 0.9, carbs: 10, fat: 0.2, fiber: 2.8 } },
  { keys: ['kartoffel', 'kartofler', 'potato'], facts: { kcal: 77, protein: 2, carbs: 17, fat: 0.1, fiber: 2.2 } },
  { keys: ['broccoli'], facts: { kcal: 34, protein: 2.8, carbs: 7, fat: 0.4, fiber: 2.6 } },
  { keys: ['blomkål', 'cauliflower'], facts: { kcal: 25, protein: 1.9, carbs: 5, fat: 0.3, fiber: 2 } },
  { keys: ['champignon', 'svamp', 'mushroom'], facts: { kcal: 22, protein: 3.1, carbs: 3.3, fat: 0.3, fiber: 1 } },
  { keys: ['peberfrugt', 'bell pepper'], facts: { kcal: 31, protein: 1, carbs: 6, fat: 0.3, fiber: 2.1 } },
  { keys: ['spidskål', 'spids kål', 'pointed cabbage'], facts: { kcal: 25, protein: 1.5, carbs: 4.5, fat: 0.1, fiber: 2.5 } },
  { keys: ['rødkål', 'rød kål', 'red cabbage'], facts: { kcal: 31, protein: 1.4, carbs: 6.9, fat: 0.2, fiber: 2.1 } },
  { keys: ['grønkål', 'grøn kål', 'kale'], facts: { kcal: 49, protein: 4.3, carbs: 8.8, fat: 0.9, fiber: 3.6 } },
  { keys: ['hvidkål', 'kål', 'cabbage'], facts: { kcal: 25, protein: 1.3, carbs: 5.8, fat: 0.1, fiber: 2.5 } },
  { keys: ['salat', 'romaine', 'iceberg', 'rucola', 'rukola', 'spinatsalat', 'feldsalat', 'lettuce'], facts: { kcal: 15, protein: 1.4, carbs: 2.2, fat: 0.2, fiber: 1.8 } },
  { keys: ['agurk', 'cucumber'], facts: { kcal: 15, protein: 0.7, carbs: 3.6, fat: 0.1, fiber: 0.5 } },
  { keys: ['zucchini', 'courgette'], facts: { kcal: 17, protein: 1.2, carbs: 3.1, fat: 0.3, fiber: 1 } },
  { keys: ['squash'], facts: { kcal: 17, protein: 1.2, carbs: 3.1, fat: 0.3, fiber: 1 } },
  { keys: ['majs', 'corn'], facts: { kcal: 86, protein: 3.3, carbs: 19, fat: 1.4, fiber: 2.7 } },
  { keys: ['sukkerærter', 'sugar snap', 'snap peas', 'mangetout'], facts: { kcal: 42, protein: 2.8, carbs: 7.6, fat: 0.2, fiber: 2.6 } },
  { keys: ['ærter', 'peas'], facts: { kcal: 81, protein: 5.4, carbs: 14, fat: 0.4, fiber: 5.5 } },
  { keys: ['edamamebønner', 'edamame'], facts: { kcal: 121, protein: 11, carbs: 9, fat: 5, fiber: 5 } },
  { keys: ['bønner', 'beans'], facts: { kcal: 127, protein: 8.7, carbs: 22, fat: 0.5, fiber: 6.4 } },
  { keys: ['linser', 'lentils'], facts: { kcal: 116, protein: 9, carbs: 20, fat: 0.4, fiber: 7.9 } },
  { keys: ['kikærter', 'chickpeas'], facts: { kcal: 164, protein: 8.9, carbs: 27, fat: 2.6, fiber: 7.6 } },

  // --- Korn & pasta ---
  { keys: ['lasagneplader', 'lasagne'], facts: { kcal: 350, protein: 12, carbs: 70, fat: 1.5, fiber: 3 } },
  { keys: ['spaghetti', 'pasta', 'penne', 'fusilli', 'farfalle'], facts: { kcal: 350, protein: 12, carbs: 70, fat: 1.5, fiber: 3 } },
  { keys: ['ris', 'rice'], facts: { kcal: 362, protein: 7, carbs: 80, fat: 0.7, fiber: 1.3 } },
  { keys: ['mel', 'flour'], facts: { kcal: 340, protein: 10, carbs: 72, fat: 1.3, fiber: 3 } },
  { keys: ['havregryn', 'oats'], facts: { kcal: 367, protein: 12, carbs: 64, fat: 6.5, fiber: 9.4 } },
  { keys: ['couscous'], facts: { kcal: 356, protein: 12, carbs: 73, fat: 0.6, fiber: 2.4 } },
  { keys: ['quinoa'], facts: { kcal: 368, protein: 14, carbs: 64, fat: 6, fiber: 7 } },
  { keys: ['tortillapandekager', 'tortilla', 'wraps', 'wrap'], facts: { kcal: 250, protein: 7, carbs: 44, fat: 5, fiber: 2 } },
  { keys: ['pankorasp', 'panko', 'rasp', 'breadcrumbs', 'rasp'], facts: { kcal: 370, protein: 11, carbs: 76, fat: 2, fiber: 3 } },
  { keys: ['burgerboller', 'burgerbolla', 'hamburgerboller', 'boller'], facts: { kcal: 270, protein: 8, carbs: 48, fat: 4.5, fiber: 2 } },
  { keys: ['brød', 'bread'], facts: { kcal: 265, protein: 8, carbs: 49, fat: 3.2, fiber: 2.7 } },
  { keys: ['rugbrød', 'rye bread'], facts: { kcal: 240, protein: 7, carbs: 44, fat: 1.7, fiber: 7 } },

  // --- Fedtstoffer & olier ---
  { keys: ['oliven', 'olives', 'sorte oliven', 'grønne oliven'], facts: { kcal: 145, protein: 1, carbs: 4, fat: 15 } },
  { keys: ['olivenolie', 'olive oil', 'olie', 'oil'], facts: { kcal: 884, protein: 0, carbs: 0, fat: 100 } },
  { keys: ['rapsolie', 'canola oil'], facts: { kcal: 884, protein: 0, carbs: 0, fat: 100 } },
  { keys: ['solsikkeolie', 'vindruekerneolie'], facts: { kcal: 884, protein: 0, carbs: 0, fat: 100 } },
  { keys: ['kokosolie', 'coconut oil'], facts: { kcal: 862, protein: 0, carbs: 0, fat: 100 } },

  // --- Sukker & søde varer ---
  { keys: ['brun farin', 'brunfarin', 'brown sugar', 'farin'], facts: { kcal: 377, protein: 0, carbs: 97, fat: 0 } },
  { keys: ['sukker', 'sugar'], facts: { kcal: 387, protein: 0, carbs: 100, fat: 0 } },
  { keys: ['honning', 'honey'], facts: { kcal: 304, protein: 0.3, carbs: 82, fat: 0 } },
  { keys: ['sirup'], facts: { kcal: 282, protein: 0, carbs: 70, fat: 0 } },
  { keys: ['chokolade', 'chocolate'], facts: { kcal: 546, protein: 5, carbs: 60, fat: 31 } },

  // --- Krydderier (pr. 100g men bruges i gram-mængder) ---
  { keys: ['salt'], facts: { kcal: 0, protein: 0, carbs: 0, fat: 0 } },
  { keys: ['peber', 'pepper'], facts: { kcal: 251, protein: 10, carbs: 64, fat: 3.3 } },
  { keys: ['karry', 'curry'], facts: { kcal: 325, protein: 14, carbs: 55, fat: 14, fiber: 33 } },
  { keys: ['oregano'], facts: { kcal: 265, protein: 9, carbs: 68, fat: 4.3, fiber: 42 } },
  { keys: ['basilikum', 'basil'], facts: { kcal: 22, protein: 3.2, carbs: 2.7, fat: 0.6 } },
  { keys: ['timian', 'thyme'], facts: { kcal: 276, protein: 9, carbs: 64, fat: 7.4 } },
  { keys: ['rosmarin', 'rosemary'], facts: { kcal: 131, protein: 3.3, carbs: 21, fat: 5.9 } },
  { keys: ['persille', 'parsley'], facts: { kcal: 36, protein: 3, carbs: 6.3, fat: 0.8 } },
  { keys: ['kanel', 'cinnamon'], facts: { kcal: 247, protein: 4, carbs: 81, fat: 1.2 } },
  { keys: ['ingefær', 'ginger'], facts: { kcal: 80, protein: 1.8, carbs: 18, fat: 0.8 } },
  { keys: ['spidskommen', 'cumin'], facts: { kcal: 375, protein: 18, carbs: 44, fat: 22 } },
  { keys: ['koriander', 'coriander'], facts: { kcal: 298, protein: 12, carbs: 55, fat: 17 } },
  { keys: ['chili'], facts: { kcal: 282, protein: 13, carbs: 57, fat: 14 } },
  { keys: ['gurkemeje', 'turmeric'], facts: { kcal: 354, protein: 8, carbs: 65, fat: 10 } },
  { keys: ['røget paprika', 'paprika pulver', 'paprika'], facts: { kcal: 282, protein: 14, carbs: 54, fat: 13 } },
  { keys: ['teriyakisauce', 'teriyaki sauce', 'teriyaki'], facts: { kcal: 89, protein: 5, carbs: 16, fat: 0.5 } },
  { keys: ['hoisin'], facts: { kcal: 220, protein: 3.6, carbs: 45, fat: 2.7 } },
  { keys: ['fishsauce', 'fish sauce', 'fiskesauce'], facts: { kcal: 35, protein: 5, carbs: 3.5, fat: 0 } },
  { keys: ['sojasauce', 'soya sauce', 'soy sauce', 'soja', 'soya'], facts: { kcal: 60, protein: 8, carbs: 8, fat: 0 } },
  { keys: ['worcestershire'], facts: { kcal: 78, protein: 1.4, carbs: 19, fat: 0.1 } },
  { keys: ['tabasco', 'hot sauce'], facts: { kcal: 12, protein: 0.7, carbs: 2.2, fat: 0.2 } },
  { keys: ['dijonsennep', 'sennep', 'mustard'], facts: { kcal: 66, protein: 3.7, carbs: 8, fat: 3.3 } },
  { keys: ['balsamico', 'balsamicoeddike', 'balsamic', 'balsamic vinegar'], facts: { kcal: 88, protein: 0.5, carbs: 17, fat: 0 } },
  { keys: ['riseddike', 'rice vinegar', 'risen eddike'], facts: { kcal: 18, protein: 0, carbs: 0.6, fat: 0 } },
  { keys: ['hvidvinseddike', 'rødvinseddike', 'æbleeddike', 'eddike', 'vinegar'], facts: { kcal: 18, protein: 0, carbs: 0.9, fat: 0 } },
  { keys: ['citronsaft', 'lemon juice'], facts: { kcal: 22, protein: 0.4, carbs: 6.9, fat: 0.2 } },
  // Spice mixes (approx)
  { keys: ['fajita', 'taco', 'spice mix', 'krydderiblanding'], facts: { kcal: 280, protein: 10, carbs: 50, fat: 8 } },

  // --- Frugt ---
  { keys: ['æble', 'apple'], facts: { kcal: 52, protein: 0.3, carbs: 14, fat: 0.2, fiber: 2.4 } },
  { keys: ['banan', 'banana'], facts: { kcal: 89, protein: 1.1, carbs: 23, fat: 0.3, fiber: 2.6 } },
  { keys: ['lime'], facts: { kcal: 30, protein: 0.7, carbs: 10.5, fat: 0.2, fiber: 2.8 } },
  { keys: ['citron', 'lemon'], facts: { kcal: 29, protein: 1.1, carbs: 9.3, fat: 0.3, fiber: 2.8 } },
  { keys: ['appelsin', 'orange'], facts: { kcal: 47, protein: 0.9, carbs: 12, fat: 0.1, fiber: 2.4 } },
  { keys: ['jordbær', 'strawberry'], facts: { kcal: 32, protein: 0.7, carbs: 7.7, fat: 0.3, fiber: 2 } },
  { keys: ['mango'], facts: { kcal: 60, protein: 0.8, carbs: 15, fat: 0.4, fiber: 1.6 } },
  { keys: ['ananas', 'pineapple'], facts: { kcal: 50, protein: 0.5, carbs: 13, fat: 0.1, fiber: 1.4 } },
  { keys: ['avocado'], facts: { kcal: 160, protein: 2, carbs: 9, fat: 15, fiber: 7 } },

  // --- Nødder & frø ---
  { keys: ['mandler', 'almonds'], facts: { kcal: 579, protein: 21, carbs: 22, fat: 50, fiber: 12.5 } },
  { keys: ['valnødder', 'walnuts'], facts: { kcal: 654, protein: 15, carbs: 14, fat: 65, fiber: 6.7 } },
  { keys: ['cashew'], facts: { kcal: 553, protein: 18, carbs: 30, fat: 44, fiber: 3.3 } },
  { keys: ['sesamfrø', 'sesam'], facts: { kcal: 573, protein: 17, carbs: 23, fat: 50, fiber: 11.8 } },
  { keys: ['solsikkefrø'], facts: { kcal: 584, protein: 21, carbs: 20, fat: 51, fiber: 8.6 } },

  // --- Dressinger & sauce ---
  { keys: ['mayonnaise', 'mayo'], facts: { kcal: 680, protein: 1, carbs: 2, fat: 75 } },
  { keys: ['ketchup'], facts: { kcal: 101, protein: 1.7, carbs: 25, fat: 0.1 } },
  { keys: ['bearnaise'], facts: { kcal: 354, protein: 1.3, carbs: 2.7, fat: 38 } },
  { keys: ['pesto'], facts: { kcal: 490, protein: 6, carbs: 3, fat: 50 } },

  // --- Vand & bouillon ---
  { keys: ['vand', 'water'], facts: { kcal: 0, protein: 0, carbs: 0, fat: 0 } },
  { keys: ['bouillon', 'fond', 'broth', 'stock'], facts: { kcal: 5, protein: 0.5, carbs: 0.8, fat: 0.1 } },
  { keys: ['kokosmælk', 'coconut milk'], facts: { kcal: 197, protein: 2, carbs: 6, fat: 21 } },

  // --- Alkohol ---
  { keys: ['rødvin', 'hvidvin', 'vin', 'wine'], facts: { kcal: 85, protein: 0.1, carbs: 2.6, fat: 0 } },
  { keys: ['øl', 'beer'], facts: { kcal: 43, protein: 0.5, carbs: 3.6, fat: 0 } },
]

// Normaliser og fjern støjord fra et ingrediensnavn
function normalizeIngredientName(name: string): string {
  return name
    .toLowerCase()
    .replace(/,.*$/, '')           // fjern alt efter komma: "Oregano, tørret" → "oregano"
    .replace(/\d+\s*g\b/gi, '')   // fjern vægtangivelser: "400g" → ""
    .replace(/\b(uden|med|efter|til|ca|ca\.|tørret|frisk|frost|frosset|helbladet|revet|skåret|finthakket|grofthakket|skrællet|pillet|smag|behov|let|usaltede|usaltet|vægt)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Slå op i den lokale database — returnerer facts + matchet nøgle
function lookupLocal(name: string): { facts: NutritionFacts; key: string } | null {
  const normalized = normalizeIngredientName(name)
  let bestScore = 0
  let best: { facts: NutritionFacts; key: string } | null = null

  for (const entry of LOCAL_DB) {
    for (const key of entry.keys) {
      let score = 0
      if (normalized.includes(key)) {
        // Nøglen optræder i det brugeren skrev — stærkt match
        // Længere nøgle = mere specifikt (fx "piskefløde" > "fløde")
        score = key.length * 100
      } else if (key.includes(normalized)) {
        // Det brugeren skrev optræder i nøglen — svagt match (fx "kylling" i "kyllingefilet")
        score = key.length
      }
      if (score > bestScore) {
        bestScore = score
        best = { facts: entry.facts, key: entry.keys[0] }
      }
    }
  }
  return best
}

// --- Enhedskonvertering til gram ---

// Standardvægte for "stk"-lignende enheder
const PIECE_WEIGHTS: Record<string, number> = {
  // Æg & mejeri
  kyllingebryst: 165, kyllingefilet: 165, kylling: 165, chicken: 165,
  æg: 60, egg: 60,
  // Grøntsager
  løg: 100, onion: 100,
  tomat: 120, tomato: 120,
  cherrytomat: 15, cherrytomater: 15, cherry: 15,
  forårsløg: 25, forårsløgsstilk: 25,
  gulerod: 80, gulerødder: 80, carrot: 80,
  hvidløg: 5, hvidløgsfed: 5, garlic: 5,
  kartoffel: 150, kartofler: 150, potato: 150,
  peberfrugt: 150, pepper: 150,
  champignon: 20, svamp: 20,
  // Frugt
  avocado: 200,
  banan: 120, banana: 120,
  citron: 100, lemon: 100,
  lime: 60,
  æble: 150, apple: 150,
  appelsin: 180, orange: 180,
  // Pasta & korn
  lasagneplader: 20, lasagne: 20,  // tør plade ~20g
  tortillapandekager: 50, tortilla: 50, wrap: 50, wraps: 50,  // ~50g pr. stk
  // Pakker & dåser (typiske størrelser)
  pakke: 400,
  dåse: 400,
  burgerboller: 75, burgerbolla: 75, hamburgerboller: 75, bolle: 75,
}

const SKIP_AMOUNTS = ['lidt', 'smag', 'efter smag', 'til smag', 'efter behov', 'noget', 'evt', 'evt.']

function toGrams(amount: string, unit: string, name: string): number {
  // Beløb der ikke kan konverteres meningsfuldt → spring over
  if (SKIP_AMOUNTS.includes(amount.toLowerCase().trim())) return 0

  // Normaliser input
  let rawAmount = amount.replace(',', '.').trim()
  let u = unit.toLowerCase().trim()
  const n = name.toLowerCase().trim()

  // Håndter tilfælde hvor enheden sidder i amount-feltet (fx "500g", "1.5dl")
  if (!u || u === '') {
    const embedded = rawAmount.match(/^([\d.\/]+)\s*(kg|g|gr|gram|gm|dl|l|liter|ml|cl|spsk|tbsp|tsk|tsp|stk|ds|pk)\.?$/i)
    if (embedded) {
      rawAmount = embedded[1]
      u = embedded[2].toLowerCase()
    }
  }

  // Håndter brøker: "½" "¼" "¾" "1/2" osv.
  rawAmount = rawAmount
    .replace('½', '0.5').replace('¼', '0.25').replace('¾', '0.75')
    .replace('⅓', '0.333').replace('⅔', '0.667')
  const fractionMatch = rawAmount.match(/^(\d+)\/(\d+)$/)
  if (fractionMatch) rawAmount = String(parseInt(fractionMatch[1]) / parseInt(fractionMatch[2]))
  // "1 ½" → 1.5
  const mixedMatch = rawAmount.match(/^(\d+)\s+([\d.]+)$/)
  if (mixedMatch) rawAmount = String(parseFloat(mixedMatch[1]) + parseFloat(mixedMatch[2]))

  const num = parseFloat(rawAmount)
  if (isNaN(num) || num <= 0) return 0

  // Fjern afsluttende punktum og normaliser (fx "tsk." → "tsk", "G" → "g")
  u = u.replace(/\.$/, '').toLowerCase().trim()

  // Styk-enheder → brug stykkvægt-tabel (længste nøgle vinder for at undgå "tomat" > "cherrytomat")
  const STK_UNITS = ['stk', 'stykker', 'stykke', 'enhed', 'enheder', 'fed', 'stk', 'piece', 'pieces', 'pcs']
  if (!u || STK_UNITS.includes(u)) {
    let bestKey = ''
    let bestWeight = 0
    for (const [key, weight] of Object.entries(PIECE_WEIGHTS)) {
      if (n.includes(key) && key.length > bestKey.length) {
        bestKey = key
        bestWeight = weight
      }
    }
    if (bestKey) return num * bestWeight
    return num * 100 // bedste gæt: 100g pr. stk
  }

  // Gram
  if (['g', 'gr', 'gram', 'grams', 'gm', 'grm'].includes(u)) return num
  // Kilogram
  if (['kg', 'kilo', 'kilogram', 'kilograms'].includes(u)) return num * 1000
  // Milliliter
  if (['ml', 'milliliter', 'milliliters', 'millilitre'].includes(u)) return num
  // Centiliter
  if (['cl', 'centiliter', 'centiliters', 'centilitre'].includes(u)) return num * 10
  // Deciliter
  if (['dl', 'deciliter', 'deciliters', 'decilitre'].includes(u)) return num * 100
  // Liter
  if (['l', 'liter', 'liters', 'litre', 'litres'].includes(u)) return num * 1000
  // Teskefuld (~5 ml)
  if (['tsk', 'teske', 'teskefuld', 'teskeskefuld', 'tsp', 'teaspoon', 'teaspoons'].includes(u)) return num * 5
  // Spiseskefuld (~15 ml)
  if (['spsk', 'spiseske', 'spiseskefuld', 'tbsp', 'tbs', 'tablespoon', 'tablespoons'].includes(u)) return num * 15
  // Knivspids (~1 g)
  if (['knsp', 'knivspids', 'knivspidser', 'nip', 'pinch'].includes(u)) return num * 1
  // Kop (~240 ml)
  if (['kop', 'kopper', 'cup', 'cups'].includes(u)) return num * 240
  // Dåse (~400 g)
  if (['ds', 'dåse', 'dåser', 'can', 'cans', 'tin', 'tins'].includes(u)) return num * 400
  // Pakke (~400 g)
  if (['pk', 'pakke', 'pakker', 'pack', 'package', 'packages', 'bag', 'pose'].includes(u)) return num * 400
  // Bundt (~30 g)
  if (['bundt', 'bundter', 'bunch', 'bunches'].includes(u)) return num * 30
  // Håndfuld (~30 g)
  if (['håndfuld', 'handful', 'handfuls', 'hf'].includes(u)) return num * 30
  // Skive (~20 g)
  if (['skive', 'skiver', 'slice', 'slices'].includes(u)) return num * 20

  return 0
}

// --- Open Food Facts opslag ---

interface OFFProduct {
  nutriments?: {
    'energy-kcal_100g'?: number
    'proteins_100g'?: number
    'carbohydrates_100g'?: number
    'fat_100g'?: number
    'fiber_100g'?: number
  }
}

interface OFFResponse {
  products?: OFFProduct[]
  count?: number
}

async function fetchFromOpenFoodFacts(name: string): Promise<NutritionFacts | null> {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(name)}&action=process&json=true&page_size=5&fields=product_name,nutriments&lc=da`
  try {
    const res = await fetch(offUrl(url), { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    const data: OFFResponse = await res.json()
    const products = data.products ?? []

    for (const product of products) {
      const n = product.nutriments
      if (!n) continue
      const kcal = n['energy-kcal_100g'] ?? 0
      const protein = n['proteins_100g'] ?? 0
      const carbs = n['carbohydrates_100g'] ?? 0
      const fat = n['fat_100g'] ?? 0
      const fiber = n['fiber_100g']

      // Spring over produkter med manglende data
      if (kcal === 0 && protein === 0 && carbs === 0 && fat === 0) continue

      return { kcal, protein, carbs, fat, fiber: fiber ?? undefined }
    }
    return null
  } catch {
    return null
  }
}

// --- Opslag ---

async function lookupIngredientWithKey(name: string): Promise<{ facts: NutritionFacts; key: string } | null> {
  if (!name.trim()) return null

  // 1. Lokal database
  const local = lookupLocal(name)
  if (local) return local

  // 2. IndexedDB cache
  const cacheKey = normalizeIngredientName(name)
  const cached = await db.nutritionCache.get(cacheKey)
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return { facts: cached.facts, key: `OFF: ${cacheKey}` }
  }

  // 3. Open Food Facts
  const facts = await fetchFromOpenFoodFacts(cacheKey)
  if (facts) {
    await db.nutritionCache.put({ name: cacheKey, facts, fetchedAt: Date.now() })
    return { facts, key: `OFF: ${cacheKey}` }
  }
  return null
}

export async function lookupIngredient(name: string): Promise<NutritionFacts | null> {
  const result = await lookupIngredientWithKey(name)
  return result?.facts ?? null
}

// --- Beregn samlet næringsinhold for en opskrift ---

export async function calculateRecipeNutrition(recipe: Recipe): Promise<RecipeNutrition> {
  const total: NutritionFacts = { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
  const missing: string[] = []
  const details: import('@/types/recipe').IngredientNutritionDetail[] = []
  let totalGrams = 0

  const lookups = await Promise.all(
    recipe.ingredients
      .filter(ing => !ing.isHeader && ing.name.trim())
      .map(async ing => {
        const grams = toGrams(ing.amount, ing.unit, ing.name)
        const result = await lookupIngredientWithKey(ing.name)
        return { ing, grams, result }
      })
  )

  for (const { ing, grams, result } of lookups) {
    if (!result) {
      missing.push(ing.name)
      details.push({ name: ing.name, amount: ing.amount, unit: ing.unit, grams: 0, matchedKey: null, kcal: 0, protein: 0, carbs: 0, fat: 0 })
      continue
    }
    const { facts } = result
    const factor = grams > 0 ? grams / 100 : 0
    details.push({
      name: ing.name,
      amount: ing.amount,
      unit: ing.unit,
      grams,
      matchedKey: result.key,
      kcal: Math.round(facts.kcal * factor),
      protein: Math.round(facts.protein * factor * 10) / 10,
      carbs: Math.round(facts.carbs * factor * 10) / 10,
      fat: Math.round(facts.fat * factor * 10) / 10,
    })
    if (grams === 0) continue
    total.kcal += facts.kcal * factor
    total.protein += facts.protein * factor
    total.carbs += facts.carbs * factor
    total.fat += facts.fat * factor
    if (facts.fiber !== undefined) total.fiber = (total.fiber ?? 0) + facts.fiber * factor
    totalGrams += grams
  }

  const round = (n: number) => Math.round(n * 10) / 10
  const roundFacts = (f: NutritionFacts): NutritionFacts => ({
    kcal: Math.round(f.kcal),
    protein: round(f.protein),
    carbs: round(f.carbs),
    fat: round(f.fat),
    fiber: f.fiber !== undefined ? round(f.fiber) : undefined,
  })

  const tg = totalGrams || 100
  const per100g = roundFacts({
    kcal: (total.kcal / tg) * 100,
    protein: (total.protein / tg) * 100,
    carbs: (total.carbs / tg) * 100,
    fat: (total.fat / tg) * 100,
    fiber: total.fiber !== undefined ? (total.fiber / tg) * 100 : undefined,
  })

  return {
    total: roundFacts(total),
    per100g,
    totalGrams: Math.round(totalGrams),
    details,
    calculatedAt: Date.now(),
    servings: recipe.servings || 1,
    missing,
  }
}
