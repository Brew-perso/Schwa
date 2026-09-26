import { useEffect, useRef, useState } from 'react'

/**
 * Animated mid-sagittal section (charte §4.2): tongue, lips, jaw, airflow, voicing.
 * Parametric, so we can morph from "the French habit" to "the English target".
 * Face turned to the left, as in phonetics textbooks.
 */
export interface Articulation {
  jaw: number        // 0 closed … 1 open
  round: number      // lip rounding 0..1
  spread: number     // lip spreading 0..1
  lipTeeth: number   // lower lip against upper teeth (f/v) 0..1
  tipX: number; tipY: number     // tongue tip
  bodyX: number; bodyY: number   // tongue dorsum
  air: 0 | 1         // show airflow
  airPath: 'mouth' | 'teeth' | 'lips' | 'breath' | 'none'
  voiced: 0 | 1
}

const N = (o: Partial<Articulation>): Articulation => ({ jaw: 0.25, round: 0, spread: 0.2, lipTeeth: 0, tipX: 90, tipY: 150, bodyX: 150, bodyY: 136, air: 0, airPath: 'none', voiced: 0, ...o })

export const PRESETS: Record<string, Articulation> = {
  rest: N({}),
  'θ': N({ jaw: 0.25, tipX: 66, tipY: 139, bodyX: 150, bodyY: 142, air: 1, airPath: 'teeth' }),
  'ð': N({ jaw: 0.25, tipX: 66, tipY: 139, bodyX: 150, bodyY: 142, air: 1, airPath: 'teeth', voiced: 1 }),
  s: N({ jaw: 0.12, tipX: 84, tipY: 124, bodyX: 145, bodyY: 132, air: 1, airPath: 'teeth' }),
  z: N({ jaw: 0.12, tipX: 84, tipY: 124, bodyX: 145, bodyY: 132, air: 1, airPath: 'teeth', voiced: 1 }),
  f: N({ jaw: 0.15, lipTeeth: 1, tipX: 90, tipY: 150, bodyX: 150, bodyY: 138, air: 1, airPath: 'lips' }),
  t: N({ jaw: 0.12, tipX: 84, tipY: 120, bodyX: 145, bodyY: 132, air: 0, airPath: 'none' }),
  h: N({ jaw: 0.45, tipX: 90, tipY: 160, bodyX: 150, bodyY: 150, air: 1, airPath: 'breath' }),
  'iː': N({ jaw: 0.08, spread: 1, tipX: 86, tipY: 150, bodyX: 118, bodyY: 116, voiced: 1 }),
  'ɪ': N({ jaw: 0.22, spread: 0.4, tipX: 88, tipY: 154, bodyX: 128, bodyY: 126, voiced: 1 }),
  'æ': N({ jaw: 0.8, spread: 0.6, tipX: 90, tipY: 168, bodyX: 128, bodyY: 156, voiced: 1 }),
  'ʌ': N({ jaw: 0.5, tipX: 92, tipY: 163, bodyX: 150, bodyY: 146, voiced: 1 }),
  'ɑː': N({ jaw: 0.75, tipX: 94, tipY: 168, bodyX: 168, bodyY: 158, voiced: 1 }),
  'ʊ': N({ jaw: 0.26, round: 0.45, tipX: 94, tipY: 160, bodyX: 164, bodyY: 124, voiced: 1 }),
  'uː': N({ jaw: 0.14, round: 1, tipX: 94, tipY: 158, bodyX: 170, bodyY: 114, voiced: 1 }),
  'ɔː': N({ jaw: 0.46, round: 0.85, tipX: 94, tipY: 164, bodyX: 172, bodyY: 142, voiced: 1 }),
  'əʊ-start': N({ jaw: 0.38, round: 0.2, tipX: 92, tipY: 161, bodyX: 154, bodyY: 138, voiced: 1 }),
  'əʊ-end': N({ jaw: 0.2, round: 0.85, tipX: 94, tipY: 158, bodyX: 166, bodyY: 122, voiced: 1 }),
  schwa: N({ jaw: 0.3, tipX: 90, tipY: 158, bodyX: 148, bodyY: 136, voiced: 1 }),
  'o-fr': N({ jaw: 0.3, round: 0.9, tipX: 94, tipY: 160, bodyX: 166, bodyY: 132, voiced: 1 }),
}

/** Pairs for lessons: [French habit, English target]. */
export const CONTRASTS: Record<string, { from: string; to: string; fromLabel: { fr: string; en: string }; toLabel: { fr: string; en: string } }> = {
  'θ': { from: 's', to: 'θ', fromLabel: { fr: '« s » : langue derrière les dents', en: "'s': tongue behind the teeth" }, toLabel: { fr: 'TH : pointe contre les dents, l’air glisse', en: 'TH: tip against the teeth, air slides out' } },
  h: { from: 'rest', to: 'h', fromLabel: { fr: 'Pas de souffle (h muet)', en: 'No breath (silent h)' }, toLabel: { fr: '/h/ : un souffle, gorge ouverte', en: '/h/: a breath, open throat' } },
  schwa: { from: 'æ', to: 'schwa', fromLabel: { fr: 'Voyelle pleine', en: 'Full vowel' }, toLabel: { fr: 'Schwa : tout est relâché', en: 'Schwa: everything relaxed' } },
  voicing: { from: 's', to: 'z', fromLabel: { fr: '/s/ : les cordes vocales se reposent', en: '/s/: vocal folds at rest' }, toLabel: { fr: '/z/ : elles vibrent', en: '/z/: they vibrate' } },
  diphthong: { from: 'əʊ-start', to: 'əʊ-end', fromLabel: { fr: 'Départ : bouche mi-ouverte', en: 'Start: mouth half-open' }, toLabel: { fr: 'Arrivée : lèvres arrondies', en: 'End: lips rounded' } },
  'ɪ-iː': { from: 'ɪ', to: 'iː', fromLabel: { fr: '/ɪ/ : langue détendue, un peu plus bas', en: '/ɪ/: relaxed tongue, a bit lower' }, toLabel: { fr: '/iː/ : langue haute et tendue, sourire', en: '/iː/: high tense tongue, smile' } },
  'æ-ʌ': { from: 'æ', to: 'ʌ', fromLabel: { fr: '/æ/ : mâchoire basse, lèvres étirées', en: '/æ/: low jaw, spread lips' }, toLabel: { fr: '/ʌ/ : mi-ouvert, central, relâché', en: '/ʌ/: half-open, central, relaxed' } },
  'ʊ-uː': { from: 'ʊ', to: 'uː', fromLabel: { fr: '/ʊ/ : lèvres à peine arrondies', en: '/ʊ/: lips barely rounded' }, toLabel: { fr: '/uː/ : moue, langue haute en arrière', en: '/uː/: pout, tongue high at the back' } },
}

function lerp(a: Articulation, b: Articulation, t: number): Articulation {
  const o = { ...b }
  for (const k of ['jaw', 'round', 'spread', 'lipTeeth', 'tipX', 'tipY', 'bodyX', 'bodyY'] as const) o[k] = a[k] + (b[k] - a[k]) * t
  return o
}

export function useTween(target: Articulation, ms = 650): Articulation {
  const [cur, setCur] = useState(target)
  const from = useRef(target)
  useEffect(() => {
    const start = performance.now()
    const a = from.current
    let raf = 0
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduce'
    const step = (now: number) => {
      const t = reduce ? 1 : Math.min(1, (now - start) / ms)
      const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
      const v = lerp(a, target, e)
      setCur(v)
      from.current = v
      if (t < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return cur
}

export function Sagittal({ art, size = 300, title }: { art: Articulation; size?: number; title?: string }) {
  const a = useTween(art)
  const rot = a.jaw * 11
  const pivot = '232 112'
  // tongue surface (root → dorsum → tip) and underside (tip → floor → root), expressed in the jaw frame for the floor
  const floorY = 176 + a.jaw * 18
  const surf = `C 198 244, ${a.bodyX + 42} ${a.bodyY + 2}, ${a.bodyX} ${a.bodyY} C ${a.bodyX - 28} ${a.bodyY - 1}, ${a.tipX + 18} ${a.tipY - 7}, ${a.tipX} ${a.tipY}`
  const tongue = `M198 300 ${surf} C ${a.tipX - 3} ${a.tipY + 8}, ${a.tipX + 4} ${a.tipY + 15}, ${a.tipX + 16} ${a.tipY + 17} C 120 ${floorY}, 150 ${floorY + 10}, 172 ${floorY + 30} C 182 ${floorY + 44}, 186 272, 188 300 Z`
  const tract = `M78 116 C 90 110, 104 108, 116 108 C 140 104, 164 100, 186 104 C 202 108, 212 120, 216 138 C 220 170, 222 230, 224 300 L 198 300 ${surf} L 80 ${Math.max(a.tipY, 142 + a.jaw * 14)} L 78 140 Z`
  // lips
  const protrude = a.round * 10 - a.spread * 3
  const upperLip = `M62 122 C 50 121, ${41 - protrude} 125, ${40 - protrude} 131 C ${43 - protrude} 136, 52 138, 66 137 Z`
  const lt = a.lipTeeth
  const lowerLip = `M66 ${141} C ${52 + lt * 10} ${141 - lt * 4}, ${42 - protrude + lt * 18} ${145 - lt * 6}, ${44 - protrude + lt * 18} ${151 - lt * 6} C ${48 - protrude + lt * 12} ${158}, 58 ${158}, 68 154 Z`
  const air = a.airPath
  const mid = (a.bodyY + 104) / 2
  const airD = air === 'teeth'
    ? `M210 286 C 212 220, 210 150, 186 ${mid} C 150 ${mid - 8}, 110 ${a.tipY - 8}, 74 ${a.tipY - 3} L 26 ${a.tipY - 3}`
    : air === 'lips'
      ? `M210 286 C 212 220, 210 150, 186 ${mid} C 150 ${mid}, 110 132, 70 136 L 26 138`
      : air === 'breath'
        ? `M210 292 C 212 220, 210 160, 180 ${mid + 6} C 140 ${mid + 8}, 100 ${140 + a.jaw * 8}, 66 ${140 + a.jaw * 8} L 20 ${141 + a.jaw * 8}`
        : air === 'mouth' ? `M210 286 C 212 220, 210 150, 186 ${mid} C 150 ${mid}, 110 138, 70 140 L 26 140` : ''
  return (
    <svg viewBox="0 0 300 300" width={size} height={size} role="img" aria-label={title ?? 'Coupe de la bouche'} style={{ maxWidth: '100%' }}>
      {title && <title>{title}</title>}
      <defs>
        <clipPath id="sag-frame"><rect x="0" y="0" width="300" height="300" rx="22" /></clipPath>
        <marker id="airhead" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--teal-2)" />
        </marker>
      </defs>
      <g clipPath="url(#sag-frame)">
        <rect width="300" height="300" fill="color-mix(in srgb, var(--sky) 22%, var(--paper-card))" />
        {/* lower face (jaw group) */}
        <g transform={`rotate(${rot} ${pivot})`}>
          <path d="M60 139 C 48 141, 42 147, 46 154 C 50 160, 56 163, 56 170 C 52 182, 50 198, 58 208 C 72 224, 100 232, 130 236 C 152 240, 162 262, 166 300 L 360 300 L 360 96 L 232 96 L 232 139 Z" fill="var(--blush)" stroke="var(--ink)" strokeWidth="2.2" strokeLinejoin="round" />
          <path d="M66 142 C 69 139, 73 139, 77 141 L 78 160 C 74 162, 70 162, 67 160 Z" fill="#fbf6ea" stroke="var(--ink)" strokeWidth="1.5" />
          <path d={lowerLip} fill="var(--rust)" stroke="var(--ink)" strokeWidth="1.8" strokeLinejoin="round" />
        </g>
        {/* upper head */}
        <path d="M58 0 C 54 22, 50 44, 42 62 C 36 76, 22 88, 20 98 C 19 105, 27 109, 41 111 C 47 113, 50 117, 48 124 L 62 130 L 300 128 L 300 0 Z" fill="var(--blush)" stroke="var(--ink)" strokeWidth="2.2" strokeLinejoin="round" />
        {/* nasal cavity */}
        <path d="M58 104 C 96 94, 150 90, 196 96 C 206 98, 210 106, 204 110 C 160 104, 110 106, 66 112 Z" fill="var(--paper-card)" stroke="var(--ink)" strokeWidth="1.2" opacity=".85" />
        {/* airway (oral + pharynx) */}
        <g transform={`rotate(${rot * 0.35} ${pivot})`}>
          <path d={tract} fill="var(--paper-card)" stroke="var(--ink)" strokeWidth="1.2" strokeLinejoin="round" />
        </g>
        {/* velum */}
        <path d="M184 104 C 200 106, 210 118, 208 136 C 206 144, 198 142, 197 134 C 196 124, 190 114, 178 110 Z" fill="#f2a88f" stroke="var(--ink)" strokeWidth="1.5" />
        {/* hard palate line */}
        <path d="M76 118 C 90 110, 104 108, 116 108 C 140 104, 164 100, 186 104" fill="none" stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" />
        {/* tongue */}
        <g transform={`rotate(${rot * 0.35} ${pivot})`}>
          <path d={tongue} fill="var(--coral)" stroke="var(--ink)" strokeWidth="2.2" strokeLinejoin="round" />
          <path d={`M ${a.bodyX + 16} ${a.bodyY + 16} C ${a.bodyX - 6} ${a.bodyY + 16}, ${a.tipX + 26} ${a.tipY + 6}, ${a.tipX + 14} ${a.tipY + 8}`} fill="none" stroke="#a9482f" strokeWidth="1.4" opacity=".7" />
        </g>
        {/* upper incisor & lip */}
        <path d="M66 120 L 78 118 L 78 138 C 74 141, 70 141, 67 139 Z" fill="#fbf6ea" stroke="var(--ink)" strokeWidth="1.5" />
        <path d={upperLip} fill="var(--rust)" stroke="var(--ink)" strokeWidth="1.8" strokeLinejoin="round" />
        {/* larynx */}
        <g transform="translate(211 280)">
          <rect x="-16" y="-4" width="32" height="10" rx="3" fill="var(--paper-2)" stroke="var(--ink)" strokeWidth="1.2" />
          {a.voiced ? (
            <path d="M-12 1 l4 -5 l4 5 l4 -5 l4 5 l4 -5 l4 5" fill="none" stroke="var(--amber)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <animateTransform attributeName="transform" type="translate" values="0 0; 0 1.5; 0 0" dur=".12s" repeatCount="indefinite" />
            </path>
          ) : <line x1="-12" x2="12" y1="1" y2="1" stroke="var(--amber)" strokeWidth="2.6" strokeLinecap="round" />}
        </g>
        {a.air ? (
          <path d={airD} fill="none" stroke="var(--teal-2)" strokeWidth={air === 'breath' ? 6 : 4} strokeLinecap="round" strokeDasharray="9 8" opacity=".9" markerEnd="url(#airhead)">
            <animate attributeName="stroke-dashoffset" from="34" to="0" dur=".9s" repeatCount="indefinite" />
          </path>
        ) : null}
      </g>
      <rect x="1" y="1" width="298" height="298" rx="22" fill="none" stroke="var(--ink)" strokeWidth="2" />
    </svg>
  )
}

/** Morphing demo: toggles between the French habit and the English target. */
export function SagittalContrast({ id, lang = 'fr' }: { id: string; lang?: 'fr' | 'en' }) {
  const c = CONTRASTS[id]
  const [target, setTarget] = useState(true)
  useEffect(() => {
    if (!c) return
    const iv = setInterval(() => setTarget((x) => !x), 2600)
    return () => clearInterval(iv)
  }, [c])
  if (!c) return <Sagittal art={PRESETS[id] ?? PRESETS.rest} />
  return (
    <div style={{ display: 'grid', justifyItems: 'center', gap: 8 }}>
      <Sagittal art={PRESETS[target ? c.to : c.from]} size={260} />
      <div role="status" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button className={`chip ${!target ? 'on' : ''}`} onClick={() => setTarget(false)}>{lang === 'fr' ? 'Habitude française' : 'French habit'}</button>
        <button className={`chip ${target ? 'on' : ''}`} onClick={() => setTarget(true)}>{lang === 'fr' ? 'Cible anglaise' : 'English target'}</button>
      </div>
      <p className="small muted center" style={{ margin: 0, maxWidth: 320 }}>{target ? c.toLabel[lang] : c.fromLabel[lang]}</p>
    </div>
  )
}
