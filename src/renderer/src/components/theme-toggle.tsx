import { Button } from './ui/button'
import { cn } from '../lib/utils'

interface ThemeToggleProps {
  theme: 'light' | 'dark' | 'system'
  onThemeChange: (mode: 'light' | 'dark' | 'system') => void
}

const themes = [
  { value: 'light' as const, label: '☀️' },
  { value: 'dark' as const, label: '🌙' },
  { value: 'system' as const, label: '💻' }
]

export function ThemeToggle({ theme, onThemeChange }: ThemeToggleProps) {
  return (
    <div className="flex items-center gap-1 rounded-lg border p-1">
      {themes.map(t => (
        <button
          key={t.value}
          onClick={() => onThemeChange(t.value)}
          className={cn(
            'rounded-md px-2 py-1 text-sm transition-colors',
            theme === t.value
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
