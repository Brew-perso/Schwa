/** Effort points & weekly rhythm — effort is rewarded, never success; no punitive streaks (charte §5). */
import { db, today, type SessionLog } from '../data/db'

export const XP = { perception: 1, production: 2, lesson: 5, transfer: 8, bravery: 3 }

export async function logSession(partial: Omit<SessionLog, 'id' | 'day' | 'ts'> & { ts?: number }) {
  const ts = partial.ts ?? Date.now()
  await db.sessions.add({ ...partial, ts, day: today(ts) })
}

export function weekStart(ts = Date.now()) {
  const d = new Date(ts)
  const day = (d.getDay() + 6) % 7 // Monday = 0
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - day)
  return d.getTime()
}

export async function weekStats(ts = Date.now()) {
  const from = weekStart(ts)
  const s = await db.sessions.where('ts').aboveOrEqual(from).toArray()
  const days = new Set(s.map((x) => x.day))
  return { sessions: days.size, minutes: Math.round(s.reduce((a, b) => a + b.minutes, 0)), xp: s.reduce((a, b) => a + b.xp, 0) }
}

/** Gentle weekly streak: number of consecutive past weeks where the weekly goal was met (current week not counted until met). */
export async function weeklyStreak(goal: number, ts = Date.now()) {
  const all = await db.sessions.toArray()
  const byWeek = new Map<number, Set<string>>()
  for (const s of all) {
    const w = weekStart(s.ts)
    const set = byWeek.get(w) ?? new Set<string>()
    set.add(s.day)
    byWeek.set(w, set)
  }
  let streak = 0
  let w = weekStart(ts)
  if ((byWeek.get(w)?.size ?? 0) >= goal) streak++
  w -= 7 * 86400000
  while ((byWeek.get(w)?.size ?? 0) >= goal) { streak++; w -= 7 * 86400000 }
  return streak
}

export async function totalXp() {
  const s = await db.sessions.toArray()
  return s.reduce((a, b) => a + b.xp, 0)
}
