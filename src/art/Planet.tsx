import { useMemo } from 'react'
import { hashString, mulberry32, roughCircle } from './rng'

export const PLANET_COLORS: Record<string, [string, string, string]> = {
  // base, light, dark
  coral: ['#e07a5f', '#f2a88f', '#a9482f'],
  mustard: ['#d6a03c', '#ecc672', '#9a6d17'],
  teal: ['#2b7a76', '#5aa7a1', '#17504d'],
  mint: ['#8fcfb8', '#c2e8da', '#4f9a82'],
  indigo: ['#3e3a8c', '#6d69bf', '#27235e'],
  plum: ['#6d2f63', '#a25a96', '#46183f'],
  sky: ['#8db6d6', '#bcd8ec', '#557fa3'],
}

export type PlanetState = 'locked' | 'open' | 'progress' | 'mastered'

type Props = {
  id: string
  color: string
  motif?: string
  size?: number
  state?: PlanetState
  progress?: number // 0..1
  label?: string
  className?: string
}

/** A hand-cut paper planet: wobbly disc, halftone terminator shading, printed motif, optional ring. */
export function Planet({ id, color, motif = 'dots', size = 96, state = 'open', progress = 0, label, className }: Props) {
  const [base, light, dark] = PLANET_COLORS[color] ?? PLANET_COLORS.coral
  const seed = hashString(id)
  const g = useMemo(() => {
    const r = mulberry32(seed)
    const disc = roughCircle(50, 50, 30, seed, 0.03)
    const craters = Array.from({ length: 5 }, () => ({ x: 34 + r() * 32, y: 32 + r() * 34, r: 1.8 + r() * 3.8 }))
    const tilt = -25 + r() * 50
    const stars = Array.from({ length: 4 }, () => ({ x: r() * 100, y: r() * 100, s: 0.6 + r() * 1.2 }))
    return { disc, craters, tilt, stars }
  }, [seed])
  const clip = `pc-${seed}`
  const dim = state === 'locked'
  const ring = motif === 'rings'
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}
      style={{ overflow: 'visible', opacity: dim ? 0.55 : 1, filter: dim ? 'grayscale(.7)' : undefined }}>
      <defs>
        <clipPath id={clip}><path d={g.disc} /></clipPath>
      </defs>
      {/* back half of the ring */}
      {ring && (
        <g transform={`rotate(${g.tilt} 50 50)`}>
          <path d="M8 50 A42 11 0 0 1 92 50" fill="none" stroke={dark} strokeWidth="5" opacity=".85" />
          <path d="M8 50 A42 11 0 0 1 92 50" fill="none" stroke={light} strokeWidth="1.4" />
        </g>
      )}
      <g filter="url(#cutout-shadow)">
        <path d={g.disc} fill={base} />
        <g clipPath={`url(#${clip})`}>
          {motif === 'bands' && (
            <g transform={`rotate(${g.tilt / 2} 50 50)`}>
              <rect x="0" y="34" width="100" height="6" fill={light} />
              <rect x="0" y="46" width="100" height="3" fill={dark} opacity=".6" />
              <rect x="0" y="55" width="100" height="8" fill={light} opacity=".8" />
              <rect x="0" y="68" width="100" height="3" fill={dark} opacity=".5" />
            </g>
          )}
          {motif === 'dots' && g.craters.map((c, i) => <circle key={i} cx={c.x} cy={c.y} r={c.r} fill={dark} opacity=".55" />)}
          {motif === 'swirl' && (
            <path d="M22 60 C 36 40, 58 70, 78 44 M 26 44 C 40 32, 56 50, 74 34" stroke={light} strokeWidth="3.2" fill="none" strokeLinecap="round" />
          )}
          {motif === 'crescent' && <circle cx="62" cy="44" r="26" fill={dark} opacity=".45" />}
          {motif === 'stars' && (
            <g fill={light}>
              <path d="M40 40 l2 5 5 1 -4 3 1 5 -4-3 -4 3 1-5 -4-3 5-1z" />
              <circle cx="60" cy="60" r="2.2" />
              <circle cx="56" cy="36" r="1.4" />
            </g>
          )}
          {/* halftone terminator (risograph shadow) */}
          <circle cx="66" cy="66" r="34" fill="url(#halftone)" opacity=".42" />
          <circle cx="36" cy="34" r="9" fill="#fff" opacity=".18" />
        </g>
        <path d={g.disc} fill="none" stroke="#1d2334" strokeWidth="1.5" filter="url(#rough)" opacity=".85" />
      </g>
      {/* front half of the ring */}
      {ring && (
        <g transform={`rotate(${g.tilt} 50 50)`}>
          <path d="M8 50 A42 11 0 0 0 92 50" fill="none" stroke={dark} strokeWidth="5" />
          <path d="M8 50 A42 11 0 0 0 92 50" fill="none" stroke={light} strokeWidth="1.4" />
        </g>
      )}
      {/* progress orbit */}
      {state !== 'locked' && progress > 0 && (
        <circle cx="50" cy="50" r="44" fill="none" stroke={state === 'mastered' ? '#d6a03c' : '#2b7a76'} strokeWidth="3"
          strokeDasharray={`${Math.max(0.001, progress) * 276.5} 276.5`} strokeLinecap="round" transform="rotate(-90 50 50)" opacity=".95" />
      )}
      {state === 'mastered' && (
        <g transform="translate(76 10)">
          <path d="M8 0 l2.4 5.2 5.6.6 -4.2 3.8 1.2 5.6 -5-2.9 -5 2.9 1.2-5.6 -4.2-3.8 5.6-.6z" fill="#f1d488" stroke="#1d2334" strokeWidth="1.2" />
        </g>
      )}
      {state === 'locked' && (
        <g transform="translate(40 40)" opacity=".9">
          <rect x="3" y="9" width="14" height="10" rx="2" fill="#1d2334" />
          <path d="M6 9 V6 a4 4 0 0 1 8 0 V9" stroke="#1d2334" strokeWidth="2.2" fill="none" />
        </g>
      )}
    </svg>
  )
}
