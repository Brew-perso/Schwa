/**
 * Learner → teacher report. Nothing leaves the device unless the learner explicitly exports this file
 * (charte §2.3 "espace privé", cadre §11.5). Recordings are included only if the learner ticks them.
 */
import { db } from '../data/db'
import type { Settings } from '../data/settings'
import { evidenceLevel } from './mastery'
import { weekStats } from './xp'

export interface LearnerReport {
  schema: 'schwa-report-v1'
  createdAt: string
  learner: { name: string; classCode: string; variety: string; level: string; goal: string }
  mastery: Record<string, { level: number; n4?: string; lastWorked?: string }>
  phono: Record<string, number>
  priorities: string[]
  week: { sessions: number; minutes: number; xp: number }
  totals: { attempts: number; perception: number; production: number; clearRate: number | null }
  errors: Record<string, number>        // target → count of "rework/refine" production attempts (last 30 days)
  samples?: { label: string; targetId?: string; ts: string; wavBase64: string }[]
}

async function blobToBase64(b: Blob): Promise<string> {
  const buf = new Uint8Array(await b.arrayBuffer())
  let s = ''
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000))
  return btoa(s)
}

export async function buildReport(s: Settings, includeSampleIds: number[] = []): Promise<LearnerReport> {
  const mastery = await db.mastery.toArray()
  const since = Date.now() - 30 * 86400000
  const attempts = await db.attempts.where('ts').above(since).toArray()
  const prod = attempts.filter((a) => a.kind === 'production')
  const judged = prod.filter((a) => a.ok !== null)
  const errors: Record<string, number> = {}
  for (const a of prod) if (a.state === 'rework' || a.state === 'refine') errors[a.targetId] = (errors[a.targetId] ?? 0) + 1
  const samples = []
  for (const id of includeSampleIds) {
    const p = await db.portfolio.get(id)
    if (p) samples.push({ label: p.label, targetId: p.targetId, ts: new Date(p.ts).toISOString(), wavBase64: await blobToBase64(p.audio) })
  }
  return {
    schema: 'schwa-report-v1',
    createdAt: new Date().toISOString(),
    learner: { name: s.name || 'Anonyme', classCode: s.classCode, variety: s.variety, level: s.level, goal: s.goal },
    mastery: Object.fromEntries(mastery.map((m) => [m.targetId, { level: evidenceLevel(m), n4: m.n4?.validatedBy, lastWorked: m.lastWorked ? new Date(m.lastWorked).toISOString() : undefined }])),
    phono: s.phono,
    priorities: s.priorities,
    week: await weekStats(),
    totals: { attempts: attempts.length, perception: attempts.length - prod.length, production: prod.length, clearRate: judged.length ? judged.filter((a) => a.ok).length / judged.length : null },
    errors,
    samples: samples.length ? samples : undefined,
  }
}

export function downloadJson(obj: unknown, name: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 1)], { type: 'application/json' }))
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}

/** Full personal data export (RGPD right of access / portability), recordings excluded (too large) unless asked. */
export async function exportAll() {
  const [kv, attempts, srs, mastery, portfolio, sessions] = await Promise.all([
    db.kv.toArray(), db.attempts.toArray(), db.srs.toArray(), db.mastery.toArray(), db.portfolio.toArray(), db.sessions.toArray(),
  ])
  return {
    schema: 'schwa-export-v1', exportedAt: new Date().toISOString(),
    kv, srs, mastery, sessions,
    attempts: attempts.map(({ audio, ...a }) => ({ ...a, hasAudio: !!audio })),
    portfolio: portfolio.map(({ audio, ...p }) => ({ ...p, audioBytes: audio?.size ?? 0 })),
  }
}
