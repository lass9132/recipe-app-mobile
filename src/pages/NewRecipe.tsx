import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { useRecipes } from '@/hooks/useRecipes'
import { RecipeForm } from '@/components/RecipeForm'
import { UrlImporter } from '@/components/UrlImporter'
import type { Recipe } from '@/types/recipe'

type RecipeFormData = Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>

export function NewRecipe() {
  const navigate = useNavigate()
  const { addRecipe } = useRecipes()
  const [prefill, setPrefill] = useState<Partial<RecipeFormData> | undefined>()
  const [formKey, setFormKey] = useState(0)

  const handleImport = (data: Partial<RecipeFormData>) => {
    setPrefill(data)
    setFormKey(k => k + 1) // Genindlæs formularen med nye data
    toast.success('Opskrift hentet! Tjek og tilpas data nedenfor 👇')
  }

  const handleSubmit = async (data: RecipeFormData) => {
    const id = await addRecipe(data)
    toast.success('Opskrift gemt! 🎉')
    navigate(`/recipe/${id}`)
  }

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

        <div className="space-y-4">
          {/* URL-import */}
          <UrlImporter onImport={handleImport} />

          {/* Formular */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6 shadow-sm">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-6">
              {prefill?.title ? 'Gennemse og gem' : 'Ny opskrift'}
            </h1>
            <RecipeForm
              key={formKey}
              initial={prefill}
              onSubmit={handleSubmit}
              onCancel={() => navigate(-1)}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
