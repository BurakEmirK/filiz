import Dexie from 'dexie'
import { FilizDB, GUEST_DB_PREFIX, OWNER_DB } from './db'
import { Repository, uid } from './repo'

// Oturum yöneticisi: sahip ve misafir (Demo Modu) verisini ayrı veritabanlarında tutar.
// - Demo başlarken sahibin veritabanı KAPATILIR; misafir kodu ona erişemez.
// - Demo bitince misafir veritabanı silinir, sahibin veritabanı yeniden açılır.
// - Uygulama demo sırasında kapanırsa, bir sonraki açılışta misafir verisi silinir ve sahibe dönülür.

export interface KeyValueStore {
  get(key: string): string | null
  set(key: string, value: string): void
  remove(key: string): void
}

export const browserStore: KeyValueStore = {
  get: (k) => {
    try {
      return localStorage.getItem(k)
    } catch {
      return null
    }
  },
  set: (k, v) => {
    try {
      localStorage.setItem(k, v)
    } catch {
      /* depolama kullanılamıyor */
    }
  },
  remove: (k) => {
    try {
      localStorage.removeItem(k)
    } catch {
      /* yok say */
    }
  },
}

/** Testlerde kullanılan bellek içi depo */
export function memoryStore(): KeyValueStore {
  const m = new Map<string, string>()
  return { get: (k) => m.get(k) ?? null, set: (k, v) => void m.set(k, v), remove: (k) => void m.delete(k) }
}

const SESSION_KEY = 'filiz.session.v1'
const DEVICE_KEY = 'filiz.deviceId'

type SessionState = { mode: 'owner' } | { mode: 'guest'; guestDb: string; startedAt: number; resumeRoute: string }

export type ActiveSession =
  | { mode: 'owner'; repo: Repository; recoveredFromDemo: boolean }
  | { mode: 'guest'; repo: Repository; startedAt: number }

export class SessionManager {
  private owner?: Repository
  private guest?: Repository

  constructor(
    private store: KeyValueStore = browserStore,
    private ownerDbName = OWNER_DB,
  ) {}

  get deviceId(): string {
    let id = this.store.get(DEVICE_KEY)
    if (!id) {
      id = uid()
      this.store.set(DEVICE_KEY, id)
    }
    return id
  }

  private readState(): SessionState {
    try {
      const raw = this.store.get(SESSION_KEY)
      return raw ? (JSON.parse(raw) as SessionState) : { mode: 'owner' }
    } catch {
      return { mode: 'owner' }
    }
  }

  /** Uygulama açılışı. Yarım kalmış demo varsa misafir verisini siler ve sahibe döner. */
  async boot(): Promise<ActiveSession> {
    const state = this.readState()
    let recovered = false
    if (state.mode === 'guest') {
      await Dexie.delete(state.guestDb)
      recovered = true
    }
    await this.cleanupStrayGuestDbs()
    this.store.set(SESSION_KEY, JSON.stringify({ mode: 'owner' }))
    this.owner = new Repository(new FilizDB(this.ownerDbName), this.deviceId, 'owner')
    await this.owner.db.open()
    return { mode: 'owner', repo: this.owner, recoveredFromDemo: recovered }
  }

  /** Sahibin yarım kalan konumu (ör. açık ders) demo bitince geri yüklenir. */
  pendingResumeRoute(): string | undefined {
    const s = this.readState()
    return s.mode === 'guest' ? s.resumeRoute : undefined
  }

  async startDemo(resumeRoute: string): Promise<ActiveSession> {
    const guestDb = `${GUEST_DB_PREFIX}${uid()}`
    // Önce durum kaydedilir: uygulama bu noktadan sonra kapanırsa açılışta temizlenir
    this.store.set(SESSION_KEY, JSON.stringify({ mode: 'guest', guestDb, startedAt: Date.now(), resumeRoute }))
    this.owner?.db.close()
    this.owner = undefined
    this.guest = new Repository(new FilizDB(guestDb), 'guest', 'guest')
    await this.guest.db.open()
    return { mode: 'guest', repo: this.guest, startedAt: Date.now() }
  }

  /** Demo'yu bitirir: misafir verisi silinir, sahibin veritabanı açılır ve kaldığı yer döner. */
  async endDemo(): Promise<{ session: ActiveSession; resumeRoute: string }> {
    const state = this.readState()
    const resumeRoute = state.mode === 'guest' ? state.resumeRoute : '#/today'
    if (this.guest) {
      const name = this.guest.db.name
      this.guest.db.close()
      await Dexie.delete(name)
      this.guest = undefined
    } else if (state.mode === 'guest') {
      await Dexie.delete(state.guestDb)
    }
    this.store.set(SESSION_KEY, JSON.stringify({ mode: 'owner' }))
    this.owner = new Repository(new FilizDB(this.ownerDbName), this.deviceId, 'owner')
    await this.owner.db.open()
    return { session: { mode: 'owner', repo: this.owner, recoveredFromDemo: false }, resumeRoute }
  }

  /** Yeni misafir için temiz başlangıç: eski misafir verisi silinir, yenisi açılır. */
  async restartDemo(): Promise<ActiveSession> {
    const state = this.readState()
    const resume = state.mode === 'guest' ? state.resumeRoute : '#/today'
    if (this.guest) {
      const name = this.guest.db.name
      this.guest.db.close()
      await Dexie.delete(name)
      this.guest = undefined
    }
    return this.startDemo(resume)
  }

  private async cleanupStrayGuestDbs() {
    try {
      const dbs = await Dexie.getDatabaseNames()
      for (const name of dbs) if (name.startsWith(GUEST_DB_PREFIX)) await Dexie.delete(name)
    } catch {
      /* bazı tarayıcılar veritabanı listesini desteklemez */
    }
  }
}
