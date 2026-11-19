import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { defaultProfile, migrateProfile } from '../data/repo'
import { SessionManager, type ActiveSession } from '../data/session'
import { httpEvaluator, notConfiguredEvaluator } from '../domain/evaluation'
import { processPending } from '../domain/services'
import type { Profile } from '../domain/types'
import { ErrorPracticeScreen, LessonScreen, ReviewScreen, SkipCheckScreen, SkipUnitScreen, WordOfDayScreen } from '../screens/Activities'
import { DemoApp } from '../screens/Demo'
import { ExploreScreen } from '../screens/Explore'
import { Onboarding } from '../screens/Onboarding'
import { ProfileScreen } from '../screens/Profile'
import { SessionScreen } from '../screens/Session'
import { SoundTestScreen } from '../screens/SoundTest'
import { IndustriesScreen, IndustryScreen, LearnScreen, SoundsScreen } from '../screens/Tabs'
import { TodayScreen } from '../screens/Today'
import { WordsScreen } from '../screens/Words'
import { BrandMark, Icon } from '../ui/icons'
import { AppContext, type AppState } from './context'
import { go, lastLearningRoute, useRoute } from './router'

const TABS = [
  { id: 'today', label: 'Bugün', icon: Icon.today },
  { id: 'explore', label: 'Keşfet', icon: Icon.explore },
  { id: 'profile', label: 'Profil', icon: Icon.me },
] as const

/** Hangi adres hangi ana bölüme ait (eski adresler de çalışır) */
const EXPLORE_ROUTES = ['explore', 'learn', 'sounds', 'words', 'industries']
const PROFILE_ROUTES = ['profile', 'me', 'career', 'sound-test']
export function tabFor(head: string | undefined): 'today' | 'explore' | 'profile' {
  if (head && EXPLORE_ROUTES.includes(head)) return 'explore'
  if (head && PROFILE_ROUTES.includes(head)) return 'profile'
  return 'today'
}

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
  /** Demo bitti / yarıda kaldı: sahibin ekranı, telefonu sahibi geri alana kadar gösterilmez */
  const [handover, setHandover] = useState<{ route: string; recovered: boolean } | null>(null)
  const [bootError, setBootError] = useState<string | null>(null)
  const route = useRoute()
  const prefersDark = usePrefersDark()
  const prefersReduced = usePrefersReducedMotion()

  useEffect(() => {
    sm.current
      .boot()
      .then(async (s) => {
        setSession(s)
        setProfile(await loadProfile(s.repo))
        if (s.mode === 'owner' && s.recoveredFromDemo) {
          setRecovered(true)
          setHandover({ route: '#/today', recovered: true })
        }
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
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg || '#F1F2EE')
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

  const reloadProfile = useCallback(async () => {
    if (!session) return
    setProfile(await loadProfile(session.repo))
    setDataVersion((v) => v + 1)
  }, [session])

  const state: AppState | null = useMemo(() => {
    if (!session || !profile) return null
    return {
      session,
      repo: session.repo,
      profile,
      updateProfile,
      reloadProfile,
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
        setHandover({ route: resumeRoute, recovered: false })
        setProfile(await loadProfile(s.repo))
        setSession(s)
        setDataVersion((v) => v + 1)
      },
      restartDemo: async () => {
        const s = await sm.current.restartDemo()
        setSession(s)
      },
    }
  }, [session, profile, updateProfile, reloadProfile, dataVersion])

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
      {state.session.mode === 'guest' ? (
        <DemoApp />
      ) : handover ? (
        <Handover
          recovered={handover.recovered}
          onContinue={() => {
            const to = handover.route
            setHandover(null)
            go(to)
          }}
        />
      ) : !state.profile.onboarded ? (
        <Onboarding />
      ) : (
        <OwnerShell recovered={recovered} routePath={route.path} query={route.query} />
      )}
    </AppContext.Provider>
  )
}

/** Profili okur; eski varsayılan tema bir kez yeni varsayılana geçirilir (Görünüm'den geri alınabilir). */
async function loadProfile(repo: AppState['repo']) {
  const p = await repo.getProfile()
  const m = migrateProfile(p)
  return m !== p && p.onboarded ? repo.saveProfile(m) : m
}

/** Demo sonrası: sahibin hiçbir verisini göstermeyen ara ekran. Sahibi dokununca kaldığı yer açılır. */
function Handover({ recovered, onContinue }: { recovered: boolean; onContinue: () => void }) {
  return (
    <div className="handover">
      <BrandMark size={56} />
      <h1>{recovered ? 'Demo yarıda kaldı' : 'Demo bitti'}</h1>
      <p>Misafir verileri silindi. Telefonu sahibine ver.</p>
      <button className="btn btn-primary" onClick={onContinue}>
        Telefonun sahibiyim, devam et
      </button>
    </div>
  )
}

function OwnerShell({ recovered, routePath, query }: { recovered: boolean; routePath: string[]; query: URLSearchParams }) {
  const [head, arg] = routePath
  // Tam ekran etkinlikler
  if (head === 'session' && arg) return <SessionScreen id={arg} />
  if (head === 'lesson' && arg) return <LessonScreen lessonId={arg} from={query.get('from')} />
  if (head === 'review') return <ReviewScreen />
  if (head === 'wod') return <WordOfDayScreen />
  if (head === 'practice' && arg) return <ErrorPracticeScreen errorId={arg} />
  if (head === 'skipcheck' && arg) return <SkipCheckScreen lessonId={arg} />
  if (head === 'skipunit' && arg && routePath[2]) return <SkipUnitScreen lang={arg} unit={Number(routePath[2])} />

  const tab = tabFor(head)
  return (
    <div className="shell">
      <a className="skip-link" href="#main">İçeriğe geç</a>
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
      <main className="main" id="main">
        {tab === 'today' ? <TodayScreen recovered={recovered} /> : null}
        {head === 'explore' ? <ExploreScreen /> : null}
        {head === 'learn' ? <LearnScreen /> : null}
        {head === 'sounds' ? <SoundsScreen /> : null}
        {head === 'words' ? <WordsScreen tab={(query.get('tab') as 'collection' | 'errors' | 'all') ?? 'collection'} initialQuery={query.get('q') ?? ''} /> : null}
        {head === 'industries' ? (arg ? <IndustryScreen industryId={arg} langParam={query.get('lang')} /> : <IndustriesScreen langParam={query.get('lang')} />) : null}
        {head === 'profile' ? <ProfileScreen section={arg} /> : null}
        {head === 'me' ? <ProfileScreen /> : null}
        {head === 'career' ? <ProfileScreen section="goal" /> : null}
        {head === 'sound-test' ? <SoundTestScreen /> : null}
      </main>
    </div>
  )
}
