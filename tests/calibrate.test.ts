import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { evaluate } from '../src/engine/evaluate'

const DIR = new URL('./fixtures/eval/', import.meta.url)
const units = JSON.parse(readFileSync(new URL('../public/models/engine.json', import.meta.url), 'utf8')).units as string[]
const cases = JSON.parse(readFileSync(new URL('cases.json', DIR), 'utf8')) as any[]

function f32(name: string) {
  const b = readFileSync(new URL(name, DIR))
  return new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4)
}

/** The model recording: the correct rendition of the same text by a different voice (as in the app). */
function modelFor(c: any) {
  const [base, , voice] = c.id.split(/-(?=[a-z]+-[a-z]+_[a-z]+$)|-(?=[a-z]+_[a-z]+$)/)
  const m = cases.find((x) => x.id.startsWith(base + '-ok-') && !x.id.endsWith(voice))
    ?? cases.find((x) => x.id.startsWith(base + '-ok-'))
  if (!m) return undefined
  const r = evaluate({ audio: f32(m.id + '.audio.bin'), lp: f32(m.id + '.lp.bin'), T: m.T, V: m.V, ref: c.ref, checks: [], expect: {}, level: 'B1' }, units)
  return r.qc ? undefined : r.sylRaw
}

describe('evaluator calibration on synthetic correct vs French-accented renditions', () => {
  const rows: string[] = []
  let good = 0, total = 0, falseAlarm = 0, clearCases = 0
  for (const c of cases) {
    it(c.id, () => {
      const audio = f32(c.id + '.audio.bin')
      const lp = f32(c.id + '.lp.bin')
      const r = evaluate({ audio, lp, T: c.T, V: c.V, ref: c.ref, checks: c.checks, expect: c.expect, level: 'B1', competitor: c.competitor ?? undefined, model: process.env.NOMODEL ? undefined : modelFor(c) }, units)
      let verdict = ''
      let ok = false
      if (c.competitor) {
        verdict = `pair=${r.pair?.heard} m=${r.pair?.margin.toFixed(1)}`
        ok = c.label === 'target' ? r.pair?.heard === 'target' : r.pair?.heard === 'competitor'
        if (c.label === 'target') { clearCases++; if (r.pair?.heard === 'competitor') falseAlarm++ }
      } else {
        const st = r.priority?.state ?? (r.issues.some((i) => i.state === 'unsure') ? 'unsure' : 'clear')
        verdict = `prio=${r.priority?.kind ?? '-'}:${r.priority?.state ?? '-'} checks=${r.checks.map((x) => `${units[x.target] ?? '∅'}${x.realized ? '>' + x.realized : ''}:${x.llr.toFixed(1)}`).join(',')} syl=${r.syllables.map((s) => s.perceived).join('/')} tone=${r.tone.shape} qc=${r.qc}`
        ok = c.label === 'clear' ? (st === 'clear' || st === 'unsure') : (st === 'rework' || st === 'refine')
        if (c.label === 'clear') { clearCases++; if (st === 'rework' || st === 'refine') falseAlarm++ }
      }
      total++; if (ok) good++
      rows.push(`${ok ? 'OK ' : 'XX '} ${c.id.padEnd(26)} ${c.label.padEnd(10)} ${verdict}`)
      expect(true).toBe(true)
    })
  }
  it('summary', () => {
    console.log(rows.join('\n'))
    console.log(`accuracy ${good}/${total}  false alarms on correct renditions ${falseAlarm}/${clearCases}`)
  })
})
