/**
 * Ice-breaker diagnostic → phonological profile per domain (kept separate from the CEFR level, Darcy 2018)
 * and 3–5 priority targets ranked by intelligibility impact × observed need.
 */
import type { Course, Level } from '../content/types'
import { IMPACT } from './plan'

export interface DiagEvidence {
  perception: { target: string; ok: boolean }[]
  stress: { target: string; ok: boolean }[]
  reading: { targets: string[]; issues: { target?: string; kind: string; state: string }[] }[]
}

export interface DiagResult {
  priorities: string[]
  phono: Record<'percevoir' | 'articuler' | 'prosodie' | 'aisance', number>
  needs: Record<string, number>
  suggestedLevel?: Level
}

export function analyseDiagnostic(course: Course, ev: DiagEvidence, declared: Level): DiagResult {
  const need: Record<string, number> = {}
  const add = (t: string, v: number) => { need[t] = (need[t] ?? 0) + v }
  for (const p of ev.perception) if (!p.ok) add(p.target, 0.6)
  for (const s of ev.stress) if (!s.ok) add(s.target, 0.7)
  for (const r of ev.reading) {
    for (const i of r.issues) {
      if (i.state === 'rework') add(i.target ?? r.targets[0], 0.8)
      else if (i.state === 'refine') add(i.target ?? r.targets[0], 0.4)
    }
  }
  // Word stress and reduction are nearly universal needs for French speakers: keep them in view even when
  // the short diagnostic did not catch them (stress "deafness" is persistent, Dupoux et al. 2008).
  if (declared === 'A2' || declared === 'B1') { add('a2-stress2', 0.25); add('a2-schwa', 0.25) }
  if (declared !== 'A2') add('b1-stress-long', 0.2)
  const levelOf = new Map(course.targets.map((t) => [t.id, t.level]))
  const L: Level[] = ['A2', 'B1', 'B2', 'C1']
  const scored = Object.entries(need)
    .filter(([id]) => levelOf.has(id) && L.indexOf(levelOf.get(id)!) <= L.indexOf(declared) + 1)
    .map(([id, n]) => [id, n * (IMPACT[id] ?? 0.5)] as const)
    .sort((a, b) => b[1] - a[1])
  const priorities = scored.slice(0, 5).map(([id]) => id)
  const domainOf = new Map(course.targets.map((t) => [t.id, t.domain]))
  const phono = { percevoir: 1, articuler: 1, prosodie: 1, aisance: 1 }
  const pOk = ev.perception.filter((p) => p.ok).length / Math.max(1, ev.perception.length)
  phono.percevoir = pOk
  for (const [id, n] of Object.entries(need)) {
    const d = domainOf.get(id) as keyof typeof phono
    if (d && d !== 'percevoir') phono[d] = Math.max(0.1, phono[d] - n * 0.18)
  }
  const sOk = ev.stress.filter((s) => s.ok).length / Math.max(1, ev.stress.length)
  phono.prosodie = Math.min(phono.prosodie, 0.3 + 0.7 * sOk)
  return { priorities, phono, needs: need }
}
