import { HashRouter, Routes, Route, NavLink, Link, useLocation } from 'react-router-dom'
import { Toaster, toast } from 'sonner'
import { useState, useEffect, useRef } from 'react'
import { Home } from '@/pages/Home'
import { NewRecipe } from '@/pages/NewRecipe'
import { RecipeDetail } from '@/pages/RecipeDetail'
import { EditRecipe } from '@/pages/EditRecipe'
import { MealPlan } from '@/pages/MealPlan'
import { exportData, importData } from '@/db/database'
import { CalendarDays, Moon, Sun, UtensilsCrossed, Plus, Settings, Download, Upload } from 'lucide-react'

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150 ${
    isActive
      ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
      : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-800 dark:hover:text-zinc-200'
  }`

function Nav() {
  const [dark, setDark] = useState(() => localStorage.getItem('theme') !== 'light')
  const [showSettings, setShowSettings] = useState(false)
  const settingsRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const location = useLocation()

  const showAddBtn = location.pathname === '/' || location.pathname === '/mealplan'

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  // Luk dropdown ved klik udenfor
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleExport = async () => {
    try {
      await exportData()
      toast.success('Data eksporteret')
    } catch {
      toast.error('Eksport fejlede')
    }
    setShowSettings(false)
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const result = await importData(file)
      toast.success(`Importeret ${result.recipes} opskrifter og ${result.mealPlans} madplaner`)
      window.location.reload()
    } catch {
      toast.error('Import fejlede — kontroller at filen er gyldig')
    }
    e.target.value = ''
    setShowSettings(false)
  }

  return (
    <nav className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 px-4 sticky top-0 z-20 pt-[env(safe-area-inset-top)]">
      <div className="max-w-6xl mx-auto flex items-center h-14 gap-2">

        {/* Logo — klikbart til forsiden */}
        <Link
          to="/"
          className="flex items-center gap-2 mr-4 rounded-xl px-2 py-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors group"
          title="Gå til forsiden"
        >
          <span className="text-2xl group-hover:scale-110 transition-transform">🍳</span>
          <span className="font-bold text-zinc-900 dark:text-zinc-100 text-base hidden sm:block">
            Opskrifter
          </span>
        </Link>

        {/* Navigation — skjult på mobil (erstattes af bund-navigationen) */}
        <div className="hidden md:flex items-center gap-2">
          {/* Separator */}
          <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-700 mr-2" />

          <NavLink to="/" end className={navLinkClass}>
            <UtensilsCrossed className="w-4 h-4" />
            <span>Mine opskrifter</span>
          </NavLink>

          <NavLink to="/mealplan" className={navLinkClass}>
            <CalendarDays className="w-4 h-4" />
            <span>Madplan</span>
          </NavLink>
        </div>

        {/* Højre side */}
        <div className="ml-auto flex items-center gap-2">
          {showAddBtn && (
            <Link
              to="/new"
              className="hidden md:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors shadow-sm hover:shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>Ny opskrift</span>
            </Link>
          )}

          <button
            onClick={() => setDark(d => !d)}
            className="p-2 rounded-xl text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
            title={dark ? 'Skift til lys tilstand' : 'Skift til mørk tilstand'}
          >
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Settings dropdown */}
          <div className="relative" ref={settingsRef}>
            <button
              onClick={() => setShowSettings(v => !v)}
              className="p-2 rounded-xl text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
              title="Indstillinger"
            >
              <Settings className="w-4 h-4" />
            </button>

            {showSettings && (
              <div className="absolute right-0 top-full mt-2 w-52 max-w-[calc(100vw-1.5rem)] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-xl z-50 overflow-hidden">
                <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800">
                  <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Data</p>
                </div>
                <button
                  onClick={handleExport}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  <Download className="w-4 h-4 text-zinc-400" />
                  Eksporter opskrifter
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  <Upload className="w-4 h-4 text-zinc-400" />
                  Importér opskrifter
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="hidden"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}

const bottomNavClass = ({ isActive }: { isActive: boolean }) =>
  `flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-[11px] font-medium transition-colors ${
    isActive
      ? 'text-emerald-600 dark:text-emerald-400'
      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
  }`

function BottomNav() {
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 dark:bg-zinc-900/95 backdrop-blur border-t border-zinc-200 dark:border-zinc-800 pb-[env(safe-area-inset-bottom)]">
      <div className="flex items-stretch h-14">
        <NavLink to="/" end className={bottomNavClass}>
          <UtensilsCrossed className="w-5 h-5" />
          <span>Opskrifter</span>
        </NavLink>
        <NavLink to="/mealplan" className={bottomNavClass}>
          <CalendarDays className="w-5 h-5" />
          <span>Madplan</span>
        </NavLink>
        <NavLink to="/new" className={bottomNavClass}>
          <Plus className="w-5 h-5" />
          <span>Ny</span>
        </NavLink>
      </div>
    </nav>
  )
}

export default function App() {
  return (
    <HashRouter>
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 pb-16 md:pb-0">
        <Nav />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/new" element={<NewRecipe />} />
          <Route path="/recipe/:id" element={<RecipeDetail />} />
          <Route path="/recipe/:id/edit" element={<EditRecipe />} />
          <Route path="/mealplan" element={<MealPlan />} />
        </Routes>
        <BottomNav />
        <Toaster position="bottom-right" richColors />
      </div>
    </HashRouter>
  )
}
