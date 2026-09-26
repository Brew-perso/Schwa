import type { RefWord } from '../content/types'
import { useT } from '../i18n'

const REDUCED = new Set([36]) // unit index of ə in the engine inventory (checked at runtime too)

/**
 * Syllable bubbles (charte §4.1): circle size = prominence. Weak syllables with schwa are tiny grey dots.
 * Top row: the model (expected pattern). Bottom row: the learner (measured duration × intensity × pitch).
 */
export function Bubbles({ word, units, stress, learner, perceived, compact = false, labels = true }: {
  word: RefWord
  units: string[]
  stress?: number | null
  learner?: number[] | null
  perceived?: number | null
  compact?: boolean
  labels?: boolean
}) {
  const t = useT()
  const expected = stress ?? word.st ?? 0
  // which syllables have a reduced vowel?
  let k = 0
  const reduced = word.syl.map((s) => {
    const u = word.u.slice(k, k + s.n).map((i) => units[i])
    k += s.n
    return u.includes('ə') && s.s === 0
  })
  const R = compact ? 0.72 : 1
  const modelR = word.syl.map((s, i) => (i === expected ? 30 : s.s === 2 ? 19 : reduced[i] ? 6 : 13) * R)
  let learnR: number[] | null = null
  if (learner && learner.length === word.syl.length) {
    const mx = Math.max(...learner), mn = Math.min(...learner)
    learnR = learner.map((p) => (mx - mn < 1e-6 ? 16 : 8 + ((p - mn) / (mx - mn)) * 22) * R)
  }
  const colW = Math.max(...modelR, ...(learnR ?? [0])) * 2 + 16
  const H = (learnR ? 2 : 1) * (62 * R) + 8
  const W = colW * word.syl.length
  return (
    <figure style={{ margin: 0 }} aria-label={t('bubbles_aria', { w: word.w, syl: word.syl.map((s, i) => (i === expected ? s.l.toUpperCase() : s.l)).join('-') })}>
      <svg viewBox={`0 0 ${W} ${H + (labels ? 22 : 0)}`} width="100%" style={{ maxWidth: Math.min(560, W * 1.2), display: 'block', margin: '0 auto', overflow: 'visible' }}>
        {word.syl.map((s, i) => {
          const cx = colW * i + colW / 2
          const cy = 31 * R + 2
          const r = modelR[i]
          const strong = i === expected
          return (
            <g key={'m' + i}>
              {reduced[i] && !strong
                ? <circle cx={cx} cy={cy} r={r} fill="var(--ink-faint)" />
                : <g filter="url(#rough)">
                    <circle cx={cx} cy={cy} r={r} fill={strong ? 'var(--coral)' : 'var(--paper-3)'} stroke="var(--ink)" strokeWidth="2" />
                    {strong && <circle cx={cx + r * 0.25} cy={cy + r * 0.25} r={r * 0.75} fill="url(#halftone)" opacity=".25" />}
                  </g>}
              {learnR && (
                <g>
                  <circle cx={cx} cy={cy + 62 * R} r={learnR[i]} fill={perceived === i ? (perceived === expected ? 'var(--mint)' : 'var(--mustard)') : 'var(--paper-2)'}
                    stroke="var(--ink)" strokeWidth="2" strokeDasharray={perceived === i && perceived !== expected ? '4 3' : undefined} />
                </g>
              )}
              {labels && (
                <text x={cx} y={H + 16} textAnchor="middle" fontSize={strong ? 16 : 14} fontWeight={strong ? 800 : 500} fill="var(--text)"
                  fontFamily="var(--font-body)">{strong ? s.l.toUpperCase() : s.l}</text>
              )}
            </g>
          )
        })}
      </svg>
    </figure>
  )
}
void REDUCED
