import { useState } from 'react'
import { Link2, Loader2, ArrowRight, AlertCircle, Info } from 'lucide-react'
import { importFromUrl, urlImportAvailable } from '@/lib/recipeImporter'
import type { Recipe } from '@/types/recipe'

interface UrlImporterProps {
  onImport: (data: Partial<Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>>) => void
}

export function UrlImporter({ onImport }: UrlImporterProps) {
  // URL-import virker kun når den lokale proxy kører (dev på PC). På den hostede PWA
  // (mobil/tablet) vises i stedet en kort note om at oprette manuelt eller importere en fil.
  if (!urlImportAvailable) {
    return (
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 p-4">
        <div className="flex items-start gap-2.5 text-sm text-zinc-500 dark:text-zinc-400">
          <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-zinc-400" />
          <p>
            Automatisk import fra et link virker kun i desktop-versionen. Opret opskriften manuelt
            nedenfor — eller overfør den fra din PC via <strong>⚙ Indstillinger → Eksporter/Importér</strong>.
          </p>
        </div>
      </div>
    )
  }

  return <UrlImporterForm onImport={onImport} />
}

function UrlImporterForm({ onImport }: UrlImporterProps) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleImport = async () => {
    if (!url.trim()) return
    setLoading(true)
    setError('')
    const result = await importFromUrl(url.trim())
    setLoading(false)
    if (result.ok) {
      onImport(result.data)
      setUrl('')
    } else {
      setError(result.error)
    }
  }

  return (
    <div className="rounded-2xl border-2 border-dashed border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
          <Link2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Importer fra link</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Indsæt et link til en opskrift og vi udfylder formularen automatisk</p>
        </div>
      </div>

      <div className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={e => { setUrl(e.target.value); setError('') }}
          onKeyDown={e => e.key === 'Enter' && handleImport()}
          placeholder="https://www.dk-kogebogen.dk/opskrifter/..."
          disabled={loading}
          className="flex-1 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
        />
        <button
          onClick={handleImport}
          disabled={loading || !url.trim()}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors flex-shrink-0"
        >
          {loading
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Henter...</>
            : <><ArrowRight className="w-4 h-4" /> Hent</>
          }
        </button>
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-950/30 rounded-xl px-3 py-2.5">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}
