import { useEffect, useState } from 'react'

// Basit hash yönlendirici (#/today, #/lesson/ru-core-1 ...). Sunucu ayarı gerektirmez; statik barındırmada çalışır.

export interface Route {
  path: string[]
  query: URLSearchParams
  raw: string
}

export function parseRoute(hash: string): Route {
  const raw = hash.replace(/^#/, '') || '/today'
  const [p, q] = raw.split('?')
  return { path: p.split('/').filter(Boolean), query: new URLSearchParams(q ?? ''), raw: `#${raw}` }
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash))
  useEffect(() => {
    const on = () => setRoute(parseRoute(window.location.hash))
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}

export function go(to: string) {
  if (window.location.hash === to) window.dispatchEvent(new HashChangeEvent('hashchange'))
  else window.location.hash = to
}

/** Sahibin yarım kalan öğrenme konumu (demo sonrası geri dönmek için) */
const LAST_KEY = 'filiz.lastLearningRoute'
export function rememberLearningRoute(route: string | null) {
  try {
    if (route) localStorage.setItem(LAST_KEY, route)
    else localStorage.removeItem(LAST_KEY)
  } catch {
    /* yok say */
  }
}
export function lastLearningRoute(): string {
  try {
    return localStorage.getItem(LAST_KEY) ?? '#/today'
  } catch {
    return '#/today'
  }
}
