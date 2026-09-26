import { curveBasis, line } from 'd3-shape'
import type { AudioRef } from '../content/types'

/**
 * Melody curve (charte §4.1): a heavily smoothed contour over the model's, no Hz axis — only the shape counts
 * ("your voice rises at the end instead of falling"). Both curves are centred on their own median.
 */
function smooth(pts: [number, number][], win = 5): [number, number][] {
  return pts.map((p, i) => {
    let s = 0, n = 0
    for (let k = -win; k <= win; k++) { const q = pts[i + k]; if (q && Math.abs(q[0] - p[0]) < 0.08) { s += q[1]; n++ } }
    return [p[0], s / n]
  })
}

function prep(values: (number | null)[], fps: number, t0: number, t1: number): [number, number][] {
  const out: [number, number][] = []
  values.forEach((v, i) => {
    const t = i / fps
    if (v === null || v === undefined || Number.isNaN(v) || t < t0 || t > t1) return
    out.push([(t - t0) / Math.max(0.05, t1 - t0), v])
  })
  if (!out.length) return out
  const sorted = out.map((p) => p[1]).sort((a, b) => a - b)
  const med = sorted[Math.floor(sorted.length / 2)]
  return smooth(out.map(([x, y]) => [x, y - med]))
}

export function Melody({ model, learner, learnerSpan, words, height = 150 }: {
  model?: AudioRef
  learner?: { f0: number[]; fps: number }
  learnerSpan?: [number, number]
  words?: string[]
  height?: number
}) {
  const W = 560, H = height
  const mT0 = model?.wt?.find(Boolean)?.[0] ?? 0
  const mT1 = [...(model?.wt ?? [])].reverse().find(Boolean)?.[1] ?? (model?.d ?? 1)
  const m = model?.f0 ? prep(model.f0, 50, mT0, mT1) : []
  const l = learner ? prep(learner.f0, learner.fps, learnerSpan?.[0] ?? 0, learnerSpan?.[1] ?? learner.f0.length / learner.fps) : []
  const all = [...m, ...l].map((p) => p[1])
  const lo = Math.min(-4, ...all), hi = Math.max(4, ...all)
  const x = (v: number) => 16 + v * (W - 32)
  const y = (v: number) => H - 20 - ((v - lo) / (hi - lo)) * (H - 40)
  const gen = line<[number, number]>().x((p) => x(p[0])).y((p) => y(p[1])).curve(curveBasis)
  // split into voiced runs so the curve doesn't bridge long silences
  const runs = (pts: [number, number][]) => {
    const r: [number, number][][] = []
    let cur: [number, number][] = []
    for (const p of pts) { if (cur.length && p[0] - cur[cur.length - 1][0] > 0.06) { r.push(cur); cur = [] } cur.push(p) }
    if (cur.length) r.push(cur)
    return r.filter((q) => q.length > 2)
  }
  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H + 26}`} width="100%" role="img" aria-label="Courbe mélodique : modèle en pointillés, votre voix en trait plein">
        <line x1="16" x2={W - 16} y1={y(0)} y2={y(0)} stroke="var(--rule)" strokeDasharray="2 5" />
        {runs(m).map((r, i) => <path key={'m' + i} d={gen(r) ?? ''} fill="none" stroke="var(--indigo)" strokeWidth="5" strokeLinecap="round" strokeDasharray="1 9" opacity=".75" />)}
        {runs(l).map((r, i) => <path key={'l' + i} d={gen(r) ?? ''} fill="none" stroke="var(--coral)" strokeWidth="4.5" strokeLinecap="round" filter="url(#rough)" />)}
        {words && model?.wt && words.map((w, i) => {
          const t = model.wt?.[i]
          if (!t) return null
          const cx = x(((t[0] + t[1]) / 2 - mT0) / Math.max(0.05, mT1 - mT0))
          return <text key={i} x={cx} y={H + 18} textAnchor="middle" fontSize="14" fill="var(--text-2)" fontFamily="var(--font-body)">{w}</text>
        })}
      </svg>
      <figcaption className="small muted" style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
        <span><svg width="28" height="8"><line x1="2" x2="26" y1="4" y2="4" stroke="var(--indigo)" strokeWidth="4" strokeDasharray="1 6" strokeLinecap="round" /></svg> modèle</span>
        {learner && <span><svg width="28" height="8"><line x1="2" x2="26" y1="4" y2="4" stroke="var(--coral)" strokeWidth="4" strokeLinecap="round" /></svg> vous</span>}
      </figcaption>
    </figure>
  )
}
