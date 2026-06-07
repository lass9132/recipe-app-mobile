import { Clock, Users, Star, ChefHat } from 'lucide-react'
import { motion } from 'framer-motion'
import { Badge } from '@/components/ui/badge'
import type { Recipe } from '@/types/recipe'
import { Link } from 'react-router-dom'
import { getRecipeMealTypes } from '@/components/FilterPanel'

interface RecipeCardProps {
  recipe: Recipe
}

export function RecipeCard({ recipe }: RecipeCardProps) {
  const totalTime = recipe.prepTime + recipe.cookTime
  const mealTypes = getRecipeMealTypes(recipe)

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
    >
      <Link to={`/recipe/${recipe.id}`} className="block h-full">
        <div className="h-full rounded-2xl overflow-hidden bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm hover:shadow-lg transition-shadow duration-300 flex flex-col">
          {/* Billede */}
          <div className="relative h-48 bg-gradient-to-br from-emerald-50 to-teal-100 dark:from-emerald-950 dark:to-teal-900 flex-shrink-0">
            {recipe.image ? (
              <img
                src={recipe.image}
                alt={recipe.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ChefHat className="w-16 h-16 text-emerald-300 dark:text-emerald-700" />
              </div>
            )}
            {recipe.rating && (
              <div className="absolute top-3 right-3 flex items-center gap-1 bg-black/50 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-full">
                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                <span>{recipe.rating}</span>
              </div>
            )}
          </div>

          {/* Indhold */}
          <div className="p-4 flex flex-col flex-1">
            <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 text-base leading-tight mb-1 line-clamp-2">
              {recipe.title}
            </h3>
            {recipe.description && (
              <p className="text-zinc-500 dark:text-zinc-400 text-sm line-clamp-2 mb-3">
                {recipe.description}
              </p>
            )}

            {/* Tags */}
            {recipe.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {recipe.tags.slice(0, 3).map(tag => (
                  <Badge key={tag}>{tag}</Badge>
                ))}
                {recipe.tags.length > 3 && (
                  <Badge variant="outline">+{recipe.tags.length - 3}</Badge>
                )}
              </div>
            )}

            {/* Måltidstyper + Metadata — skubbes ned i bunden sammen */}
            <div className="mt-auto">
              {mealTypes.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {mealTypes.map(mt => (
                    <span key={mt.id} title={mt.label} className="text-sm" aria-label={mt.label}>
                      {mt.emoji}
                    </span>
                  ))}
                </div>
              )}

            {/* Metadata */}
            <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400 pt-3 border-t border-zinc-100 dark:border-zinc-800">
              {totalTime > 0 && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {totalTime} min
                </span>
              )}
              {recipe.servings > 0 && (
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  {recipe.servings} pers.
                </span>
              )}
              <span className="ml-auto text-zinc-400 dark:text-zinc-600">
                {recipe.ingredients.length} ingredienser
              </span>
            </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}
