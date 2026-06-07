import { useState, useRef } from 'react'
import { Plus, Trash2, GripVertical, Upload, X, Star, BookText, Heading2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { Recipe, Ingredient } from '@/types/recipe'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

type RecipeFormData = Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>

// --- Sortable ingrediens-række ---
interface SortableRowProps {
  id: string
  ing: Ingredient
  index: number
  onChange: (field: keyof Ingredient, val: string) => void
  onRemove: () => void
}

function SortableIngredientRow({ id, ing, onChange, onRemove }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  }

  const inputClass = 'rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2.5 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 w-full'

  if (ing.isHeader) {
    return (
      <div ref={setNodeRef} style={style} className="flex gap-2 items-center pt-1">
        <button type="button" className="cursor-grab active:cursor-grabbing touch-none flex-shrink-0" {...attributes} {...listeners}>
          <GripVertical className="w-4 h-4 text-emerald-400" />
        </button>
        <Heading2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
        <input
          placeholder="Overskrift, fx. Sauce"
          value={ing.name}
          onChange={e => onChange('name', e.target.value)}
          className="flex-1 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 text-sm font-semibold text-emerald-800 dark:text-emerald-300 placeholder:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <button type="button" onClick={onRemove} className="flex items-center justify-center w-9 h-9 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return (
    <div ref={setNodeRef} style={style} className="grid gap-2 items-center grid-cols-[22px_60px_60px_1fr_32px] sm:grid-cols-[28px_80px_80px_1fr_36px]">
      <button type="button" className="cursor-grab active:cursor-grabbing touch-none flex items-center justify-center" {...attributes} {...listeners}>
        <GripVertical className="w-4 h-4 text-zinc-300 hover:text-zinc-500 transition-colors" />
      </button>
      <input placeholder="Mængde" value={ing.amount} onChange={e => onChange('amount', e.target.value)} className={inputClass} />
      <input placeholder="Enhed" value={ing.unit} onChange={e => onChange('unit', e.target.value)} className={inputClass} />
      <input placeholder="Ingrediens" value={ing.name} onChange={e => onChange('name', e.target.value)} className={inputClass} />
      <button type="button" onClick={onRemove} className="flex items-center justify-center w-9 h-9 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  )
}

interface RecipeFormProps {
  initial?: Partial<RecipeFormData>
  onSubmit: (data: RecipeFormData) => Promise<void>
  onCancel?: () => void
  submitLabel?: string
}

const emptyIngredient = (): Ingredient => ({ name: '', amount: '', unit: '' })

export function RecipeForm({ initial, onSubmit, onCancel, submitLabel = 'Gem opskrift' }: RecipeFormProps) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [ingredients, setIngredients] = useState<(Ingredient & { _id: string })[]>(
    (initial?.ingredients?.length ? initial.ingredients : [emptyIngredient()])
      .map((ing, i) => ({ ...ing, _id: `ing-${i}-${Date.now()}` }))
  )

  // distance-constraint: man skal trække grebet ~8px før drag starter — så et almindeligt
  // tryk/tap (og scroll på touch) ikke utilsigtet starter en flytning.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setIngredients(prev => {
        const oldIndex = prev.findIndex(i => i._id === active.id)
        const newIndex = prev.findIndex(i => i._id === over.id)
        return arrayMove(prev, oldIndex, newIndex)
      })
    }
  }
  const [instructions, setInstructions] = useState(initial?.instructions ?? '')
  const [tags, setTags] = useState<string[]>(initial?.tags ?? [])
  const [tagInput, setTagInput] = useState('')
  const [servings, setServings] = useState(initial?.servings ?? 4)
  const [prepTime, setPrepTime] = useState(initial?.prepTime ?? 0)
  const [cookTime, setCookTime] = useState(initial?.cookTime ?? 0)
  const [image, setImage] = useState<string | undefined>(initial?.image)
  const [sourceUrl, setSourceUrl] = useState(initial?.sourceUrl ?? '')
  const [rating, setRating] = useState<Recipe['rating']>(initial?.rating)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Ingredienser
  const updateIngredient = (i: number, field: keyof Ingredient, val: string) => {
    setIngredients(prev => prev.map((ing, idx) => idx === i ? { ...ing, [field]: val } : ing))
  }
  const addIngredient = () => setIngredients(prev => [...prev, { ...emptyIngredient(), _id: `ing-${Date.now()}` }])
  const addHeader = () => setIngredients(prev => [...prev, { name: '', amount: '', unit: '', isHeader: true, _id: `hdr-${Date.now()}` }])
  const removeIngredient = (i: number) => setIngredients(prev => prev.filter((_, idx) => idx !== i))

  // Tags
  const addTag = () => {
    const t = tagInput.trim().toLowerCase()
    if (t && !tags.includes(t)) setTags(prev => [...prev, t])
    setTagInput('')
  }
  const removeTag = (t: string) => setTags(prev => prev.filter(x => x !== t))

  // Billede
  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setImage(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    await onSubmit({
      title,
      description,
      ingredients: ingredients.filter(i => i.isHeader || i.name.trim()).map(({ _id: _, ...rest }) => rest),
      instructions,
      tags,
      servings,
      prepTime,
      cookTime,
      image,
      sourceUrl: sourceUrl || undefined,
      rating,
      nutrition: undefined, // nulstil så det genberegnes efter redigering
    })
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Billede upload */}
      <div className="relative">
        {image ? (
          <div className="relative rounded-2xl overflow-hidden h-56 bg-zinc-100 dark:bg-zinc-800">
            <img src={image} alt="Opskrift" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => setImage(undefined)}
              className="absolute top-3 right-3 bg-black/50 text-white rounded-full p-1.5 hover:bg-black/70 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-full h-40 rounded-2xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 flex flex-col items-center justify-center gap-2 text-zinc-400 hover:border-emerald-500 hover:text-emerald-500 transition-colors"
          >
            <Upload className="w-8 h-8" />
            <span className="text-sm font-medium">Upload billede</span>
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" onChange={handleImage} className="hidden" />
      </div>

      {/* Titel */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Titel *</label>
        <Input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Fx. Spaghetti Bolognese"
          required
        />
      </div>

      {/* Beskrivelse */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Beskrivelse</label>
        <Textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Kort beskrivelse af opskriften..."
          rows={3}
        />
      </div>

      {/* Metadata-række */}
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Portioner</label>
          <Input type="number" min={1} value={servings} onChange={e => setServings(+e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Forberedelse (min)</label>
          <Input type="number" min={0} value={prepTime} onChange={e => setPrepTime(+e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Tilberedning (min)</label>
          <Input type="number" min={0} value={cookTime} onChange={e => setCookTime(+e.target.value)} />
        </div>
      </div>

      {/* Rating */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Bedømmelse</label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(rating === n ? undefined : n as Recipe['rating'])}
              className="p-1 transition-transform hover:scale-110"
            >
              <Star
                className={`w-6 h-6 transition-colors ${
                  rating && n <= rating
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'text-zinc-300 dark:text-zinc-600'
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Ingredienser */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Ingredienser</label>
        {/* Kolonneoverskrifter */}
        <div className="grid gap-2 grid-cols-[22px_60px_60px_1fr_32px] sm:grid-cols-[28px_80px_80px_1fr_36px]">
          <span />
          <span className="text-xs font-medium text-zinc-400 px-1">Mængde</span>
          <span className="text-xs font-medium text-zinc-400 px-1">Enhed</span>
          <span className="text-xs font-medium text-zinc-400 px-1">Ingrediens</span>
          <span />
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={ingredients.map(i => i._id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {ingredients.map((ing, i) => (
                <SortableIngredientRow
                  key={ing._id}
                  id={ing._id}
                  ing={ing}
                  index={i}
                  onChange={(field, val) => updateIngredient(i, field, val)}
                  onRemove={() => removeIngredient(i)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={addIngredient}>
            <Plus className="w-4 h-4" /> Tilføj ingrediens
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={addHeader}>
            <Heading2 className="w-4 h-4" /> Tilføj overskrift
          </Button>
        </div>
      </div>

      {/* Fremgangsmåde */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <BookText className="w-4 h-4 text-zinc-400" />
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Fremgangsmåde</label>
        </div>
        <Textarea
          value={instructions}
          onChange={e => setInstructions(e.target.value)}
          placeholder="Beskriv hvordan retten laves. Du kan selv sætte den op som du vil — brug linjeskift, nummerering eller punkter efter behov."
          rows={10}
          className="font-mono text-sm leading-relaxed"
        />
      </div>

      {/* Tags */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Tags</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {tags.map(tag => (
            <span key={tag} className="inline-flex items-center gap-1 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300 rounded-full px-3 py-1 text-sm">
              {tag}
              <button type="button" onClick={() => removeTag(tag)} className="hover:text-red-500 ml-1">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
            placeholder="Fx. vegetar, aftensmad, hurtig..."
            className="flex-1"
          />
          <Button type="button" variant="outline" onClick={addTag}>Tilføj</Button>
        </div>
      </div>

      {/* Kilde URL */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Kilde URL (valgfrit)</label>
        <Input
          value={sourceUrl}
          onChange={e => setSourceUrl(e.target.value)}
          placeholder="https://..."
          type="url"
        />
      </div>

      {/* Knapper */}
      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={saving} className="flex-1">
          {saving ? 'Gemmer...' : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Annuller
          </Button>
        )}
      </div>
    </form>
  )
}
