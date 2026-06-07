import Dexie, { type Table } from 'dexie'
import type { Recipe, MealPlan, NutritionFacts } from '@/types/recipe'

export interface CachedIngredientNutrition {
  name: string           // normaliseret (lowercase, trim) — primærnøgle
  facts: NutritionFacts  // per 100g
  fetchedAt: number
}

class RecipeDatabase extends Dexie {
  recipes!: Table<Recipe>
  mealPlans!: Table<MealPlan>
  nutritionCache!: Table<CachedIngredientNutrition>

  constructor() {
    super('RecipeApp')
    this.version(1).stores({
      recipes: 'id, title, createdAt, updatedAt, rating',
      mealPlans: '++id, weekStart',
    })
    this.version(2).stores({
      recipes: 'id, title, createdAt, updatedAt, rating',
      mealPlans: '++id, weekStart',
      nutritionCache: 'name',
    })
  }
}

export const db = new RecipeDatabase()

// Recipe CRUD
export async function getAllRecipes(): Promise<Recipe[]> {
  return db.recipes.orderBy('createdAt').reverse().toArray()
}

export async function getRecipeById(id: string): Promise<Recipe | undefined> {
  return db.recipes.get(id)
}

export async function saveRecipe(recipe: Recipe): Promise<void> {
  await db.recipes.put(recipe)
}

export async function deleteRecipe(id: string): Promise<void> {
  await db.recipes.delete(id)
}

// Nutrition cache
export async function clearNutritionCache(): Promise<void> {
  await db.nutritionCache.clear()
}

// --- Export / Import ---

export interface AppExport {
  version: number
  exportedAt: string
  recipes: Recipe[]
  mealPlans: MealPlan[]
}

export async function exportData(): Promise<void> {
  const [recipes, mealPlans] = await Promise.all([
    db.recipes.toArray(),
    db.mealPlans.toArray(),
  ])
  const payload: AppExport = {
    version: 1,
    exportedAt: new Date().toISOString(),
    recipes,
    mealPlans,
  }
  const json = JSON.stringify(payload, null, 2)
  const filename = `opskrifter-${new Date().toISOString().slice(0, 10)}.json`

  // Mobil/tablet: brug systemets delefunktion (Mail, AirDrop, Drive, Beskeder...) hvis muligt,
  // så filen hurtigt kan sendes til en anden enhed. Falder tilbage til download på desktop.
  const file = new File([json], filename, { type: 'application/json' })
  const nav = navigator as Navigator & {
    canShare?: (data?: ShareData) => boolean
    share?: (data?: ShareData) => Promise<void>
  }
  if (nav.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], title: 'Opskrifter', text: 'Mine eksporterede opskrifter' })
      return
    } catch (err) {
      // Brugeren annullerede delingen — gør ingenting (undgå også at downloade).
      if (err instanceof DOMException && err.name === 'AbortError') return
      // Andre fejl: fald tilbage til download nedenfor.
    }
  }

  // Desktop / fallback: download som fil
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function importData(file: File): Promise<{ recipes: number; mealPlans: number }> {
  const text = await file.text()
  const payload: AppExport = JSON.parse(text)

  if (!Array.isArray(payload.recipes)) throw new Error('Ugyldigt filformat — mangler recipes')

  await db.recipes.bulkPut(payload.recipes)
  if (Array.isArray(payload.mealPlans) && payload.mealPlans.length > 0) {
    await db.mealPlans.bulkPut(payload.mealPlans)
  }
  return {
    recipes: payload.recipes.length,
    mealPlans: payload.mealPlans?.length ?? 0,
  }
}

// MealPlan CRUD
export async function getMealPlanByWeek(weekStart: string): Promise<MealPlan | undefined> {
  return db.mealPlans.where('weekStart').equals(weekStart).first()
}

export async function saveMealPlan(plan: MealPlan): Promise<void> {
  const existing = await getMealPlanByWeek(plan.weekStart)
  if (existing?.id) {
    await db.mealPlans.update(existing.id, { ...plan })
  } else {
    await db.mealPlans.add(plan)
  }
}
