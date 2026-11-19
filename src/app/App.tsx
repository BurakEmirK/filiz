import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { defaultProfile } from '../data/repo'
import { SessionManager, type ActiveSession } from '../data/session'
import { httpEvaluator, notConfiguredEvaluator } from '../domain/evaluation'
import { processPending } from '../domain/services'
import type { Profile } from '../domain/types'
import { ErrorPracticeScreen, LessonScreen, ReviewScreen, SkipCheckScreen, SkipUnitScreen, WordOfDayScreen } from '../screens/Activities'
import { DemoApp } from '../screens/Demo'
import { MeScreen } from '../screens/Me'
import { Onboarding } from '../screens/Onboarding'
import { SoundTestScreen } from '../screens/SoundTest'
import { CareerScreen, IndustryScreen, LearnScreen, TodayScreen } from '../screens/Tabs'
import { WordsScreen } from '../screens/Words'
import { BrandMark, Icon } from '../ui/icons'
import { AppContext, type AppState } from './context'
import { go, lastLearningRoute, useRoute } from './router'

const TABS = [
  { id: 'today', label: 'Bugün', icon: Icon.today },
  { id: 'learn', label: 'Öğren', icon: Icon.learn },
  { id: 'career', label: 'Kariyer', icon: Icon.industry },
  { id: 'words', label: 'Kelimeler', icon: Icon.words },
  { id: 'me', label: 'Ben', icon: Icon.me },
]

function usePrefersDark() {
  const [dark, setDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false)
  useEffect(() => {
    const m = window.matchMedia?.('(prefers-color-scheme: dark)')
    const on = () => setDark(m.matches)
    m?.addEventListener('change', on)
    return () => m?.removeEventListener('change', on)
  }, [])
  return dark
}

function usePrefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

export function App() {
  const sm = useRef(new SessionManager())
  const [session, setSession] = useState<ActiveSession | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [dataVersion, setDataVersion] = useState(0)
  const [recovered, setRecovered] = useState(false)
  const [bootError, setBootError] = useState<string | null>(null)
  const route = useRoute()
  const prefersDark = usePrefersDark()
  const prefersReduced = usePrefersReducedMotion()

  useEffect(() => {
    sm.current
      .boot()
      .then(async (s) => {
        setSession(s)
        setProfile(await s.repo.getProfile())
        if (s.mode === 'owner' && s.recoveredFromDemo) setRecovered(true)
        try {
          await navigator.storage?.persist?.()
        } catch {
          /* tarayıcı izin vermeyebilir */
        }
      })
      .catch((e) => setBootError(String(e?.message ?? e)))
  }, [])

  // Tema, görünüm, metin boyutu ve hareket ayarlarını uygula
  useEffect(() => {
    if (!profile) return
    const root = document.documentElement
    root.dataset.theme = profile.theme
    root.dataset.appearance = profile.appearance === 'system' ? (prefersDark ? 'dark' : 'light') : profile.appearance
    root.dataset.motion = profile.reduceMotion === 'on' || (profile.reduceMotion === 'system' && prefersReduced) ? 'reduce' : 'full'
    root.style.setProperty('--text-scale', String(profile.textScale))
    const bg = getComputedStyle(root).getPropertyValue('--bg').trim()
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg || '#F6F1E9')
  }, [profile, prefersDark, prefersReduced])

  // Bekleyen değerlendirmeler: bağlantı gelince (değerlendirici yapılandırılmışsa) tamamlanır
  useEffect(() => {
    if (!session || session.mode !== 'owner' || !profile) return
    const evaluator = profile.evaluationEndpoint ? httpEvaluator(profile.evaluationEndpoint) : notConfiguredEvaluator
    const run = () => void processPending(session.repo, evaluator).then((n) => n && setDataVersion((v) => v + 1))
    run()
    window.addEventListener('online', run)
    return () => window.removeEventListener('online', run)
  }, [session, profile?.evaluationEndpoint])

  const updateProfile = useCallback(
    async (patch: Partial<Profile>) => {
      if (!session || !profile) return
      const saved = await session.repo.saveProfile({ ...profile, ...patch })
      setProfile(saved)
    },
    [session, profile],
  )

  const state: AppState | null = useMemo(() => {
    if (!session || !profile) return null
    return {
      session,
      repo: session.repo,
      profile,
      updateProfile,
      dataVersion,
      bump: () => setDataVersion((v) => v + 1),
      startDemo: async () => {
        const s = await sm.current.startDemo(lastLearningRoute())
        // Misafir: sahibin profili kullanılmaz; varsayılan profil (yalnızca görünüm için sahibin teması korunur)
        setProfile({ ...defaultProfile('guest'), onboarded: true, theme: profile.theme, appearance: profile.appearance, textScale: profile.textScale })
        setSession(s)
      },
      endDemo: async () => {
        const { session: s, resumeRoute } = await sm.current.endDemo()
        setProfile(await s.repo.getProfile())
        setSession(s)
        setDataVersion((v) => v + 1)
        go(resumeRoute)
      },
      restartDemo: async () => {
        const s = await sm.current.restartDemo()
        setSession(s)
      },
    }
  }, [session, profile, updateProfile, dataVersion])

  if (bootError) {
    return (
      <div className="page">
        <h1>Uygulama açılamadı</h1>
        <p>Tarayıcı veritabanına erişilemedi: {bootError}</p>
        <p className="muted small">Özel (gizli) sekmede veya depolama kapalıyken bu olabilir.</p>
      </div>
    )
  }
  if (!state) return <div className="page muted">Yükleniyor…</div>

  return (
    <AppContext.Provider value={state}>
      {state.session.mode === 'guest' ? <DemoApp /> : !state.profile.onboarded ? <Onboarding /> : <OwnerShell recovered={recovered} routePath={route.path} query={route.query} />}
    </AppContext.Provider>
  )
}

function OwnerShell({ recovered, routePath, query }: { recovered: boolean; routePath: string[]; query: URLSearchParams }) {
  const [head, arg] = routePath
  // Tam ekran etkinlikler
  if (head === 'lesson' && arg) return <LessonScreen lessonId={arg} />
  if (head === 'review') return <ReviewScreen />
  if (head === 'wod') return <WordOfDayScreen />
  if (head === 'practice' && arg) return <ErrorPracticeScreen errorId={arg} />
  if (head === 'skipcheck' && arg) return <SkipCheckScreen lessonId={arg} />
  if (head === 'skipunit' && arg && routePath[2]) return <SkipUnitScreen lang={arg} unit={Number(routePath[2])} />

  // Kariyer sekmesi: hedef + sektör listesi; sektör ayrıntısı ve ses testi kendi sayfalarında
  const tab = head === 'industries' ? 'career' : head === 'sound-test' ? 'me' : TABS.some((t) => t.id === head) ? head : 'today'
  return (
    <div className="shell">
      <nav className="nav" aria-label="Ana bölümler">
        <div className="nav-brand">
          <BrandMark /> Filiz
        </div>
        {TABS.map((t) => (
          <a key={t.id} href={`#/${t.id}`} aria-current={tab === t.id ? 'page' : undefined}>
            <t.icon />
            <span>{t.label}</span>
          </a>
        ))}
      </nav>
      <main className="main">
        {tab === 'today' ? <TodayScreen recovered={recovered} /> : null}
        {tab === 'learn' ? <LearnScreen /> : null}
        {head === 'industries' && arg ? <IndustryScreen industryId={arg} langParam={query.get('lang')} /> : null}
        {tab === 'career' && !(head === 'industries' && arg) ? <CareerScreen langParam={query.get('lang')} /> : null}
        {tab === 'words' ? <WordsScreen tab={(query.get('tab') as 'collection' | 'errors' | 'all') ?? 'collection'} /> : null}
        {head === 'sound-test' ? <SoundTestScreen /> : tab === 'me' ? <MeScreen /> : null}
      </main>
    </div>
  )
}
