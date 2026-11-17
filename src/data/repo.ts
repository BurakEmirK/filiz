import type { Sense } from '../content/types'
import { newCard, reviewCard } from '../domain/scheduler'
import type {
  Attempt,
  ErrorNote,
  Grade,
  IndustryTrack,
  LanguageTrack,
  LessonState,
  PersonalPhrase,
  Profile,
  ReviewLogEntry,
  Skill,
  SkillMemory,
  StoredCard,
  WordOfDay,
} from '../domain/types'
import { FilizDB, SCHEMA_VERSION, TABLES, type TableName } from './db'

export function uid(): string {
  // randomUUID yalnızca güvenli bağlamda (HTTPS/localhost) vardır; yerel ağ (http) testi için yedek üretici
  const c = globalThis.crypto as Crypto | undefined
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
}

export function defaultProfile(deviceId: string, now = Date.now()): Profile {
  return {
    id: 'profile',
    onboarded: false,
    interfaceLang: 'tr',
    explanationLang: 'tr',
    knownLanguages: [{ lang: 'tr', level: 'native' }],
    targetLanguages: ['ru'],
    activeLang: 'ru',
    ageGroup: 'adult',
    readingSupport: false,
    goals: [],
    interests: [],
    dailyMinutes: 15,
    newPerDay: 5,
    desiredRetention: 0.9,
    theme: 'kum',
    appearance: 'system',
    textScale: 1,
    reduceMotion: 'system',
    pronunciationAid: { ru: 'full', hu: 'full' },
    evaluationEndpoint: '',
    updatedAt: now,
    deviceId,
  }
}

export interface ReviewInput {
  lang: string
  senseId: string
  skill: Skill
  grade: Grade
  source: ReviewLogEntry['source']
  now?: Date
  attemptId?: string
  elapsedMs?: number
  hintsUsed?: number
  desiredRetention?: number
  origin?: SkillMemory['origin']
}

export interface BackupFile {
  app: 'filiz'
  schemaVersion: number
  exportedAt: string
  deviceId: string
  tables: Partial<Record<TableName, unknown[]>>
}

/** Bir veritabanı (sahip veya misafir) üzerinde tüm okuma/yazma işlemleri. */
export class Repository {
  constructor(
    readonly db: FilizDB,
    readonly deviceId: string,
    readonly kind: 'owner' | 'guest',
  ) {}

  private stamp<T extends object>(x: T): T & { updatedAt: number; deviceId: string } {
    return { ...x, updatedAt: Date.now(), deviceId: this.deviceId }
  }

  // ---- Profil ----
  async getProfile(): Promise<Profile> {
    const p = await this.db.profile.get('profile')
    return p ?? defaultProfile(this.deviceId)
  }
  async saveProfile(p: Profile): Promise<Profile> {
    const stamped = this.stamp(p)
    await this.db.profile.put(stamped)
    return stamped
  }

  // ---- Dil ve sektör izleri (birbirinden bağımsız) ----
  async ensureTrack(lang: string): Promise<LanguageTrack> {
    const t = await this.db.tracks.get(lang)
    if (t) return t
    const created = this.stamp({ id: lang, lang, startedAt: Date.now() } as LanguageTrack)
    await this.db.tracks.put(created)
    return created
  }
  async saveTrack(t: LanguageTrack) {
    await this.db.tracks.put(this.stamp(t))
  }
  async ensureIndustryTrack(lang: string, industryId: string): Promise<IndustryTrack> {
    const id = `${lang}|${industryId}`
    const t = await this.db.industryTracks.get(id)
    if (t) return t
    const created = this.stamp({ id, lang, industryId, startedAt: Date.now() } as IndustryTrack)
    await this.db.industryTracks.put(created)
    return created
  }
  industryTracks(lang: string) {
    return this.db.industryTracks.where('lang').equals(lang).toArray()
  }

  // ---- Ders konumu ----
  getLessonState(lang: string, lessonId: string) {
    return this.db.lessonStates.get(`${lang}|${lessonId}`)
  }
  lessonStates(lang: string) {
    return this.db.lessonStates.where('lang').equals(lang).toArray()
  }
  async saveLessonState(s: Omit<LessonState, 'id' | 'updatedAt' | 'deviceId'>) {
    const rec = this.stamp({ ...s, id: `${s.lang}|${s.lessonId}` }) as LessonState
    await this.db.lessonStates.put(rec)
    return rec
  }

  // ---- Beceri bazlı tekrar durumu ----
  getSkill(senseId: string, skill: Skill) {
    return this.db.skills.get(`${senseId}|${skill}`)
  }
  skillsForLang(lang: string) {
    return this.db.skills.where('lang').equals(lang).toArray()
  }
  async dueSkills(lang: string, now = Date.now()): Promise<SkillMemory[]> {
    const due = await this.db.skills.where('[lang+due]').between([lang, 0], [lang, now], true, true).toArray()
    // Aşama 1: "kendiliğinden üretme" tekrarları çevrimiçi değerlendirme gerektirdiğinden kuyruğa alınmaz
    return due.filter((s) => s.skill !== 'produce' && !s.deleted).sort((a, b) => a.due - b.due)
  }
  async introducedSenseIds(lang: string): Promise<Set<string>> {
    const skills = await this.skillsForLang(lang)
    return new Set(skills.map((s) => s.senseId))
  }

  /** Bir performansı kaydeder: tekrar zamanı FSRS ile performansa göre yeniden hesaplanır. */
  async recordReview(i: ReviewInput): Promise<SkillMemory> {
    const now = i.now ?? new Date()
    const id = `${i.senseId}|${i.skill}`
    const existing = await this.db.skills.get(id)
    const before: StoredCard = existing?.card ?? (await newCard(now, i.desiredRetention))
    const after = await reviewCard(before, i.grade, now, i.desiredRetention)
    const mem = this.stamp({
      id,
      lang: i.lang,
      senseId: i.senseId,
      skill: i.skill,
      card: after,
      due: after.dueAt.getTime(),
      lastGrade: i.grade,
      origin: existing?.origin ?? i.origin ?? 'lesson',
    }) as SkillMemory
    const log = this.stamp({
      id: uid(),
      lang: i.lang,
      senseId: i.senseId,
      skill: i.skill,
      grade: i.grade,
      at: now.getTime(),
      source: i.source,
      attemptId: i.attemptId,
      elapsedMs: i.elapsedMs,
      hintsUsed: i.hintsUsed ?? 0,
      dueBefore: existing?.due ?? now.getTime(),
      dueAfter: mem.due,
    }) as ReviewLogEntry
    await this.db.transaction('rw', this.db.skills, this.db.reviews, async () => {
      await this.db.skills.put(mem)
      await this.db.reviews.put(log)
    })
    return mem
  }
  /** Henüz tekrar edilmemiş, hemen tekrar edilebilir bir beceri kaydı oluşturur (ör. koleksiyona eklenen ifade). */
  async seedSkill(lang: string, senseId: string, skill: Skill, origin: SkillMemory['origin'], now = new Date()): Promise<SkillMemory> {
    const card = await newCard(now)
    const mem = this.stamp({ id: `${senseId}|${skill}`, lang, senseId, skill, card, due: now.getTime(), origin }) as SkillMemory
    await this.db.skills.put(mem)
    return mem
  }
  reviewsForLang(lang: string) {
    return this.db.reviews.where('lang').equals(lang).toArray()
  }

  // ---- Cevaplar ----
  async addAttempt(a: Omit<Attempt, 'id' | 'createdAt' | 'updatedAt' | 'deviceId'> & { id?: string }): Promise<Attempt> {
    const rec = this.stamp({ ...a, id: a.id ?? uid(), createdAt: Date.now() }) as Attempt
    await this.db.attempts.put(rec)
    return rec
  }
  async updateAttempt(id: string, patch: Partial<Attempt>) {
    await this.db.attempts.update(id, { ...patch, updatedAt: Date.now(), deviceId: this.deviceId })
  }
  pendingAttempts() {
    return this.db.attempts.where('evalStatus').equals('pending').toArray()
  }
  attemptsForLang(lang: string) {
    return this.db.attempts.where('lang').equals(lang).toArray()
  }

  // ---- Hata defteri ----
  async addError(e: Omit<ErrorNote, 'id' | 'createdAt' | 'updatedAt' | 'deviceId' | 'practicedCount' | 'resolved'>) {
    const rec = this.stamp({ ...e, id: uid(), createdAt: Date.now(), practicedCount: 0, resolved: false }) as ErrorNote
    await this.db.errors.put(rec)
    return rec
  }
  errorsForLang(lang: string) {
    return this.db.errors.where('lang').equals(lang).reverse().sortBy('createdAt')
  }
  async updateError(id: string, patch: Partial<ErrorNote>) {
    await this.db.errors.update(id, { ...patch, updatedAt: Date.now(), deviceId: this.deviceId })
  }

  // ---- Kişisel koleksiyon ----
  async addPhrase(p: Omit<PersonalPhrase, 'id' | 'createdAt' | 'updatedAt' | 'deviceId'>) {
    const rec = this.stamp({ ...p, id: uid(), createdAt: Date.now() }) as PersonalPhrase
    await this.db.phrases.put(rec)
    return rec
  }
  async phrasesForLang(lang: string) {
    const all = await this.db.phrases.where('lang').equals(lang).toArray()
    return all.filter((p) => !p.deleted).sort((a, b) => b.createdAt - a.createdAt)
  }
  async deletePhrase(id: string) {
    // Silme işareti (senkron için); tekrar kayıtları da devre dışı bırakılır
    await this.db.phrases.update(id, { deleted: true, updatedAt: Date.now(), deviceId: this.deviceId })
    const skills = await this.db.skills.where('senseId').equals(`user:${id}`).toArray()
    for (const s of skills) await this.db.skills.update(s.id, { deleted: true, due: Number.MAX_SAFE_INTEGER, updatedAt: Date.now() })
  }

  // ---- Günün kelimesi ----
  getWordOfDay(lang: string, date: string) {
    return this.db.wordOfDay.get(`${lang}|${date}`)
  }
  async saveWordOfDay(w: Omit<WordOfDay, 'id' | 'updatedAt' | 'deviceId'>) {
    const rec = this.stamp({ ...w, id: `${w.lang}|${w.date}` }) as WordOfDay
    await this.db.wordOfDay.put(rec)
    return rec
  }

  // ---- Yedekleme / geri yükleme ----
  async exportAll(): Promise<BackupFile> {
    const tables: BackupFile['tables'] = {}
    for (const t of TABLES) tables[t] = await this.db.table(t).toArray()
    return { app: 'filiz', schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), deviceId: this.deviceId, tables }
  }

  /** Birleştirerek içe aktarır: aynı kimlikli kayıtta daha yeni olan kalır, kayıt çoğalmaz. */
  async importAll(file: BackupFile): Promise<{ added: number; updated: number; skipped: number }> {
    if (file?.app !== 'filiz') throw new Error('Bu dosya bir Filiz yedeği değil.')
    if (file.schemaVersion > SCHEMA_VERSION) throw new Error('Yedek, bu uygulamadan daha yeni bir sürümle oluşturulmuş. Önce uygulamayı güncelle.')
    let added = 0
    let updated = 0
    let skipped = 0
    await this.db.transaction('rw', TABLES.map((t) => this.db.table(t)), async () => {
      for (const t of TABLES) {
        const rows = (file.tables[t] ?? []) as Array<{ id: string; updatedAt?: number }>
        for (const raw of rows) {
          const row = reviveDates(t, raw)
          const existing = (await this.db.table(t).get(row.id)) as { updatedAt?: number } | undefined
          if (!existing) {
            await this.db.table(t).put(row)
            added++
          } else if ((row.updatedAt ?? 0) > (existing.updatedAt ?? 0)) {
            await this.db.table(t).put(row)
            updated++
          } else skipped++
        }
      }
    })
    return { added, updated, skipped }
  }
}

function reviveDates(table: TableName, row: any) {
  if (table === 'skills' && row.card) {
    return { ...row, card: { ...row.card, dueAt: new Date(row.card.dueAt), lastReviewAt: row.card.lastReviewAt ? new Date(row.card.lastReviewAt) : null } }
  }
  return row
}

/** Kişisel ifadeden tekrar edilebilir bir anlam üretir (içerik paketlerinden bağımsız). */
export function phraseToSense(p: PersonalPhrase): Sense {
  return {
    id: `user:${p.id}`,
    lang: p.lang,
    lexemeId: `user-lx:${p.id}`,
    conceptId: '',
    senseIndex: 1,
    level: 'A1',
    topics: ['personal'],
    explanation: p.context ? `Bağlam: ${p.context}` : 'Kendi eklediğin ifade.',
    examples: p.example ? [{ id: `user-ex:${p.id}`, text: p.example, tr: '', level: 'A1' }] : [],
    forms: [p.text],
    productionPrompt: `"${p.text}" ifadesini kullanarak bir cümle yaz.`,
    source: 'Kişisel koleksiyon',
    validation: 'self-checked',
    customGloss: p.meaningTr,
  }
}
