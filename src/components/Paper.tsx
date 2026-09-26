import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { hashString, roughRect } from '../art/rng'

type Props = {
  children: ReactNode
  tone?: 'card' | 'kraft' | 'night' | 'mint' | 'blush' | 'sky'
  tape?: string
  tapeTone?: '' | 'teal' | 'coral' | 'indigo' | 'night'
  tilt?: number
  seed?: string
  className?: string
  style?: CSSProperties
  pad?: number
  as?: 'div' | 'section' | 'article'
  onClick?: () => void
  label?: string
}

const FILL: Record<string, string> = {
  card: 'var(--paper-card)', kraft: 'var(--paper-2)', night: 'var(--night)', mint: 'color-mix(in srgb, var(--mint) 38%, var(--paper-card))',
  blush: 'color-mix(in srgb, var(--blush) 55%, var(--paper-card))', sky: 'color-mix(in srgb, var(--sky) 40%, var(--paper-card))',
}

/** A cut-paper card: its edge is a slightly irregular hand-cut path (stable per seed), with a collage shadow. */
export function Paper({ children, tone = 'card', tape, tapeTone = '', tilt = 0, seed, className = '', style, pad = 18, as = 'div', onClick, label }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<[number, number]>([0, 0])
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const r = e.contentRect
      setSize([Math.round(r.width + pad * 2), Math.round(r.height + pad * 2)])
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [pad])
  const [w, h] = size
  const path = w && h ? roughRect(w, h, hashString(seed ?? String(w)), 1.6, 16) : ''
  const Tag = as
  return (
    <Tag className={`paper-cut ${className}`} style={{ position: 'relative', transform: tilt ? `rotate(${tilt}deg)` : undefined, color: tone === 'night' ? '#f3ead7' : undefined, ...style }}
      onClick={onClick} aria-label={label}>
      {w > 0 && (
        <svg className="paper-cut-bg" width={w} height={h} viewBox={`-3 -3 ${w + 6} ${h + 6}`} style={{ position: 'absolute', left: -3, top: -3, width: w + 6, height: h + 6, overflow: 'visible', pointerEvents: 'none' }} aria-hidden="true">
          <path d={path} fill="rgba(29,35,52,.16)" transform="translate(2 3)" style={{ filter: 'blur(2.5px)' }} />
          <path d={path} fill={FILL[tone]} />
          <path d={path} fill="none" stroke="rgba(29,35,52,.10)" strokeWidth="1" />
        </svg>
      )}
      {tape && <span className={`tape ${tapeTone}`} style={{ position: 'absolute', top: -11, left: 18, zIndex: 2 }}>{tape}</span>}
      <div ref={ref} style={{ position: 'relative', padding: pad }}>{children}</div>
    </Tag>
  )
}
