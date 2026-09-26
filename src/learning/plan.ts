/**
 * Flight plan (parcours) & daily session (10–15 min):
 *   1. retrieval warm-up (due items, interleaved)       ~30 %
 *   2. one target: discover → hear → produce → guided  ~50 %
 *   3. transfer mini-task                               ~20 %
 *   4. 30-second metacognitive close
 * Priorities come from the diagnostic and are re-weighted continuously (anti-stagnation).
 */
import type { Course, Level, TargetSummary } from '../content/types'
import type { Mastery, SrsCard } from '../data/db'
import { evidenceLevel } from './mastery'

export type Step = 'discover' | 'hear' | 'produce' | 'guided' | 'transfer'
export type Activity =
  | { type: 'review'; cards: SrsCard[] }
  | { type: 'step'; targetId: string; step: Step }
  | { type: 'reflect' }

const LEVELS: Level[] = ['A2', 'B1', 'B2', 'C1']

/** Intelligibility impact of each target (didactic hierarchy: stress & reduction > rhythm > nucleus > high-load segments > TH…). */
export const IMPACT: Record<string, number> = {
  'a2-stress2': 1.0, 'a2-schwa': 0.98, 'a2-syllables': 0.8, 'b1-stress-long': 1.0, 'b2-suffix-strong': 0.9, 'c1-spelling': 0.75,
  'b1-weak-forms': 0.85, 'b1-nucleus': 0.8, 'b2-final-fall': 0.78, 'b2-chunking-focus': 0.72, 'c1-contrastive': 0.7,
  'a2-ih-iy': 0.75, 'a2-h': 0.7, 'b1-ae-uh': 0.65, 'b2-diphthongs': 0.62, 'b2-uh-uw': 0.5, 'b1-ed-s': 0.66,
  'b1-free-checked': 0.55, 'b2-noun-verb': 0.6, 'b2-linking': 0.55, 'c1-compounds': 0.5, 'c1-connected': 0.4,
  'c1-tones': 0.45, 'c1-read-aloud': 0.6, 'a2-spelling': 0.4, 'b1-th': 0.35, 'b1-suffix-neutral': 0.6,
}

export function nextStep(m: Mastery | undefined): Step | null {
  if (!m?.lessonSeen) return 'discover'
  if (!m.n1) return 'hear'
  if (!m.n2) return 'produce'
  if (!m.n3) return 'guided'
  if (!m.n4) return 'transfer'
  return null
}

export function flightPlan(course: Course, mastery: Record<string, Mastery>, priorities: string[], level: Level): TargetSummary[] {
  const lvIdx = LEVELS.indexOf(level)
  const byId = new Map(course.targets.map((t) => [t.id, t]))
  const seen = new Set<string>()
  const plan: TargetSummary[] = []
  const push = (t?: TargetSummary) => { if (t && !seen.has(t.id)) { seen.add(t.id); plan.push(t) } }
  // 1) diagnostic priorities (≤ one orbit above the learner's level)
  for (const id of priorities) {
    const t = byId.get(id)
    if (t && LEVELS.indexOf(t.level) <= lvIdx + 1) push(t)
  }
  // 2) remaining targets up to the learner's level, in course order but weighted by impact within each orbit
  for (let l = 0; l <= Math.min(3, lvIdx); l++) {
    course.targets.filter((t) => t.level === LEVELS[l]).sort((a, b) => (IMPACT[b.id] ?? 0.5) - (IMPACT[a.id] ?? 0.5) || a.order - b.order).forEach(push)
  }
  // 3) the orbits above (spiral curriculum)
  for (let l = lvIdx + 1; l < 4; l++) course.targets.filter((t) => t.level === LEVELS[l]).sort((a, b) => a.order - b.order).forEach(push)
  // mastered targets (N4+) sink to the end, keep order otherwise
  return [...plan.filter((t) => evidenceLevel(mastery[t.id]) < 4), ...plan.filter((t) => evidenceLevel(mastery[t.id]) >= 4)]
}

export function currentTarget(plan: TargetSummary[], mastery: Record<string, Mastery>): TargetSummary | null {
  // continue the target in progress (opened, not N3) if any, else the first non-mastered one
  const inProgress = plan.find((t) => mastery[t.id]?.opened && !mastery[t.id]?.n3)
  return inProgress ?? plan.find((t) => nextStep(mastery[t.id]) !== null) ?? null
}

export function sessionPlan(plan: TargetSummary[], mastery: Record<string, Mastery>, due: SrsCard[], minutes = 12): Activity[] {
  const acts: Activity[] = []
  if (due.length) acts.push({ type: 'review', cards: due.slice(0, minutes <= 8 ? 5 : 8) })
  const t = currentTarget(plan, mastery)
  if (t) {
    const step = nextStep(mastery[t.id])
    if (step) {
      acts.push({ type: 'step', targetId: t.id, step })
      // after discovering, go straight to perception (build the category before producing it)
      if (step === 'discover') acts.push({ type: 'step', targetId: t.id, step: 'hear' })
      else if (step === 'hear' && minutes >= 12) acts.push({ type: 'step', targetId: t.id, step: 'produce' })
      else if (step === 'produce' && minutes >= 12) acts.push({ type: 'step', targetId: t.id, step: 'guided' })
    }
    // a short transfer moment on a target that is already produced correctly
    const tr = plan.find((x) => mastery[x.id]?.n2 && !mastery[x.id]?.n4 && x.id !== t.id)
    if (tr && minutes >= 12) acts.push({ type: 'step', targetId: tr.id, step: 'transfer' })
  }
  acts.push({ type: 'reflect' })
  return acts
}
