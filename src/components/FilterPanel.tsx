import { useState, useRef, useEffect, useMemo } from 'react'
import { X, ChevronDown, Tag, Carrot, Clock, Star, Flame } from 'lucide-react'
import { Slider } from '@/components/ui/slider'
import { AnimatePresence, motion } from 'framer-motion'
import { Badge } from '@/components/ui/badge'
import type { Recipe } from '@/types/recipe'

export interface FilterState {
  tags: string[]
  ingredients: string[]
  maxTime: number | null
  minRating: number | null
  mealTypes: string[]
}

export interface MealType {
  id: string
  label: string
  emoji: string
  description: string
  color: string // tailwind bg/text klasse-par
}

export const MEAL_TYPES: MealType[] = [
  { id: 'proteinrig',    label: 'Proteinrig',      emoji: '💪', description: '≥25g protein pr. portion',    color: 'purple'  },
  { id: 'let',           label: 'Let',              emoji: '🥗', description: '≤400 kcal pr. portion',       color: 'lime'    },
  { id: 'maettende',     label: 'Mættende',         emoji: '🍽️', description: 'Fullness Factor ≥ 2,5 pr. 100g', color: 'amber'   },
  { id: 'fedtrig',       label: 'Fedtrig',          emoji: '🧈', description: '≥25g fedt pr. portion',          color: 'yellow'  },
  { id: 'fedtfattig',    label: 'Fedtfattig',       emoji: '💧', description: '≤12g fedt pr. portion',          color: 'sky'     },
  { id: 'lavkulhydrat',  label: 'Lav kulhydrat',    emoji: '🥩', description: '≤20g kulhydrat pr. portion',     color: 'red'     },
  { id: 'kulhydratrig',  label: 'Kulhydratrig',     emoji: '🍝', description: '≥60g kulhydrat pr. portion',     color: 'orange'  },
  { id: 'vegetar',       label: 'Vegetar',          emoji: '🌱', description: 'Tagget "vegetar" eller "vegansk"', color: 'green' },
  { id: 'hurtig',        label: 'Hurtig',           emoji: '⚡', description: '≤30 min tilberedning i alt', color: 'blue'    },
]

// Beregn hvilke måltidstyper en opskrift opfylder
export function getRecipeMealTypes(recipe: import('@/types/recipe').Recipe): MealType[] {
  const n = recipe.nutrition
  const servings = n?.servings || recipe.servings || 1
  const kcal    = n ? n.total.kcal    / servings : null
  const protein = n ? n.total.protein / servings : null
  const fat     = n ? n.total.fat     / servings : null
  const carbs   = n ? n.total.carbs   / servings : null
  const p100    = n?.per100g ?? null
  const ff = p100 && p100.kcal > 0
    ? 41.7 / Math.pow(p100.kcal, 0.7) + 0.05 * p100.protein - 0.00000725 * Math.pow(p100.fat, 3) + 0.617
    : null

  return MEAL_TYPES.filter(mt => {
    switch (mt.id) {
      case 'proteinrig':   return protein !== null && protein >= 25
      case 'let':          return kcal    !== null && kcal    <= 400
      case 'maettende':    return ff      !== null && ff      >= 2.5
      case 'fedtrig':      return fat     !== null && fat     >= 25
      case 'fedtfattig':   return fat     !== null && fat     <= 12
      case 'lavkulhydrat': return carbs   !== null && carbs   <= 20
      case 'kulhydratrig': return carbs   !== null && carbs   >= 60
      case 'vegetar':      return recipe.tags.some(t => ['vegetar', 'vegansk', 'vegan', 'vegetarisk'].includes(t.toLowerCase()))
      case 'hurtig':       return (recipe.prepTime + recipe.cookTime) <= 30
      default:             return false
    }
  })
}

const COLOR_MAP: Record<string, { active: string; inactive: string }> = {
  purple: { active: 'bg-purple-600 text-white border-purple-600', inactive: 'border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-purple-400 hover:text-purple-600 dark:hover:text-purple-400' },
  lime:   { active: 'bg-lime-600 text-white border-lime-600',     inactive: 'border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-lime-400 hover:text-lime-600 dark:hover:text-lime-400' },
  amber:  { active: 'bg-amber-600 text-white border-amber-600',   inactive: 'border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-amber-400 hover:text-amber-600 dark:hover:text-amber-400' },
  yellow: { active: 'bg-yellow-500 text-white border-yellow-500', inactive: 'border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-yellow-400 hover:text-yellow-600 dark:hover:text-yellow-400' },
  sky:    { active: 'bg-sky-600 text-white border-sky-600',       inactive: 'border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-sky-400 hover:text-sky-600 dark:hover:text-sky-400' },
  red:    { active: 'bg-red-600 text-white border-red-600',       inactive: 'border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-red-400 hover:text-red-600 dark:hover:text-red-400' },
  orange: { active: 'bg-orange-600 text-white border-orange-600', inactive: 'border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-orange-400 hover:text-orange-600 dark:hover:text-orange-400' },
  green:  { active: 'bg-emerald-600 text-white border-emerald-600', inactive: 'border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-400' },
  blue:   { active: 'bg-blue-600 text-white border-blue-600',     inactive: 'border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400' },
}

interface FilterPanelProps {
  recipes: Recipe[]
  filters: FilterState
  onChange: (f: FilterState) => void
}

const MAX_TIME_SLIDER = 180 // minutter

function formatTime(min: number) {
  if (min >= MAX_TIME_SLIDER) return 'Ingen grænse'
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h} time${h > 1 ? 'r' : ''}` : `${h}t ${m} min`
}

export function FilterPanel({ recipes, filters, onChange }: FilterPanelProps) {
  const [ingredientInput, setIngredientInput] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const allTags = useMemo(() => {
    const set = new Set<string>()
    recipes.forEach(r => r.tags.forEach(t => set.add(t)))
    return Array.from(set).sort()
  }, [recipes])

  const allIngredients = useMemo(() => {
    const set = new Set<string>()
    recipes.forEach(r => r.ingredients.forEach(i => {
      if (i.name.trim()) set.add(i.name.trim().toLowerCase())
    }))
    return Array.from(set).sort()
  }, [recipes])

  const suggestions = useMemo(() => {
    const q = ingredientInput.toLowerCase()
    return allIngredients
      .filter(i => (!q || i.includes(q)) && !filters.ingredients.includes(i))
      .slice(0, 12)
  }, [ingredientInput, allIngredients, filters.ingredients])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) setShowDropdown(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const set = (patch: Partial<FilterState>) => onChange({ ...filters, ...patch })

  const addIngredient = (ing: string) => {
    if (!filters.ingredients.includes(ing)) set({ ingredients: [...filters.ingredients, ing] })
    setIngredientInput('')
    setShowDropdown(false)
    inputRef.current?.focus()
  }

  const removeIngredient = (ing: string) => set({ ingredients: filters.ingredients.filter(i => i !== ing) })

  const toggleTag = (tag: string) =>
    set({ tags: filters.tags.includes(tag) ? filters.tags.filter(t => t !== tag) : [...filters.tags, tag] })

  const toggleMealType = (id: string) =>
    set({ mealTypes: filters.mealTypes.includes(id) ? filters.mealTypes.filter(m => m !== id) : [...filters.mealTypes, id] })

  const totalActive =
    filters.tags.length +
    filters.ingredients.length +
    filters.mealTypes.length +
    (filters.maxTime !== null ? 1 : 0) +
    (filters.minRating !== null ? 1 : 0)

  return (
    <div className="border-t border-zinc-100 dark:border-zinc-800">
      <div className="max-w-6xl mx-auto px-4 py-5 grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* --- Ingredienser --- */}
        <div>
          <SectionLabel icon={<Carrot className="w-3.5 h-3.5" />} label="Ingredienser jeg har" />

          {filters.ingredients.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {filters.ingredients.map(ing => (
                <span key={ing} className="inline-flex items-center gap-1 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 rounded-full px-2.5 py-0.5 text-xs font-medium">
                  {ing}
                  <button onClick={() => removeIngredient(ing)} className="hover:text-red-500 ml-0.5"><X className="w-3 h-3" /></button>
                </span>
              ))}
            </div>
          )}

          {/* Input med dropdown — uden overflow-hidden på parent */}
          <div className="relative">
            <input
              ref={inputRef}
              value={ingredientInput}
              onChange={e => { setIngredientInput(e.target.value); setShowDropdown(true) }}
              onFocus={() => setShowDropdown(true)}
              onKeyDown={e => {
                if (e.key === 'Enter' && suggestions.length > 0) { e.preventDefault(); addIngredient(suggestions[0]) }
                if (e.key === 'Escape') setShowDropdown(false)
              }}
              placeholder="Fx. kylling, pasta, tomat..."
              className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 pr-9 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />

            <AnimatePresence>
              {showDropdown && suggestions.length > 0 && (
                <motion.div
                  ref={dropdownRef}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.1 }}
                  className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl z-50 max-h-56 overflow-y-auto"
                >
                  {suggestions.map(ing => (
                    <button
                      key={ing}
                      onMouseDown={e => { e.preventDefault(); addIngredient(ing) }}
                      className="w-full text-left px-3 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors flex items-center gap-2 first:rounded-t-xl last:rounded-b-xl"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" />
                      {ing}
                    </button>
                  ))}
                </motion.div>
              )}
              {showDropdown && ingredientInput && suggestions.length === 0 && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl z-50 px-3 py-3"
                >
                  <p className="text-sm text-zinc-400">Ingen ingredienser matcher "{ingredientInput}"</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* --- Tags --- */}
        {allTags.length > 0 && (
          <div>
            <SectionLabel icon={<Tag className="w-3.5 h-3.5" />} label="Tags" />
            <div className="flex flex-wrap gap-1.5">
              {allTags.map(tag => (
                <button key={tag} onClick={() => toggleTag(tag)}>
                  <Badge variant={filters.tags.includes(tag) ? 'active' : 'outline'}>{tag}</Badge>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* --- Tid --- */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-400"><Clock className="w-3.5 h-3.5" /></span>
              <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">Max tilberedningstid</span>
            </div>
            <span className={`text-xs font-semibold tabular-nums ${filters.maxTime !== null ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-400'}`}>
              {filters.maxTime !== null ? formatTime(filters.maxTime) : 'Alle'}
            </span>
          </div>
          <Slider
            value={filters.maxTime ?? MAX_TIME_SLIDER}
            onChange={v => set({ maxTime: v >= MAX_TIME_SLIDER ? null : v })}
            min={5}
            max={MAX_TIME_SLIDER}
            step={5}
          />
          <div className="flex justify-between mt-1.5 text-[10px] text-zinc-400">
            <span>5 min</span>
            <span>1 time</span>
            <span>Ingen grænse</span>
          </div>
        </div>

        {/* --- Måltidstype --- */}
        <div className="md:col-span-2">
          <SectionLabel icon={<Flame className="w-3.5 h-3.5" />} label="Måltidstype" />
          <div className="flex flex-wrap gap-1.5">
            {MEAL_TYPES.map(mt => {
              const active = filters.mealTypes.includes(mt.id)
              const cls = COLOR_MAP[mt.color]
              return (
                <button
                  key={mt.id}
                  onClick={() => toggleMealType(mt.id)}
                  title={mt.description}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${active ? cls.active : cls.inactive}`}
                >
                  <span>{mt.emoji}</span>
                  {mt.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* --- Bedømmelse --- */}
        <div>
          <SectionLabel icon={<Star className="w-3.5 h-3.5" />} label="Minimum bedømmelse" />
          <div className="flex gap-2 items-center">
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                onClick={() => set({ minRating: filters.minRating === n ? null : n as 1|2|3|4|5 })}
                className="flex items-center gap-0.5 group transition-transform hover:scale-110"
                title={`${n} stjerne${n !== 1 ? 'r' : ''} eller mere`}
              >
                <Star
                  className={`w-7 h-7 transition-colors ${
                    filters.minRating !== null && n <= filters.minRating
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-zinc-300 dark:text-zinc-600 group-hover:text-yellow-300'
                  }`}
                />
              </button>
            ))}
            {filters.minRating !== null && (
              <span className="text-xs text-zinc-400 ml-1">
                {filters.minRating}+ stjerner
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Bundlinje */}
      {totalActive > 0 && (
        <div className="max-w-6xl mx-auto px-4 pb-3 flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800 pt-3">
          <span className="text-xs text-zinc-400">
            {totalActive} filter{totalActive !== 1 ? 'e' : ''} aktive
          </span>
          <button
            onClick={() => onChange({ tags: [], ingredients: [], maxTime: null, minRating: null, mealTypes: [] })}
            className="text-xs text-red-500 hover:text-red-700 font-medium hover:underline"
          >
            Ryd alle filtre
          </button>
        </div>
      )}
    </div>
  )
}

function SectionLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-2.5">
      <span className="text-zinc-400">{icon}</span>
      <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">{label}</span>
    </div>
  )
}
