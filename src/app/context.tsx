import { createContext, useContext, useEffect, useState } from 'react'
import { content } from '../content/registry'
import type { Repository } from '../data/repo'
import type { ActiveSession } from '../data/session'
import type { Profile } from '../domain/types'

export interface AppState {
  session: ActiveSession
  repo: Repository
  profile: Profile
  updateProfile: (patch: Partial<Profile>) => Promise<void>
  /** Profili veritabanından yeniden okur ve ekranları yeniler (ör. yedek yüklendikten sonra) */
  reloadProfile: () => Promise<void>
  /** Veri değiştiğinde ekranları yenilemek için sayaç */
  dataVersion: number
  bump: () => void
  startDemo: () => Promise<void>
  endDemo: () => Promise<void>
  restartDemo: () => Promise<void>
}

export const AppContext = createContext<AppState | null>(null)

export function useApp(): AppState {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('AppContext yok')
  return ctx
}

/** Bir dilin büyük sık kelime paketini yükler (ilk kullanımda indirilir, sonra önbellekten gelir). */
export function useLangContent(lang: string | undefined): { ready: boolean; error: string | null } {
  const [state, setState] = useState(() => ({ ready: !lang || content.isLoaded(lang), error: null as string | null }))
  useEffect(() => {
    if (!lang) return
    if (content.isLoaded(lang)) {
      setState({ ready: true, error: null })
      return
    }
    let alive = true
    setState({ ready: false, error: null })
    content.ensureLanguage(lang).then(
      () => alive && setState({ ready: true, error: null }),
      (e) => alive && setState({ ready: true, error: String(e?.message ?? e) }),
    )
    return () => {
      alive = false
    }
  }, [lang])
  return state
}

/** Asenkron veri yükleme kancası: bağımlılıklar veya dataVersion değişince yeniden yükler. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): { data: T | undefined; loading: boolean; reload: () => void } {
  const [data, setData] = useState<T>()
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let alive = true
    setLoading(true)
    fn().then(
      (d) => {
        if (alive) {
          setData(d)
          setLoading(false)
        }
      },
      (e) => {
        console.error(e)
        if (alive) setLoading(false)
      },
    )
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])
  return { data, loading, reload: () => setTick((t) => t + 1) }
}
