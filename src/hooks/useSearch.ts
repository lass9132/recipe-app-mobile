import { useMemo } from 'react'
import Fuse from 'fuse.js'
import type { Recipe } from '@/types/recipe'
import type { FilterState } from '@/components/FilterPanel'

const fuseOptions = {
  keys: [
    { name: 'title', weight: 0.4 },
    { name: 'description', weight: 0.2 },
    { name: 'tags', weight: 0.2 },
    { name: 'ingredients.name', weight: 0.2 },
  ],
  threshold: 0.35,
  includeScore: true,
}

export function useSearch(recipes: Recipe[], query: string, filters: FilterState) {
  const results = useMemo(() => {
    let filtered = recipes

    if (filters.tags.length > 0)
      filtered = filtered.filter(r => filters.tags.every(tag => r.tags.includes(tag)))

    if (filters.ingredients.length > 0)
      filtered = filtered.filter(r =>
        filters.ingredients.every(ing =>
          r.ingredients.some(i => i.name.toLowerCase().includes(ing.toLowerCase()))
        )
      )

    if (filters.maxTime !== null)
      filtered = filtered.filter(r => (r.prepTime + r.cookTime) <= filters.maxTime!)

    if (filters.minRating !== null)
      filtered = filtered.filter(r => r.rating !== undefined && r.rating >= filters.minRating!)

    if (filters.mealTypes.length > 0) {
      filtered = filtered.filter(r => {
        return filters.mealTypes.every(type => {
          const n = r.nutrition
          const servings = n?.servings || r.servings || 1
          const kcal    = n ? n.total.kcal    / servings : null
          const protein = n ? n.total.protein / servings : null
          const fat     = n ? n.total.fat     / servings : null
          const carbs   = n ? n.total.carbs   / servings : null

          // Fullness Factor pr. 100g (bruges til mættende)
          const p100 = r.nutrition?.per100g ?? null
          const ff = p100 && p100.kcal > 0
            ? 41.7 / Math.pow(p100.kcal, 0.7) + 0.05 * p100.protein - 0.00000725 * Math.pow(p100.fat, 3) + 0.617
            : null

          switch (type) {
            case 'proteinrig':   return protein !== null && protein >= 25
            case 'let':          return kcal    !== null && kcal    <= 400
            case 'maettende':    return ff      !== null && ff      >= 2.5
            case 'fedtrig':      return fat     !== null && fat     >= 25
            case 'fedtfattig':   return fat     !== null && fat     <= 12
            case 'lavkulhydrat': return carbs   !== null && carbs   <= 20
            case 'kulhydratrig': return carbs   !== null && carbs   >= 60
            case 'vegetar':      return r.tags.some(t => ['vegetar', 'vegansk', 'vegan', 'vegetarisk'].includes(t.toLowerCase()))
            case 'hurtig':       return (r.prepTime + r.cookTime) <= 30
            default:             return true
          }
        })
      })
    }

    if (!query.trim()) return filtered
    const fuse = new Fuse(filtered, fuseOptions)
    return fuse.search(query).map(r => r.item)
  }, [recipes, query, filters])

  return { results }
}
