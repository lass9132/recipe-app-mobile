import * as SliderPrimitive from '@radix-ui/react-slider'
function cn(...classes: (string | undefined | false)[]) {
  return classes.filter(Boolean).join(' ')
}

interface SliderProps {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  className?: string
}

export function Slider({ value, onChange, min = 0, max = 180, step = 5, className }: SliderProps) {
  return (
    <SliderPrimitive.Root
      value={[value]}
      onValueChange={([v]) => onChange(v)}
      min={min}
      max={max}
      step={step}
      className={cn('relative flex items-center select-none touch-none w-full h-5', className)}
    >
      <SliderPrimitive.Track className="relative bg-zinc-200 dark:bg-zinc-700 rounded-full h-1.5 flex-1">
        <SliderPrimitive.Range className="absolute bg-blue-500 rounded-full h-full" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="block w-4 h-4 bg-white border-2 border-blue-500 rounded-full shadow focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 cursor-pointer hover:scale-110 transition-transform" />
    </SliderPrimitive.Root>
  )
}
