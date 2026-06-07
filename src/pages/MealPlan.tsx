import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Shuffle, ShoppingCart, X, Search, ChefHat } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { getMealPlanByWeek, saveMealPlan, getAllRecipes } from '@/db/database'
import type { Recipe, MealPlan as MealPlanType, MealSlot } from '@/types/recipe'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const DAYS = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag']
const SLOTS: { key: MealSlot; label: string; emoji: string }[] = [
  { key: 'dinner', label: 'Aftensmad', emoji: '🌙' },
]

function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function formatWeekStart(date: Date): string {
  return date.toISOString().split('T')[0]
}

function formatDisplayDate(weekStart: Date, dayIndex: number): string {
  const d = new Date(weekStart)
  d.setDate(d.getDate() + dayIndex)
  return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' })
}

export function MealPlan() {
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()))
  const [plan, setPlan] = useState<MealPlanType>({ weekStart: formatWeekStart(getMonday(new Date())), days: {} })
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [picking, setPicking] = useState<{ day: string; slot: MealSlot } | null>(null)
  const [pickSearch, setPickSearch] = useState('')
  const [showShopping, setShowShopping] = useState(false)

  useEffect(() => {
    getAllRecipes().then(setRecipes)
  }, [])

  useEffect(() => {
    const key = formatWeekStart(weekStart)
    getMealPlanByWeek(key).then(existing => {
      setPlan(existing ?? { weekStart: key, days: {} })
    })
  }, [weekStart])

  const changeWeek = (delta: number) => {
    setWeekStart(prev => {
      const d = new Date(prev)
      d.setDate(d.getDate() + delta * 7)
      return d
    })
  }

  const setSlot = async (day: string, slot: MealSlot, recipeId: string | undefined) => {
    const updated: MealPlanType = {
      ...plan,
      days: {
        ...plan.days,
        [day]: { ...plan.days[day], [slot]: recipeId },
      },
    }
    setPlan(updated)
    await saveMealPlan(updated)
    setPicking(null)
  }

  const randomize = async () => {
    if (recipes.length === 0) { toast.error('Ingen opskrifter at vælge fra'); return }
    const newDays: MealPlanType['days'] = {}
    DAYS.forEach(day => {
      newDays[day] = {
        dinner: recipes[Math.floor(Math.random() * recipes.length)]?.id,
      }
    })
    const updated: MealPlanType = { ...plan, days: newDays }
    setPlan(updated)
    await saveMealPlan(updated)
    toast.success('Madplan genereret! 🎲')
  }

  // Indkøbsliste
  const shoppingList = () => {
    const counts: Record<string, { amount: string; unit: string; count: number }> = {}
    DAYS.forEach(day => {
      const d = plan.days[day]
      if (!d) return
      Object.values(d).filter(Boolean).forEach(rid => {
        const r = recipes.find(r => r.id === rid)
        if (!r) return
        r.ingredients.forEach(ing => {
          const key = `${ing.name}__${ing.unit}`
          if (!counts[key]) counts[key] = { amount: ing.amount, unit: ing.unit, count: 0 }
          counts[key].count++
        })
      })
    })
    return Object.entries(counts).map(([key, val]) => ({
      name: key.split('__')[0],
      ...val,
    }))
  }

  const recipeById = (id?: string) => id ? recipes.find(r => r.id === id) : undefined
  const filteredRecipes = recipes.filter(r =>
    r.title.toLowerCase().includes(pickSearch.toLowerCase()) ||
    r.ingredients.some(i => i.name.toLowerCase().includes(pickSearch.toLowerCase()))
  )

  const weekLabel = `${formatDisplayDate(weekStart, 0)} – ${formatDisplayDate(weekStart, 6)}`

  // Et enkelt måltids-kort (genbruges af både desktop-gitter og mobil dagsliste)
  const slotCard = (day: string, slot: { key: MealSlot; label: string; emoji: string }) => {
    const r = recipeById(plan.days[day]?.[slot.key])
    return (
      <div
        key={slot.key}
        onClick={() => { setPicking({ day, slot: slot.key }); setPickSearch('') }}
        className={`rounded-xl border cursor-pointer transition-all duration-200 p-2 min-h-[72px] flex flex-col ${
          r
            ? 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 hover:border-emerald-400'
            : 'bg-zinc-100/50 dark:bg-zinc-800/30 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/10'
        }`}
      >
        <div className="text-[10px] font-medium text-zinc-400 dark:text-zinc-600 mb-1">{slot.emoji} {slot.label}</div>
        {r ? (
          <div className="flex items-start justify-between gap-1">
            <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200 line-clamp-2 flex-1">
              {r.title}
            </p>
            <button
              onClick={e => { e.stopPropagation(); setSlot(day, slot.key, undefined) }}
              className="text-zinc-300 hover:text-red-400 transition-colors flex-shrink-0 mt-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-[10px] text-zinc-400 dark:text-zinc-600">+ Vælg</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 sticky top-[calc(3.5rem_+_env(safe-area-inset-top))] z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => changeWeek(-1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 min-w-44 text-center">
              {weekLabel}
            </span>
            <Button variant="ghost" size="icon" onClick={() => changeWeek(1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={() => setShowShopping(true)}>
              <ShoppingCart className="w-4 h-4" /> Indkøbsliste
            </Button>
            <Button size="sm" onClick={randomize}>
              <Shuffle className="w-4 h-4" /> Generer uge
            </Button>
          </div>
        </div>
      </div>

      {/* Desktop: uge-gitter */}
      <div className="hidden md:block max-w-6xl mx-auto px-4 py-6 overflow-x-auto">
        <div className="grid grid-cols-7 gap-3 min-w-[700px]">
          {DAYS.map((day, di) => (
            <div key={day}>
              <div className="text-center mb-3">
                <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">{day.slice(0, 3)}</div>
                <div className="text-sm text-zinc-400 dark:text-zinc-600">{formatDisplayDate(weekStart, di)}</div>
              </div>
              <div className="space-y-2">
                {SLOTS.map(slot => slotCard(day, slot))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Mobil: lodret dagsliste */}
      <div className="md:hidden max-w-2xl mx-auto px-4 py-5 space-y-2">
        {DAYS.map((day, di) => (
          <div key={day} className="flex items-stretch gap-3">
            <div className="w-14 flex-shrink-0 flex flex-col justify-center text-center">
              <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">{day.slice(0, 3)}</div>
              <div className="text-[11px] text-zinc-400 dark:text-zinc-600">{formatDisplayDate(weekStart, di)}</div>
            </div>
            <div className="flex-1 space-y-2">
              {SLOTS.map(slot => slotCard(day, slot))}
            </div>
          </div>
        ))}
      </div>

      {/* Vælg opskrift modal */}
      <AnimatePresence>
        {picking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
            onClick={() => setPicking(null)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md max-h-[70vh] flex flex-col"
            >
              <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
                  Vælg opskrift
                </h3>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <Input
                    autoFocus
                    value={pickSearch}
                    onChange={e => setPickSearch(e.target.value)}
                    placeholder="Søg..."
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="overflow-y-auto flex-1 p-2">
                {filteredRecipes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-zinc-400">
                    <ChefHat className="w-8 h-8 mb-2" />
                    <p className="text-sm">Ingen opskrifter fundet</p>
                  </div>
                ) : (
                  filteredRecipes.map(r => (
                    <button
                      key={r.id}
                      onClick={() => setSlot(picking.day, picking.slot, r.id)}
                      className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center gap-3"
                    >
                      {r.image ? (
                        <img src={r.image} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" alt="" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                          <ChefHat className="w-5 h-5 text-emerald-500" />
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{r.title}</p>
                        <p className="text-xs text-zinc-400">{r.prepTime + r.cookTime} min · {r.servings} pers.</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Indkøbsliste modal */}
      <AnimatePresence>
        {showShopping && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
            onClick={() => setShowShopping(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md max-h-[70vh] flex flex-col"
            >
              <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-emerald-500" />
                  Indkøbsliste
                </h3>
                <button onClick={() => setShowShopping(false)}>
                  <X className="w-5 h-5 text-zinc-400 hover:text-zinc-600" />
                </button>
              </div>
              <div className="overflow-y-auto flex-1 p-4">
                {shoppingList().length === 0 ? (
                  <p className="text-zinc-400 text-sm text-center py-8">Ingen ingredienser i madplanen</p>
                ) : (
                  <ul className="space-y-2">
                    {shoppingList().map((item, i) => (
                      <li key={i} className="flex items-center gap-3 py-1.5 border-b border-zinc-50 dark:border-zinc-800 last:border-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                        <span className="text-sm text-zinc-500 w-20 flex-shrink-0">{item.amount} {item.unit}</span>
                        <span className="text-sm text-zinc-800 dark:text-zinc-200">{item.name}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
