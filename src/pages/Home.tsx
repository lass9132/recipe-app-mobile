import { useState } from 'react'
import { Search, SlidersHorizontal, X, Plus } from 'lucide-react'
import { AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { useRecipes } from '@/hooks/useRecipes'
import { useSearch } from '@/hooks/useSearch'
import { RecipeCard } from '@/components/RecipeCard'
import { FilterPanel, type FilterState, MEAL_TYPES } from '@/components/FilterPanel'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'

const EMPTY_FILTERS: FilterState = { tags: [], ingredients: [], maxTime: null, minRating: null, mealTypes: [] }

export function Home() {
  const { recipes, loading } = useRecipes()
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS)
  const [showFilters, setShowFilters] = useState(false)

  const { results } = useSearch(recipes, query, filters)

  const activeFilterCount =
    filters.tags.length +
    filters.ingredients.length +
    filters.mealTypes.length +
    (filters.maxTime !== null ? 1 : 0) +
    (filters.minRating !== null ? 1 : 0)

  const clearAll = () => setFilters(EMPTY_FILTERS)

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">

      {/* Sticky søge- og filterpanel */}
      <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 sticky top-[calc(3.5rem_+_env(safe-area-inset-top))] z-10">

        {/* Søgerække */}
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <Input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Søg på navn, ingrediens eller tag..."
                className="pl-10 pr-10"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <button
              onClick={() => setShowFilters(f => !f)}
              className={`relative flex items-center gap-2 px-3 h-10 rounded-xl border text-sm font-medium transition-all duration-150 flex-shrink-0 ${
                showFilters || activeFilterCount > 0
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-400 text-emerald-700 dark:text-emerald-300'
                  : 'border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span className="hidden sm:inline">Filtrer</span>
              {activeFilterCount > 0 && (
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-600 text-white text-xs font-bold leading-none">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {/* Aktive filter-pills */}
          {activeFilterCount > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {filters.ingredients.map(ing => (
                <span key={ing} className="inline-flex items-center gap-1 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 rounded-full px-2.5 py-0.5 text-xs font-medium">
                  {ing}
                  <button onClick={() => setFilters(f => ({ ...f, ingredients: f.ingredients.filter(i => i !== ing) }))}>
                    <X className="w-3 h-3 hover:text-red-500" />
                  </button>
                </span>
              ))}
              {filters.tags.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 rounded-full px-2.5 py-0.5 text-xs font-medium">
                  {tag}
                  <button onClick={() => setFilters(f => ({ ...f, tags: f.tags.filter(t => t !== tag) }))}>
                    <X className="w-3 h-3 hover:text-red-500" />
                  </button>
                </span>
              ))}
              {filters.maxTime !== null && (
                <span className="inline-flex items-center gap-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full px-2.5 py-0.5 text-xs font-medium">
                  Max {filters.maxTime} min
                  <button onClick={() => setFilters(f => ({ ...f, maxTime: null }))}><X className="w-3 h-3 hover:text-red-500" /></button>
                </span>
              )}
              {filters.minRating !== null && (
                <span className="inline-flex items-center gap-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded-full px-2.5 py-0.5 text-xs font-medium">
                  ★ {filters.minRating}+
                  <button onClick={() => setFilters(f => ({ ...f, minRating: null }))}><X className="w-3 h-3 hover:text-red-500" /></button>
                </span>
              )}
              {filters.mealTypes.map(id => {
                const mt = MEAL_TYPES.find(m => m.id === id)
                if (!mt) return null
                return (
                  <span key={id} className="inline-flex items-center gap-1 bg-violet-100 dark:bg-violet-900/30 text-violet-800 dark:text-violet-300 rounded-full px-2.5 py-0.5 text-xs font-medium">
                    {mt.emoji} {mt.label}
                    <button onClick={() => setFilters(f => ({ ...f, mealTypes: f.mealTypes.filter(m => m !== id) }))}><X className="w-3 h-3 hover:text-red-500" /></button>
                  </span>
                )
              })}
              <button onClick={clearAll} className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 underline ml-1">
                Ryd alle
              </button>
            </div>
          )}
        </div>

        {/* Filterpanel — ingen overflow-hidden her, så dropdown ikke klippes */}
        <AnimatePresence>
          {showFilters && (
            <FilterPanel
              recipes={recipes}
              filters={filters}
              onChange={setFilters}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Indhold */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-72 rounded-2xl bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
            ))}
          </div>
        ) : recipes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-24 h-24 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-6">
              <span className="text-4xl">🍽️</span>
            </div>
            <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-200 mb-2">Ingen opskrifter endnu</h2>
            <p className="text-zinc-500 dark:text-zinc-400 mb-6 max-w-sm">Tilføj din første opskrift og begynd at bygge din samling!</p>
            <Link to="/new"><Button size="lg"><Plus className="w-5 h-5" /> Tilføj første opskrift</Button></Link>
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-zinc-500 dark:text-zinc-400 mb-2">Ingen opskrifter matcher din søgning</p>
            <button onClick={() => { setQuery(''); clearAll() }} className="text-emerald-600 hover:underline text-sm">
              Ryd søgning og filtre
            </button>
          </div>
        ) : (
          <>
            <div className="mb-5">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {results.length} opskrift{results.length !== 1 ? 'er' : ''}
                {(query || activeFilterCount > 0) && ' fundet'}
              </p>
            </div>
            <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              <AnimatePresence>
                {results.map(recipe => <RecipeCard key={recipe.id} recipe={recipe} />)}
              </AnimatePresence>
            </motion.div>
          </>
        )}
      </div>
    </div>
  )
}
