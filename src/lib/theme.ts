import { useEffect, useState } from 'react'

export type Theme = 'system' | 'light' | 'dark'

const THEME_KEY = 'theme'
export const THEME_ORDER: Theme[] = ['system', 'light', 'dark']

function readTheme(): Theme {
  const stored = localStorage.getItem(THEME_KEY)
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system'
}

// 跟随系统时移除标记,交给 prefers-color-scheme;否则用 data-theme 强制覆盖。
export function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)
}

// 在 React 挂载前调用,避免主题闪烁。
export function initTheme() {
  applyTheme(readTheme())
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(readTheme)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  function setTheme(next: Theme) {
    localStorage.setItem(THEME_KEY, next)
    setThemeState(next)
  }

  function cycleTheme() {
    const index = THEME_ORDER.indexOf(theme)
    setTheme(THEME_ORDER[(index + 1) % THEME_ORDER.length])
  }

  return { theme, setTheme, cycleTheme }
}
