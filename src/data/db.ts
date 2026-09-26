import Dexie, { type EntityTable } from 'dexie'

export type FeedbackState = 'clear' | 'refine' | 'rework' | 'unsure'

export interface Attempt {
  id?: number
  ts: number
  targetId: string
  itemId: string
  step: 'diagnostic' | 'discover' | 'hear' | 'produce' | 'guided' | 'transfer' | 'review' | 'calibration'
  kind: 'perception' | 'production'
  ok: boolean | null          // null = no verdict (uncertain)
  state?: FeedbackState
  prediction?: number          // self-prediction before the attempt (1..3)
  voice?: string
  heard?: string
  detail?: unknown
  audio?: Blob                  // kept locally only (last attempts per item)
}

export interface SrsCard {
  itemId: string
  targetId: string
  kind: 'perception' | 'production'
  half: number        // half-life in days
  last: number        // ts of last review
  due: number         // ts when recall probability drops to ~50%
  reps: number
  lapses: number
}

export interface Mastery {
  targetId: string
  p: number                                    // estimated probability of mastery (0..1)
  n1?: { ts: number; score: number }           // perceive ≥ 85% on new voices
  n2Sessions?: string[]                        // distinct days with controlled production ≥ 80%
  n2?: { ts: number }
  n3?: { ts: number }                          // guided (reading / prepared answer) success
  n4?: { ts: number; validatedBy?: 'self' | 'peer' | 'teacher' }
  n5?: { ts: number }                          // retention J+21 / J+60
  opened?: number
  lessonSeen?: number
  lastWorked?: number
}

export interface PortfolioEntry {
  id?: number
  ts: number
  kind: 'J0' | 'diagnostic' | 'free' | 'transfer' | 'reading'
  label: string
  text?: string
  targetId?: string
  audio: Blob
  duration: number
  transcript?: string
}

export interface SessionLog {
  id?: number
  ts: number
  day: string        // YYYY-MM-DD
  minutes: number
  xp: number
  targets: string[]
  reflection?: { improved?: string; watch?: string }
}

export interface KV { key: string; value: unknown }

export const db = new Dexie('schwa') as Dexie & {
  kv: EntityTable<KV, 'key'>
  attempts: EntityTable<Attempt, 'id'>
  srs: EntityTable<SrsCard, 'itemId'>
  mastery: EntityTable<Mastery, 'targetId'>
  portfolio: EntityTable<PortfolioEntry, 'id'>
  sessions: EntityTable<SessionLog, 'id'>
}

db.version(1).stores({
  kv: 'key',
  attempts: '++id, ts, targetId, itemId, step, [itemId+ts]',
  srs: 'itemId, targetId, due',
  mastery: 'targetId',
  portfolio: '++id, ts, kind, targetId',
  sessions: '++id, ts, day',
})

export async function kvGet<T>(key: string, fallback: T): Promise<T> {
  try {
    const r = await db.kv.get(key)
    return (r?.value as T) ?? fallback
  } catch {
    return fallback
  }
}
export async function kvSet(key: string, value: unknown) {
  try { await db.kv.put({ key, value }) } catch { /* private mode: keep in memory only */ }
}

/** Keep only the last N recordings per item (minimisation + storage). */
export async function pruneAttemptAudio(itemId: string, keep = 5) {
  const all = await db.attempts.where('itemId').equals(itemId).sortBy('ts')
  const withAudio = all.filter((a) => a.audio)
  const drop = withAudio.slice(0, Math.max(0, withAudio.length - keep))
  await Promise.all(drop.map((a) => db.attempts.update(a.id!, { audio: undefined })))
}

export function today(ts = Date.now()) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export async function wipeAll() {
  await db.delete()
  await db.open()
}
