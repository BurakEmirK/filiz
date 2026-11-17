import Dexie, { type Table } from 'dexie'
import type {
  Attempt,
  ErrorNote,
  IndustryTrack,
  LanguageTrack,
  LessonState,
  PersonalPhrase,
  Profile,
  ReviewLogEntry,
  SkillMemory,
  WordOfDay,
} from '../domain/types'

export const OWNER_DB = 'filiz-owner'
export const GUEST_DB_PREFIX = 'filiz-guest-'
export const SCHEMA_VERSION = 1

export const TABLES = [
  'profile',
  'tracks',
  'industryTracks',
  'lessonStates',
  'skills',
  'reviews',
  'attempts',
  'errors',
  'phrases',
  'wordOfDay',
] as const
export type TableName = (typeof TABLES)[number]

/** Bir profilin (sahip veya misafir) tüm öğrenme verisi. Sahip ve misafir AYRI veritabanlarıdır. */
export class FilizDB extends Dexie {
  profile!: Table<Profile, string>
  tracks!: Table<LanguageTrack, string>
  industryTracks!: Table<IndustryTrack, string>
  lessonStates!: Table<LessonState, string>
  skills!: Table<SkillMemory, string>
  reviews!: Table<ReviewLogEntry, string>
  attempts!: Table<Attempt, string>
  errors!: Table<ErrorNote, string>
  phrases!: Table<PersonalPhrase, string>
  wordOfDay!: Table<WordOfDay, string>

  constructor(name: string) {
    super(name)
    // Şema değişikliklerinde yeni sürüm eklenir; eski veriler Dexie yükseltmesiyle korunur.
    this.version(SCHEMA_VERSION).stores({
      profile: 'id',
      tracks: 'id, lang',
      industryTracks: 'id, lang, industryId',
      lessonStates: 'id, lang, lessonId, status',
      skills: 'id, lang, senseId, skill, due, [lang+due]',
      reviews: 'id, lang, senseId, at',
      attempts: 'id, lang, evalStatus, createdAt',
      errors: 'id, lang, senseId, createdAt',
      phrases: 'id, lang, createdAt',
      wordOfDay: 'id, lang',
    })
  }
}
