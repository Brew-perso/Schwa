/**
 * Evidence ladder per target (cadre didactique §6.3):
 *  N1 Percevoir  ≥ 85 % identification on voices not heard before           — automatic
 *  N2 Produire   target clear in ≥ 80 % of words / short sentences, 2 days  — automatic (constrained ASR)
 *  N3 Maintenir  success in reading / prepared answer                        — automatic (ASR + prosody)
 *  N4 Transférer semi-spontaneous speech, checked by a human (self/peer/teacher) — human in the loop
 *  N5 Retenir    success at J+21 / J+60 without intermediate practice        — automatic
 * Points (XP) reward effort only; badges only attest evidence. The two are never mixed.
 */
import { db, today, type Mastery } from '../data/db'

export const LEVELS = ['N1', 'N2', 'N3', 'N4', 'N5'] as const
export type NLevel = (typeof LEVELS)[number]

export async function getMastery(targetId: string): Promise<Mastery> {
  return (await db.mastery.get(targetId)) ?? { targetId, p: 0 }
}

export async function allMastery(): Promise<Record<string, Mastery>> {
  const all = await db.mastery.toArray()
  return Object.fromEntries(all.map((m) => [m.targetId, m]))
}

async function save(m: Mastery) { await db.mastery.put(m) }

export function evidenceLevel(m?: Mastery): number {
  if (!m) return 0
  if (m.n5) return 5
  if (m.n4) return 4
  if (m.n3) return 3
  if (m.n2) return 2
  if (m.n1) return 1
  return 0
}

/** Rough mastery probability shown as a progress arc (not a score): combines ladder and recent success. */
function updateP(m: Mastery, success: number) {
  const base = evidenceLevel(m) / 5
  m.p = Math.max(0, Math.min(1, 0.7 * base + 0.3 * (0.6 * m.p + 0.4 * success)))
}

export async function recordPerceptionBlock(targetId: string, correct: number, total: number, novelVoices: boolean) {
  const m = await getMastery(targetId)
  m.lastWorked = Date.now()
  const rate = total ? correct / total : 0
  let newLevel: NLevel | null = null
  if (!m.n1 && total >= 10 && rate >= 0.85 && novelVoices) { m.n1 = { ts: Date.now(), score: rate }; newLevel = 'N1' }
  updateP(m, rate)
  await save(m)
  return { m, newLevel }
}

export async function recordProductionBlock(targetId: string, clear: number, judged: number) {
  const m = await getMastery(targetId)
  m.lastWorked = Date.now()
  const rate = judged ? clear / judged : 0
  let newLevel: NLevel | null = null
  if (judged >= 4 && rate >= 0.8) {
    const d = today()
    m.n2Sessions = Array.from(new Set([...(m.n2Sessions ?? []), d]))
    if (!m.n2 && m.n2Sessions.length >= 2) { m.n2 = { ts: Date.now() }; newLevel = 'N2' }
  }
  updateP(m, rate)
  await save(m)
  return { m, newLevel }
}

export async function recordGuidedBlock(targetId: string, clear: number, judged: number) {
  const m = await getMastery(targetId)
  m.lastWorked = Date.now()
  const rate = judged ? clear / judged : 0
  let newLevel: NLevel | null = null
  if (!m.n3 && m.n2 && judged >= 2 && rate >= 0.8) { m.n3 = { ts: Date.now() }; newLevel = 'N3' }
  updateP(m, rate)
  await save(m)
  return { m, newLevel }
}

export async function recordTransfer(targetId: string, validatedBy: 'self' | 'peer' | 'teacher') {
  const m = await getMastery(targetId)
  m.lastWorked = Date.now()
  let newLevel: NLevel | null = null
  // self-validation keeps N4 "provisional" (autonomy mode, §1.4); peers/teacher confirm it
  if (!m.n4 && m.n3) { m.n4 = { ts: Date.now(), validatedBy }; newLevel = 'N4' }
  else if (m.n4 && m.n4.validatedBy === 'self' && validatedBy !== 'self') m.n4.validatedBy = validatedBy
  updateP(m, 1)
  await save(m)
  return { m, newLevel }
}

/** Retention check: a successful review ≥ 21 days after N3 with no practice in between. */
export async function recordRetention(targetId: string, success: boolean) {
  const m = await getMastery(targetId)
  let newLevel: NLevel | null = null
  if (success && !m.n5 && m.n3 && Date.now() - m.n3.ts > 21 * 86400000 && (m.lastWorked ?? 0) < Date.now() - 14 * 86400000) {
    m.n5 = { ts: Date.now() }
    newLevel = 'N5'
  }
  m.lastWorked = Date.now()
  updateP(m, success ? 1 : 0)
  await save(m)
  return { m, newLevel }
}

export async function markOpened(targetId: string, lessonSeen = false) {
  const m = await getMastery(targetId)
  m.opened = m.opened ?? Date.now()
  if (lessonSeen) m.lessonSeen = Date.now()
  await save(m)
}
