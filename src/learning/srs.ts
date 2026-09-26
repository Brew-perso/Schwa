/**
 * Spaced repetition by half-life (in the spirit of half-life regression, Settles & Meeder 2016):
 * p(recall) = 2^(-Δ/h). A card is due when p drops to 0.5 (Δ = h). Success lengthens h, failure shortens it.
 * Starting schedule ≈ J+1, J+3, J+7, J+21, J+60 (cadre didactique §7.2).
 */
import { db, type SrsCard } from '../data/db'

const DAY = 86400000

export function recallProb(c: SrsCard, now = Date.now()) {
  return Math.pow(2, -(now - c.last) / (c.half * DAY))
}

export async function review(itemId: string, targetId: string, kind: SrsCard['kind'], outcome: 'good' | 'hard' | 'fail' | 'unsure', now = Date.now()) {
  const c = await db.srs.get(itemId)
  if (outcome === 'unsure') {
    if (!c) return
    return // no evidence either way: don't move the card
  }
  if (!c) {
    const half = outcome === 'good' ? 1.5 : outcome === 'hard' ? 1 : 0.5
    const card: SrsCard = { itemId, targetId, kind, half, last: now, due: now + half * DAY, reps: 1, lapses: outcome === 'fail' ? 1 : 0 }
    await db.srs.put(card)
    return card
  }
  let half = c.half
  if (outcome === 'good') half = Math.min(180, half * (c.reps < 2 ? 2.5 : 2.8))
  else if (outcome === 'hard') half = Math.min(180, half * 1.4)
  else half = Math.max(0.5, half * 0.35)
  const card: SrsCard = { ...c, half, last: now, due: now + half * DAY, reps: c.reps + 1, lapses: c.lapses + (outcome === 'fail' ? 1 : 0) }
  await db.srs.put(card)
  return card
}

export async function dueCards(now = Date.now(), limit = 10): Promise<SrsCard[]> {
  const due = await db.srs.where('due').belowOrEqual(now).toArray()
  // interleave targets (entrelacement): round-robin by target, most overdue first
  due.sort((a, b) => recallProb(a, now) - recallProb(b, now))
  const byT = new Map<string, SrsCard[]>()
  for (const c of due) { const l = byT.get(c.targetId) ?? []; l.push(c); byT.set(c.targetId, l) }
  const out: SrsCard[] = []
  while (out.length < limit && byT.size) {
    for (const [k, l] of byT) {
      const c = l.shift()
      if (c) out.push(c)
      if (!l.length) byT.delete(k)
      if (out.length >= limit) break
    }
  }
  return out
}

export async function dueCount(now = Date.now()) {
  return db.srs.where('due').belowOrEqual(now).count()
}
