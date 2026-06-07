import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Clock, Users, Edit, Trash2, Star, ExternalLink, ChefHat, FlaskConical, RefreshCw, ChevronDown, ChevronUp, Minus, Plus, X } from 'lucide-react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { getRecipeById, deleteRecipe, saveRecipe, clearNutritionCache } from '@/db/database'
import type { Recipe, RecipeNutrition } from '@/types/recipe'
import { calculateRecipeNutrition } from '@/lib/nutritionService'
import { Button } from '@/components/ui/button'
import { getRecipeMealTypes } from '@/components/FilterPanel'

function TagEditor({ recipe, onUpdate }: { recipe: Recipe; onUpdate: (r: Recipe) => void }) {
  const [tagInput, setTagInput] = useState('')

  const addTag = async (raw: string) => {
    const trimmed = raw.trim().toLowerCase()
    if (!trimmed || recipe.tags.includes(trimmed)) return
    const updated = { ...recipe, tags: [...recipe.tags, trimmed] }
    await saveRecipe(updated)
    onUpdate(updated)
  }

  const removeTag = async (tag: string) => {
    const updated = { ...recipe, tags: recipe.tags.filter(t => t !== tag) }
    await saveRecipe(updated)
    onUpdate(updated)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(tagInput)
      setTagInput('')
    } else if (e.key === 'Backspace' && !tagInput && recipe.tags.length > 0) {
      removeTag(recipe.tags[recipe.tags.length - 1])
    }
  }

  return (
    <div className="flex flex-wrap gap-1.5 mb-3 items-center">
      {recipe.tags.map(tag => (
        <span key={tag} className="inline-flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-full px-2.5 py-0.5 text-sm font-medium">
          {tag}
          <button onClick={() => removeTag(tag)} className="hover:text-red-500 transition-colors ml-0.5">
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <input
        value={tagInput}
        onChange={e => setTagInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => { if (tagInput.trim()) { addTag(tagInput); setTagInput('') } }}
        placeholder={recipe.tags.length === 0 ? 'Tilføj tag...' : '+ tag'}
        className="text-sm bg-transparent border-none outline-none text-zinc-400 dark:text-zinc-500 placeholder:text-zinc-300 dark:placeholder:text-zinc-600 min-w-[70px]"
      />
    </div>
  )
}

function NutritionStat({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
        {value}<span className="text-sm font-normal text-zinc-500 ml-0.5">{unit}</span>
      </span>
      <span className="text-xs text-zinc-500 dark:text-zinc-400">{label}</span>
    </div>
  )
}

function scaleNutrition(facts: import('@/types/recipe').NutritionFacts, factor: number) {
  const r = (n: number) => Math.round(n * factor * 10) / 10
  return { kcal: Math.round(facts.kcal * factor), protein: r(facts.protein), carbs: r(facts.carbs), fat: r(facts.fat) }
}

function NutritionPanel({
  nutrition,
  calcState,
  onCalculate,
  scaleFactor,
  servings,
}: {
  nutrition: RecipeNutrition | undefined
  calcState: 'idle' | 'loading' | 'done' | 'error'
  onCalculate: (forceRefresh?: boolean) => void
  scaleFactor: number
  servings: number
}) {
  const [showDetails, setShowDetails] = useState(false)
  if (calcState === 'loading') {
    return (
      <div className="flex items-center gap-3 py-4 px-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 text-sm text-zinc-500">
        <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
        Slår op i Open Food Facts...
      </div>
    )
  }

  if (nutrition && calcState === 'done') {
    const scaled = scaleNutrition(nutrition.total, scaleFactor)
    const scaledGrams = Math.round(nutrition.totalGrams * scaleFactor)
    const isScaled = scaleFactor !== 1

    return (
      <div className="rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 bg-emerald-50 dark:bg-emerald-950/30 border-b border-emerald-100 dark:border-emerald-900/50 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            Næringsinhold
          </span>
          <button
            onClick={() => onCalculate(true)}
            title="Genberegn"
            className="p-1 rounded-lg text-zinc-400 hover:text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Hele retten (skaleret) */}
        <div className="px-4 pt-3 pb-1">
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-2">
            {isScaled ? `${servings} portioner` : 'Hele retten'}
            {scaledGrams > 0 && ` (ca. ${scaledGrams} g)`}
            {isScaled && <span className="text-emerald-500 ml-1">↕ skaleret</span>}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <NutritionStat label="Kalorier" value={scaled.kcal} unit="kcal" />
            <NutritionStat label="Protein" value={scaled.protein} unit="g" />
            <NutritionStat label="Kulhydrat" value={scaled.carbs} unit="g" />
            <NutritionStat label="Fedt" value={scaled.fat} unit="g" />
          </div>
        </div>

        {/* Divider */}
        <div className="mx-4 my-3 border-t border-zinc-200 dark:border-zinc-700" />

        {/* Pr. portion */}
        <div className="px-4 pb-1">
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-2">Pr. portion ({nutrition.servings} portioner i alt)</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <NutritionStat label="Kalorier" value={Math.round(nutrition.total.kcal / nutrition.servings)} unit="kcal" />
            <NutritionStat label="Protein" value={Math.round(nutrition.total.protein / nutrition.servings * 10) / 10} unit="g" />
            <NutritionStat label="Kulhydrat" value={Math.round(nutrition.total.carbs / nutrition.servings * 10) / 10} unit="g" />
            <NutritionStat label="Fedt" value={Math.round(nutrition.total.fat / nutrition.servings * 10) / 10} unit="g" />
          </div>
        </div>

        {/* Divider */}
        <div className="mx-4 my-3 border-t border-zinc-200 dark:border-zinc-700" />

        {/* Pr. 100g */}
        <div className="px-4 pb-3">
          <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-2">Pr. 100 g</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <NutritionStat label="Kalorier" value={nutrition.per100g.kcal} unit="kcal" />
            <NutritionStat label="Protein" value={nutrition.per100g.protein} unit="g" />
            <NutritionStat label="Kulhydrat" value={nutrition.per100g.carbs} unit="g" />
            <NutritionStat label="Fedt" value={nutrition.per100g.fat} unit="g" />
          </div>
        </div>

        {/* Detalje-knap */}
        <div className="border-t border-zinc-200 dark:border-zinc-700">
          <button
            onClick={() => setShowDetails(v => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors"
          >
            <span>Vis beregning per ingrediens</span>
            {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showDetails && (
            <div className="px-4 pb-4 overflow-x-auto">
              <table className="w-full min-w-[460px] text-xs border-collapse">
                <thead>
                  <tr className="text-zinc-400 dark:text-zinc-500 border-b border-zinc-200 dark:border-zinc-700">
                    <th className="text-left py-1.5 font-medium">Ingrediens</th>
                    <th className="text-right py-1.5 font-medium pr-2">g</th>
                    <th className="text-right py-1.5 font-medium pr-2">kcal</th>
                    <th className="text-right py-1.5 font-medium pr-2">prot</th>
                    <th className="text-right py-1.5 font-medium pr-2">kulh</th>
                    <th className="text-right py-1.5 font-medium pr-2">fedt</th>
                    <th className="text-left py-1.5 font-medium text-zinc-300 dark:text-zinc-600">match</th>
                  </tr>
                </thead>
                <tbody>
                  {nutrition.details.map((d, i) => {
                    const missing = !d.matchedKey
                    const noGrams = d.matchedKey && d.grams === 0
                    return (
                      <tr key={i} className={`border-b border-zinc-100 dark:border-zinc-800/50 ${missing ? 'text-red-400 dark:text-red-500' : noGrams ? 'text-zinc-400 dark:text-zinc-500' : 'text-zinc-700 dark:text-zinc-300'}`}>
                        <td className="py-1.5 pr-2">
                          <div>{d.name}</div>
                          {(d.amount || d.unit) && (
                            <div className="text-zinc-400 dark:text-zinc-600">{d.amount} {d.unit}</div>
                          )}
                        </td>
                        <td className="text-right py-1.5 pr-2 tabular-nums">
                          {d.grams > 0 ? d.grams : <span className="text-zinc-300 dark:text-zinc-600">—</span>}
                        </td>
                        <td className="text-right py-1.5 pr-2 tabular-nums">{missing ? '?' : d.kcal}</td>
                        <td className="text-right py-1.5 pr-2 tabular-nums">{missing ? '?' : d.protein}</td>
                        <td className="text-right py-1.5 pr-2 tabular-nums">{missing ? '?' : d.carbs}</td>
                        <td className="text-right py-1.5 pr-2 tabular-nums">{missing ? '?' : d.fat}</td>
                        <td className="py-1.5 text-zinc-400 dark:text-zinc-500 italic">
                          {missing
                            ? <span className="text-red-400 not-italic font-medium">ikke fundet</span>
                            : noGrams
                              ? <span className="text-zinc-300 dark:text-zinc-600">—</span>
                              : d.matchedKey}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="font-semibold text-zinc-700 dark:text-zinc-300 border-t border-zinc-300 dark:border-zinc-600">
                    <td className="pt-2">Total</td>
                    <td className="text-right pt-2 pr-2">{nutrition.totalGrams}</td>
                    <td className="text-right pt-2 pr-2">{nutrition.total.kcal}</td>
                    <td className="text-right pt-2 pr-2">{nutrition.total.protein}</td>
                    <td className="text-right pt-2 pr-2">{nutrition.total.carbs}</td>
                    <td className="text-right pt-2 pr-2">{nutrition.total.fat}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={() => onCalculate()}
      className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 text-sm text-zinc-500 dark:text-zinc-400 hover:border-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
    >
      <FlaskConical className="w-4 h-4" />
      Beregn næringsinhold
    </button>
  )
}

export function RecipeDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [calcState, setCalcState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [localServings, setLocalServings] = useState<number | null>(null)

  // Portioner der vises — falder tilbage til opskriftens egne portioner
  const servings = localServings ?? recipe?.servings ?? 1
  const scaleFactor = recipe ? servings / (recipe.servings || 1) : 1

  useEffect(() => {
    if (!id) return
    getRecipeById(id).then(raw => {
      if (raw) {
        // Ryd gammel nutrition-data der mangler per100g (fra tidligere format)
        const r = (raw.nutrition && !raw.nutrition.per100g)
          ? { ...raw, nutrition: undefined }
          : raw
        if (r !== raw) saveRecipe(r)
        setRecipe(r)
        if (r.nutrition) setCalcState('done')
      } else {
        setRecipe(null)
      }
      setLoading(false)
    })
  }, [id])

  const handleCalculateNutrition = async (forceRefresh = false) => {
    if (!recipe) return
    setCalcState('loading')
    try {
      if (forceRefresh) await clearNutritionCache()
      const nutrition = await calculateRecipeNutrition(recipe)
      const updated = { ...recipe, nutrition }
      await saveRecipe(updated)
      setRecipe(updated)
      setCalcState('done')
      toast.success('Næringsinhold beregnet')
    } catch {
      setCalcState('error')
      toast.error('Kunne ikke beregne næringsinhold')
    }
  }

  const handleRate = async (n: 1|2|3|4|5) => {
    if (!recipe) return
    const newRating = recipe.rating === n ? undefined : n
    const updated = { ...recipe, rating: newRating, updatedAt: Date.now() }
    await saveRecipe(updated)
    setRecipe(updated)
    toast.success(newRating ? `Bedømt ${newRating} ★` : 'Bedømmelse fjernet')
  }

  const handleDelete = async () => {
    if (!recipe) return
    if (!confirmDelete) { setConfirmDelete(true); return }
    await deleteRecipe(recipe.id)
    toast.success('Opskrift slettet')
    navigate('/')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!recipe) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col items-center justify-center gap-4">
        <p className="text-zinc-500">Opskrift ikke fundet</p>
        <Link to="/"><Button variant="outline">Gå til forsiden</Button></Link>
      </div>
    )
  }

  const totalTime = recipe.prepTime + recipe.cookTime

  function scaleAmount(amount: string, factor: number): string {
    if (!amount.trim() || factor === 1) return amount
    // Erstat brøker med decimaler
    const normalized = amount
      .replace('½', '0.5').replace('¼', '0.25').replace('¾', '0.75')
      .replace('⅓', '0.333').replace('⅔', '0.667')
      .replace(',', '.')
    const fractionMatch = normalized.match(/^(\d+)\/(\d+)$/)
    const mixedMatch = normalized.match(/^(\d+)\s+([\d.]+)$/)
    let num: number
    if (fractionMatch) num = parseInt(fractionMatch[1]) / parseInt(fractionMatch[2])
    else if (mixedMatch) num = parseFloat(mixedMatch[1]) + parseFloat(mixedMatch[2])
    else num = parseFloat(normalized)
    if (isNaN(num)) return amount
    const scaled = num * factor
    // Vis som heltal hvis muligt, ellers 1-2 decimaler
    if (scaled === Math.round(scaled)) return String(Math.round(scaled))
    if (Math.round(scaled * 2) === scaled * 2) {
      // Er en halv — vis med ½
      const whole = Math.floor(scaled)
      return whole > 0 ? `${whole}½` : '½'
    }
    return (Math.round(scaled * 10) / 10).toString().replace('.', ',')
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Tilbage */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Tilbage</span>
        </button>

        {/* Billede */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl overflow-hidden mb-6 bg-gradient-to-br from-emerald-50 to-teal-100 dark:from-emerald-950 dark:to-teal-900 h-72 flex items-center justify-center"
        >
          {recipe.image ? (
            <img src={recipe.image} alt={recipe.title} className="w-full h-full object-cover" />
          ) : (
            <ChefHat className="w-20 h-20 text-emerald-300 dark:text-emerald-700" />
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6 shadow-sm"
        >
          {/* Titel + handlinger */}
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">{recipe.title}</h1>
              <div className="flex gap-0.5 mb-2 group/stars" title="Klik for at bedømme">
                {([1,2,3,4,5] as const).map(n => (
                  <button key={n} type="button" onClick={() => handleRate(n)} className="transition-transform hover:scale-125">
                    <Star className={`w-5 h-5 transition-colors ${
                      recipe.rating && n <= recipe.rating
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-zinc-300 dark:text-zinc-600 group-hover/stars:text-yellow-200'
                    }`} />
                  </button>
                ))}
                {!recipe.rating && (
                  <span className="text-xs text-zinc-400 ml-1 self-center opacity-0 group-hover/stars:opacity-100 transition-opacity">Bedøm opskriften</span>
                )}
              </div>
              {recipe.description && (
                <p className="text-zinc-500 dark:text-zinc-400">{recipe.description}</p>
              )}
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Link to={`/recipe/${recipe.id}/edit`}>
                <Button variant="outline" size="icon-sm">
                  <Edit className="w-4 h-4" />
                </Button>
              </Link>
              <Button
                variant={confirmDelete ? 'destructive' : 'outline'}
                size="icon-sm"
                onClick={handleDelete}
                title={confirmDelete ? 'Klik igen for at bekræfte' : 'Slet opskrift'}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Tags — inline editor */}
          <TagEditor recipe={recipe} onUpdate={setRecipe} />

          {/* Måltidstyper */}
          {(() => {
            const mealTypes = getRecipeMealTypes(recipe)
            if (mealTypes.length === 0) return null
            const colorClasses: Record<string, string> = {
              purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
              lime:   'bg-lime-100 dark:bg-lime-900/30 text-lime-700 dark:text-lime-300',
              amber:  'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
              yellow: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300',
              sky:    'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300',
              red:    'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
              orange: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
              green:  'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
              blue:   'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
            }
            return (
              <div className="flex flex-wrap gap-1.5 mb-5">
                {mealTypes.map(mt => (
                  <span
                    key={mt.id}
                    title={mt.label}
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClasses[mt.color]}`}
                  >
                    {mt.emoji} {mt.label}
                  </span>
                ))}
              </div>
            )
          })()}

          {/* Metadata */}
          <div className="flex flex-wrap gap-4 py-4 border-y border-zinc-100 dark:border-zinc-800 mb-6">
            {totalTime > 0 && (
              <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                <Clock className="w-4 h-4 text-emerald-500" />
                <span><strong>{totalTime} min</strong> total</span>
              </div>
            )}
            {recipe.prepTime > 0 && (
              <div className="text-sm text-zinc-500 dark:text-zinc-500">
                Forberedelse: {recipe.prepTime} min
              </div>
            )}
            {recipe.cookTime > 0 && (
              <div className="text-sm text-zinc-500 dark:text-zinc-500">
                Tilberedning: {recipe.cookTime} min
              </div>
            )}
            {recipe.servings > 0 && (
              <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                <Users className="w-4 h-4 text-emerald-500" />
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setLocalServings(Math.max(1, servings - 1))}
                    className="w-6 h-6 flex items-center justify-center rounded-full border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="tabular-nums font-bold min-w-[2ch] text-center">{servings}</span>
                  <button
                    onClick={() => setLocalServings(servings + 1)}
                    className="w-6 h-6 flex items-center justify-center rounded-full border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                  <span>portioner</span>
                  {localServings !== null && localServings !== recipe.servings && (
                    <button
                      onClick={() => setLocalServings(null)}
                      className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 underline ml-1"
                    >
                      nulstil
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Ingredienser */}
          {recipe.ingredients.length > 0 && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Ingredienser</h2>
              <div className="space-y-1.5">
                {recipe.ingredients.map((ing, i) =>
                  ing.isHeader ? (
                    ing.name.trim() ? (
                      // Overskrift med tekst
                      <div key={i} className="flex items-center gap-3 pt-3 pb-0.5 first:pt-0">
                        <span className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                          {ing.name}
                        </span>
                        <div className="flex-1 h-px bg-emerald-200 dark:bg-emerald-800" />
                      </div>
                    ) : (
                      // Tom overskrift = mellemrum med streg
                      <div key={i} className="flex items-center gap-3 py-2">
                        <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-700" />
                      </div>
                    )
                  ) : (
                    // Ingrediens-kort
                    <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                      <span className="text-zinc-800 dark:text-zinc-200 text-sm flex-1">{ing.name}</span>
                      {(ing.amount || ing.unit) && (
                        <span className="text-zinc-400 dark:text-zinc-500 text-sm font-medium flex-shrink-0">
                          {scaleAmount(ing.amount, scaleFactor)} {ing.unit}
                        </span>
                      )}
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          {/* Næringsinhold */}
          {recipe.ingredients.length > 0 && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Næringsinhold</h2>
              <NutritionPanel
                nutrition={recipe.nutrition}
                calcState={calcState}
                onCalculate={(force) => handleCalculateNutrition(force)}
                scaleFactor={scaleFactor}
                servings={servings}
              />
            </div>
          )}

          {/* Fremgangsmåde */}
          {recipe.instructions && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Fremgangsmåde</h2>
              <div className="bg-zinc-50 dark:bg-zinc-800/40 rounded-xl p-4">
                <p className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
                  {recipe.instructions}
                </p>
              </div>
            </div>
          )}

          {/* Kilde */}
          {recipe.sourceUrl && (
            <a
              href={recipe.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Se original opskrift
            </a>
          )}
        </motion.div>
      </div>
    </div>
  )
}
