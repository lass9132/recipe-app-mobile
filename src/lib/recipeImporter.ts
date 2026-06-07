import type { Recipe } from '@/types/recipe'

const LOCAL_PROXY = (url: string) => `/api/proxy?url=${encodeURIComponent(url)}`

// URL-import kræver den lokale Node-proxy (omgår CORS), som kun kører i dev (`npm run dev`).
// I produktion (den hostede PWA på PC/mobil/tablet) findes proxyen ikke, så funktionen skjules.
export const urlImportAvailable = import.meta.env.DEV

export type ImportResult =
  | { ok: true; data: Partial<Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>> }
  | { ok: false; error: string }

// --- Hjælpefunktioner ---

function parseTime(iso?: string): number {
  if (!iso) return 0
  const h = iso.match(/(\d+)H/)?.[1] ?? '0'
  const m = iso.match(/(\d+)M/)?.[1] ?? '0'
  return parseInt(h) * 60 + parseInt(m)
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// Kendte enheder — bruges til at validere hvad parseIngredients sætter i unit-feltet
const KNOWN_UNITS = new Set([
  'g', 'gr', 'gram', 'grams', 'gm', 'grm',
  'kg', 'kilo', 'kilogram', 'kilograms',
  'ml', 'milliliter', 'milliliters', 'millilitre',
  'cl', 'centiliter', 'centiliters',
  'dl', 'deciliter', 'deciliters', 'decilitre',
  'l', 'liter', 'liters', 'litre', 'litres',
  'tsk', 'teske', 'teskefuld', 'teskeskefuld', 'tsp', 'teaspoon', 'teaspoons',
  'spsk', 'spiseske', 'spiseskefuld', 'tbsp', 'tbs', 'tablespoon', 'tablespoons',
  'stk', 'stykker', 'stykke', 'enhed', 'enheder', 'fed', 'piece', 'pieces', 'pcs',
  'ds', 'dåse', 'dåser', 'can', 'cans', 'tin', 'tins',
  'pk', 'pakke', 'pakker', 'pack', 'package', 'pose',
  'bundt', 'bundter', 'bunch', 'bunches',
  'håndfuld', 'handful', 'handfuls', 'hf',
  'kop', 'kopper', 'cup', 'cups',
  'knsp', 'knivspids', 'pinch',
  'skive', 'skiver', 'slice', 'slices',
])

function parseIngredients(raw: string[]): Recipe['ingredients'] {
  return raw.map(line => {
    const clean = line.trim()
    // "1000 gram Kartofler" eller "0.5 ds. Ananasringe"
    const match = clean.match(/^([\d½¼¾⅓⅔,.\/]+)?\s*([a-zA-ZæøåÆØÅ]+\.?)?\s+(.+)$/)
    if (match && match[3]) {
      const candidate = (match[2] ?? '').trim()
      const isUnit = KNOWN_UNITS.has(candidate.toLowerCase().replace(/\.$/, ''))
      if (isUnit) {
        return { amount: (match[1] ?? '').trim(), unit: candidate, name: match[3].trim() }
      }
      // Ikke en kendt enhed — hele teksten efter mængden er ingrediensnavnet
      const rest = clean.slice((match[1] ?? '').length).trim()
      return { amount: (match[1] ?? '').trim(), unit: '', name: rest }
    }
    return { amount: '', unit: '', name: clean }
  })
}

function firstStr(val: unknown): string {
  if (typeof val === 'string') return val
  if (Array.isArray(val)) return firstStr(val[0])
  return ''
}

function toStringArray(val: unknown): string[] {
  if (!val) return []
  if (typeof val === 'string') return [val]
  if (Array.isArray(val)) return val.flatMap(v => toStringArray(v))
  if (typeof val === 'object' && val !== null) {
    const obj = val as Record<string, unknown>
    if (typeof obj.text === 'string') return [obj.text]
    if (typeof obj.itemListElement !== 'undefined') return toStringArray(obj.itemListElement)
  }
  return []
}

// --- 1. JSON-LD (Schema.org Recipe) ---

function parseJsonLd(html: string): Partial<Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>> | null {
  const scriptRegex = /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi
  let match: RegExpExecArray | null

  while ((match = scriptRegex.exec(html)) !== null) {
    try {
      const json = JSON.parse(match[1])
      const items: unknown[] = Array.isArray(json) ? json : json['@graph'] ? json['@graph'] : [json]

      for (const item of items) {
        const obj = item as Record<string, unknown>
        if (!firstStr(obj['@type']).toLowerCase().includes('recipe')) continue

        const rawIngredients = toStringArray(obj.recipeIngredient)
        const rawSteps = toStringArray(obj.recipeInstructions)

        const tags: string[] = []
        tags.push(...toStringArray(obj.recipeCategory), ...toStringArray(obj.recipeCuisine))
        const kw = firstStr(obj.keywords).split(',').map(k => k.trim()).filter(Boolean)
        tags.push(...kw)

        // Billede fra JSON-LD
        let imageUrl = ''
        const imgVal = obj.image
        if (typeof imgVal === 'string') imageUrl = imgVal
        else if (Array.isArray(imgVal)) imageUrl = firstStr(imgVal[0])
        else if (imgVal && typeof imgVal === 'object') imageUrl = firstStr((imgVal as Record<string, unknown>).url)

        return {
          title: firstStr(obj.name),
          description: firstStr(obj.description),
          prepTime: parseTime(firstStr(obj.prepTime)),
          cookTime: parseTime(firstStr(obj.cookTime) || firstStr(obj.totalTime)),
          servings: parseInt(firstStr(obj.recipeYield)) || 4,
          ingredients: parseIngredients(rawIngredients),
          instructions: rawSteps.join('\n\n'),
          tags: [...new Set(tags.map(t => t.toLowerCase()))].slice(0, 8),
          image: imageUrl || undefined,
        }
      }
    } catch { /* fortsæt */ }
  }
  return null
}

// --- 2. Microdata (itemprop) — bruges af bl.a. dk-kogebogen.dk og valdemarsro.dk ---

// Finder indholdet af et HTML-element ved at tælle åbne/lukkede tags korrekt
function extractElementContent(html: string, startIndex: number): string {
  // Find det åbnende tags navn
  const openTag = html.slice(startIndex).match(/^<(\w+)/)
  if (!openTag) return ''
  const tagName = openTag[1].toLowerCase()

  // Void-elementer har intet indhold
  if (['meta', 'input', 'img', 'br', 'hr', 'link'].includes(tagName)) return ''

  let depth = 0
  let i = startIndex
  while (i < html.length) {
    const openMatch = html.slice(i).match(new RegExp(`^<${tagName}[\\s>]`, 'i'))
    const closeMatch = html.slice(i).match(new RegExp(`^<\\/${tagName}>`, 'i'))
    if (openMatch) depth++
    else if (closeMatch) {
      depth--
      if (depth === 0) {
        // Returner alt mellem åbning og lukning
        const contentStart = html.indexOf('>', startIndex) + 1
        return html.slice(contentStart, i)
      }
    }
    i++
  }
  return ''
}

function parseMicrodata(html: string): Partial<Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>> | null {
  // Find itemprop og udtræk det FULDE indhold af elementet (håndterer nestede tags)
  const getItemprop = (prop: string): string => {
    const meta = html.match(new RegExp(`<meta[^>]+itemprop=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'))
      ?? html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+itemprop=["']${prop}["']`, 'i'))
    if (meta) return meta[1]

    const re = new RegExp(`<\\w+[^>]+itemprop=["']${prop}["'][^>]*>`, 'i')
    const m = re.exec(html)
    if (!m) return ''
    const content = extractElementContent(html, m.index)
    return stripHtml(content)
  }

  const getAllItemprop = (prop: string): string[] => {
    const results: string[] = []
    // Matcher både <span itemprop="x">tekst</span> og hidden spans med direkte tekst
    const re = new RegExp(`itemprop=["']${prop}["']>([^<]+)`, 'gi')
    let m: RegExpExecArray | null
    while ((m = re.exec(html)) !== null) results.push(m[1].trim())
    return [...new Set(results)].filter(Boolean)
  }

  // Tjek om siden har itemprop=recipeIngredient
  if (!html.includes('itemprop="recipeIngredient"') && !html.includes("itemprop='recipeIngredient'")) {
    return null
  }

  const rawIngredients = getAllItemprop('recipeIngredient')
  const instructions = stripHtml(getItemprop('recipeInstructions'))

  // Billede med itemprop="image"
  const imgMatch = html.match(/itemprop=["']image["'][^>]*src=["']([^"']+)["']/i)
    ?? html.match(/src=["']([^"']+)["'][^>]*itemprop=["']image["']/i)
  let imageUrl = imgMatch?.[1] ?? ''

  // Gør relativ URL absolut
  if (imageUrl && imageUrl.startsWith('/')) {
    // Udtræk domæne fra HTML (tjek canonical eller og:url)
    const domain = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1]
      ?? html.match(/<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i)?.[1]
      ?? ''
    if (domain) {
      try { imageUrl = new URL(imageUrl, domain).href } catch { /* behold som er */ }
    }
  }

  if (!rawIngredients.length && !instructions) return null

  return {
    ingredients: parseIngredients(rawIngredients),
    instructions,
    image: imageUrl || undefined,
  }
}

// --- 3. Heuristisk parser — leder efter overskrifter med "Ingredienser" og "Fremgangsmåde" ---

const INGREDIENT_HEADINGS = ['ingredienser', 'ingredients', 'du skal bruge', 'you will need', 'raw ingredients', 'hvad skal du bruge']
const INSTRUCTION_HEADINGS = ['fremgangsmåde', 'tilberedning', 'sådan gør du', 'sådan laver du', 'instructions', 'directions', 'method', 'preparation', 'how to make', 'tilberedningsmetode']

function parseByHeadings(html: string): Partial<Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>> | null {
  // Udtræk alt indhold fra en overskrift til næste overskrift (h1-h4)
  const headingRe = /<(h[1-4])[^>]*>([\s\S]*?)<\/h[1-4]>/gi
  const headings: Array<{ level: string; text: string; index: number; endIndex: number }> = []
  let m: RegExpExecArray | null
  while ((m = headingRe.exec(html)) !== null) {
    headings.push({
      level: m[1],
      text: stripHtml(m[0]).toLowerCase().trim(),
      index: m.index,
      endIndex: m.index + m[0].length,
    })
  }

  if (headings.length === 0) return null

  function getContentAfterHeading(headingIdx: number): string {
    const from = headings[headingIdx].endIndex
    // Slut ved næste overskrift af samme eller højere niveau, eller slutningen
    const currentLevel = parseInt(headings[headingIdx].level[1])
    let to = html.length
    for (let j = headingIdx + 1; j < headings.length; j++) {
      const nextLevel = parseInt(headings[j].level[1])
      if (nextLevel <= currentLevel) { to = headings[j].index; break }
    }
    return html.slice(from, to)
  }

  let ingredientLines: string[] = []
  let instructionText = ''

  for (let i = 0; i < headings.length; i++) {
    const h = headings[i]

    if (ingredientLines.length === 0 && INGREDIENT_HEADINGS.some(kw => h.text.includes(kw))) {
      const block = getContentAfterHeading(i)
      // Udtræk <li>-elementer
      const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi
      let li: RegExpExecArray | null
      while ((li = liRe.exec(block)) !== null) {
        const text = stripHtml(li[1]).trim()
        if (text) ingredientLines.push(text)
      }
      // Fallback: split på linjeskift hvis ingen <li>
      if (ingredientLines.length === 0) {
        ingredientLines = stripHtml(block).split('\n').map(l => l.trim()).filter(Boolean)
      }
    }

    if (!instructionText && INSTRUCTION_HEADINGS.some(kw => h.text.includes(kw))) {
      const block = getContentAfterHeading(i)
      // Saml nummererede/ummarkerede lister
      const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi
      const steps: string[] = []
      let li: RegExpExecArray | null
      while ((li = liRe.exec(block)) !== null) {
        const text = stripHtml(li[1]).trim()
        if (text) steps.push(text)
      }
      instructionText = steps.length > 0 ? steps.join('\n\n') : stripHtml(block).trim()
    }
  }

  if (ingredientLines.length === 0 && !instructionText) return null

  return {
    ingredients: ingredientLines.length > 0 ? parseIngredients(ingredientLines) : [],
    instructions: instructionText,
  }
}

// --- 4. Fallback: meta/OG tags ---

function parseMetaTags(html: string): Partial<Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>> {
  const getMeta = (prop: string) => {
    const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i'))
      ?? html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, 'i'))
    return m?.[1] ?? ''
  }

  const title = getMeta('og:title') || html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || ''
  const description = getMeta('og:description') || getMeta('description') || ''
  const ogImage = getMeta('og:image') || ''

  return {
    title: title.trim(),
    description: description.trim(),
    image: ogImage || undefined,
    ingredients: [],
    instructions: '',
    tags: [],
  }
}

// --- Fetch ---

async function fetchHtml(url: string, depth = 0): Promise<string> {
  if (depth > 3) throw new Error('For mange redirects')
  const res = await fetch(LOCAL_PROXY(url), { signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const text = await res.text()
  if (text.startsWith('REDIRECT:')) return fetchHtml(text.slice(9), depth + 1)
  return text
}

// Henter et billede via proxy og returnerer base64 data URL
async function fetchImageAsBase64(imageUrl: string): Promise<string | undefined> {
  try {
    const res = await fetch(LOCAL_PROXY(imageUrl), { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return undefined
    const blob = await res.blob()
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => resolve(undefined)
      reader.readAsDataURL(blob)
    })
  } catch {
    return undefined
  }
}

// Gør billed-URL absolut og henter den som base64
async function resolveImage(imageUrl: string | undefined, pageUrl: string): Promise<string | undefined> {
  if (!imageUrl) return undefined
  // Gør relativ URL absolut
  let absolute = imageUrl
  if (imageUrl.startsWith('/')) {
    try { absolute = new URL(imageUrl, pageUrl).href } catch { return undefined }
  }
  if (!absolute.startsWith('http')) return undefined
  return fetchImageAsBase64(absolute)
}

// --- Hoved-funktion ---

export async function importFromUrl(url: string): Promise<ImportResult> {
  let html: string
  try {
    html = await fetchHtml(url)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes('timeout') || msg.includes('abort')) {
      return { ok: false, error: 'Siden tog for lang tid at svare. Prøv igen.' }
    }
    return { ok: false, error: 'Kunne ikke hente siden. Tjek at URL\'en er korrekt og at du er online.' }
  }

  // Hent base-info fra meta-tags (bruges altid som fundament)
  const metaData = parseMetaTags(html)

  // 1. Forsøg JSON-LD
  const jsonLd = parseJsonLd(html)
  if (jsonLd && jsonLd.ingredients && jsonLd.ingredients.length > 0) {
    const data = { ...metaData, ...jsonLd, sourceUrl: url }
    data.image = await resolveImage(data.image, url)
    return { ok: true, data }
  }

  // 2. Forsøg Microdata (itemprop)
  const micro = parseMicrodata(html)
  if (micro && (micro.ingredients?.length || micro.instructions)) {
    const data = { ...metaData, ...micro, sourceUrl: url }
    data.image = await resolveImage(data.image, url)
    return { ok: true, data }
  }

  // 3. Heuristisk parser — scan efter overskrifter som "Ingredienser" og "Fremgangsmåde"
  const heuristic = parseByHeadings(html)
  if (heuristic && (heuristic.ingredients?.length || heuristic.instructions)) {
    const data = { ...metaData, ...heuristic, sourceUrl: url }
    data.image = await resolveImage(data.image, url)
    return { ok: true, data }
  }

  // 4. Kun meta-data (titel + beskrivelse)
  if (metaData.title) {
    const data = { ...metaData, sourceUrl: url }
    data.image = await resolveImage(data.image, url)
    return { ok: true, data }
  }

  return { ok: false, error: 'Kunne ikke finde opskriftsdata på siden.' }
}
