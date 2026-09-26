import { useMemo } from 'react'
import { mulberry32 } from './rng'

/** Decorative vintage celestial chart (ink on paper, or gold on night). Purely ornamental. */
export function StarChart({ seed = 7, night = false, className, rings = 4, style }: { seed?: number; night?: boolean; className?: string; rings?: number; style?: React.CSSProperties }) {
  const data = useMemo(() => {
    const r = mulberry32(seed)
    const stars = Array.from({ length: 90 }, () => ({ x: r() * 400, y: r() * 400, s: r() < 0.12 ? 1.8 + r() * 1.4 : 0.5 + r() * 0.9, tw: r() < 0.2 }))
    const cons: [number, number][][] = []
    for (let c = 0; c < 4; c++) {
      const cx = 60 + r() * 280, cy = 60 + r() * 280
      const pts: [number, number][] = []
      for (let k = 0; k < 4 + Math.floor(r() * 3); k++) pts.push([cx + (r() - 0.5) * 110, cy + (r() - 0.5) * 110])
      cons.push(pts)
    }
    return { stars, cons }
  }, [seed])
  const ink = night ? '#f1d488' : '#1d2334'
  return (
    <svg viewBox="0 0 400 400" className={className} style={style} aria-hidden="true" preserveAspectRatio="xMidYMid slice">
      <g stroke={ink} fill="none" opacity={night ? 0.35 : 0.16} strokeWidth="0.8">
        {Array.from({ length: rings }, (_, i) => <circle key={i} cx="200" cy="200" r={50 + i * 45} strokeDasharray={i % 2 ? '2 4' : undefined} />)}
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2
          return <line key={i} x1={200 + Math.cos(a) * 40} y1={200 + Math.sin(a) * 40} x2={200 + Math.cos(a) * 240} y2={200 + Math.sin(a) * 240} />
        })}
        {Array.from({ length: 72 }, (_, i) => {
          const a = (i / 72) * Math.PI * 2
          const r0 = 50 + (rings - 1) * 45
          return <line key={'t' + i} x1={200 + Math.cos(a) * r0} y1={200 + Math.sin(a) * r0} x2={200 + Math.cos(a) * (r0 + (i % 6 ? 4 : 9))} y2={200 + Math.sin(a) * (r0 + (i % 6 ? 4 : 9))} />
        })}
      </g>
      <g stroke={ink} strokeWidth="0.9" opacity={night ? 0.5 : 0.28} fill="none" strokeDasharray="1 2.5">
        {data.cons.map((pts, i) => <polyline key={i} points={pts.map((p) => p.join(',')).join(' ')} />)}
      </g>
      <g fill={ink}>
        {data.stars.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.s} opacity={night ? 0.9 : 0.45} style={s.tw && night ? { animation: `twinkle ${3 + (i % 5)}s ease-in-out ${i % 7}s infinite` } : undefined} />
        ))}
        {data.cons.flat().map((p, i) => <circle key={'c' + i} cx={p[0]} cy={p[1]} r="2.1" opacity={night ? 1 : 0.55} />)}
      </g>
    </svg>
  )
}
