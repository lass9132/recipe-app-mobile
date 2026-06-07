export interface NutritionFacts {
  kcal: number
  protein: number  // gram
  carbs: number    // gram
  fat: number      // gram
  fiber?: number   // gram
}

export interface IngredientNutritionDetail {
  name: string
  amount: string
  unit: string
  grams: number
  matchedKey: string | null  // kanonisk navn på det matchede entry, fx "olivenolie"
  kcal: number
  protein: number
  carbs: number
  fat: number
}

export interface RecipeNutrition {
  total: NutritionFacts
  per100g: NutritionFacts
  totalGrams: number
  details: IngredientNutritionDetail[]
  calculatedAt: number
  servings: number
  missing: string[]
}

export interface Ingredient {
  name: string
  amount: string
  unit: string
  isHeader?: boolean // Overskrift-række (fx "Sauce")
}

export interface Recipe {
  id: string
  title: string
  description: string
  ingredients: Ingredient[]
  instructions: string
  tags: string[]
  servings: number
  prepTime: number
  cookTime: number
  image?: string // base64 data URL
  sourceUrl?: string
  createdAt: number
  updatedAt: number
  rating?: 1 | 2 | 3 | 4 | 5
  nutrition?: RecipeNutrition
}

export type MealSlot = 'breakfast' | 'lunch' | 'dinner'

export interface DayMeals {
  breakfast?: string
  lunch?: string
  dinner?: string
}

export interface MealPlan {
  id?: number
  weekStart: string // YYYY-MM-DD
  days: Record<string, DayMeals>
}
