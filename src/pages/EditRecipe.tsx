import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { getRecipeById, saveRecipe } from '@/db/database'
import type { Recipe } from '@/types/recipe'
import { RecipeForm } from '@/components/RecipeForm'

type RecipeFormData = Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>

export function EditRecipe() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    getRecipeById(id).then(r => {
      setRecipe(r ?? null)
      setLoading(false)
    })
  }, [id])

  const handleSubmit = async (data: RecipeFormData) => {
    if (!recipe) return
    await saveRecipe({ ...recipe, ...data, updatedAt: Date.now() })
    toast.success('Opskrift opdateret!')
    navigate(`/recipe/${recipe.id}`)
  }

  if (loading) return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!recipe) return (
    <div className="min-h-screen flex items-center justify-center">
      <p>Opskrift ikke fundet</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Tilbage</span>
        </button>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">Rediger opskrift</h1>
          <RecipeForm
            initial={recipe}
            onSubmit={handleSubmit}
            onCancel={() => navigate(-1)}
            submitLabel="Gem ændringer"
          />
        </div>
      </div>
    </div>
  )
}
