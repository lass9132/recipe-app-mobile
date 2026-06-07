import { useState, useEffect, useCallback } from 'react'
import { getAllRecipes, saveRecipe, deleteRecipe } from '@/db/database'
import type { Recipe } from '@/types/recipe'
import { v4 as uuidv4 } from 'uuid'

export function useRecipes() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await getAllRecipes()
    setRecipes(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const addRecipe = useCallback(async (data: Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>) => {
    const recipe: Recipe = {
      ...data,
      id: uuidv4(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    await saveRecipe(recipe)
    await load()
    return recipe.id
  }, [load])

  const updateRecipe = useCallback(async (id: string, data: Partial<Recipe>) => {
    const existing = recipes.find(r => r.id === id)
    if (!existing) return
    const updated: Recipe = { ...existing, ...data, updatedAt: Date.now() }
    await saveRecipe(updated)
    await load()
  }, [recipes, load])

  const removeRecipe = useCallback(async (id: string) => {
    await deleteRecipe(id)
    await load()
  }, [load])

  return { recipes, loading, addRecipe, updateRecipe, removeRecipe, reload: load }
}
