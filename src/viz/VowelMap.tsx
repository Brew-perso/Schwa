/**
 * Simplified vowel map (charte §4.2): no F1/F2 jargon. Axes read "tongue front ↔ back" and "mouth closed ↔ open".
 * Targets are landing *zones*. The learner's point (normalised on their own voice, Lobanov) comes with an arrow.
 */
export const VOWEL_Z: Record<string, [number, number]> = {
  // [zF2 (front +), zF1 (open +)] — approximate speaker-normalised positions
  'iː': [1.55, -1.45], 'ɪ': [1.0, -0.55], 'ɛ': [0.8, 0.35], 'æ': [0.5, 1.3], 'ʌ': [-0.35, 0.75], 'ɑː': [-0.75, 1.55],
  'ɒ': [-1.1, 1.1], 'ɔː': [-1.2, 0.55], 'ʊ': [-0.75, -0.4], 'uː': [-0.45, -1.2], 'ɜː': [0.1, 0.2], 'ə': [0.0, 0.0],
}

export function VowelMap({ targets, learner, lang = 'fr', highlight }: {
  targets: string[]
  learner?: { z: [number, number]; label?: string } | null
  lang?: 'fr' | 'en'
  highlight?: string
}) {
  const W = 360, H = 280
  const px = (zf2: number) => W - 40 - ((zf2 + 2) / 4) * (W - 80)   // front on the left, as in the IPA chart
  const py = (zf1: number) => 36 + ((zf1 + 2) / 4) * (H - 72)
  const L = lang === 'fr'
    ? { front: 'langue en avant', back: 'langue en arrière', closed: 'bouche fermée', open: 'bouche ouverte' }
    : { front: 'tongue forward', back: 'tongue back', closed: 'mouth closed', open: 'mouth open' }
  const nearest = learner ? targets.reduce((b, t) => {
    const d = Math.hypot(VOWEL_Z[t][0] - learner.z[0], VOWEL_Z[t][1] - learner.z[1])
    return d < b.d ? { t, d } : b
  }, { t: targets[0], d: 1e9 }) : null
  const goal = highlight ?? nearest?.t
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 420 }} className="vowelmap" role="img"
      aria-label={lang === 'fr' ? 'Carte simplifiée des voyelles' : 'Simplified vowel map'}>
      {/* trapezoid */}
      <path d={`M${px(1.9)} ${py(-1.9)} L${px(-1.9)} ${py(-1.9)} L${px(-1.9)} ${py(1.9)} L${px(0.4)} ${py(1.9)} Z`} fill="var(--paper-2)" stroke="var(--ink)" strokeWidth="2" filter="url(#rough)" />
      <path d={`M${px(1.9)} ${py(-1.9)} L${px(0.4)} ${py(1.9)}`} stroke="var(--ink)" strokeWidth="1" strokeDasharray="3 4" opacity=".4" />
      <text x={W / 2} y={18} textAnchor="middle" fontSize="12" fill="var(--text-soft)">{L.closed}</text>
      <text x={W / 2} y={H - 6} textAnchor="middle" fontSize="12" fill="var(--text-soft)">{L.open}</text>
      <text x={14} y={H / 2} fontSize="12" fill="var(--text-soft)" transform={`rotate(-90 14 ${H / 2})`} textAnchor="middle">{L.front}</text>
      <text x={W - 10} y={H / 2} fontSize="12" fill="var(--text-soft)" transform={`rotate(90 ${W - 10} ${H / 2})`} textAnchor="middle">{L.back}</text>
      {targets.map((t) => {
        const [zx, zy] = VOWEL_Z[t]
        const on = t === goal
        return (
          <g key={t}>
            <ellipse cx={px(zx)} cy={py(zy)} rx="34" ry="24" fill={on ? 'color-mix(in srgb, var(--mint) 60%, transparent)' : 'color-mix(in srgb, var(--sky) 40%, transparent)'}
              stroke={on ? 'var(--teal)' : 'var(--ink-faint)'} strokeWidth="2" strokeDasharray={on ? undefined : '4 3'} />
            <text x={px(zx)} y={py(zy) + 6} textAnchor="middle" fontSize="20" fontFamily="var(--font-ipa)" fontWeight="700" fill="var(--text)">/{t}/</text>
          </g>
        )
      })}
      {learner && goal && (
        <g>
          {Math.hypot(VOWEL_Z[goal][0] - learner.z[0], VOWEL_Z[goal][1] - learner.z[1]) > 0.45 && (
            <path d={`M${px(learner.z[0])} ${py(learner.z[1])} L${px(VOWEL_Z[goal][0])} ${py(VOWEL_Z[goal][1])}`} stroke="var(--coral)" strokeWidth="3" markerEnd="url(#arrowhead)" fill="none" strokeDasharray="6 4" />
          )}
          <circle cx={px(learner.z[0])} cy={py(learner.z[1])} r="9" fill="var(--coral)" stroke="var(--ink)" strokeWidth="2" />
          {learner.label && <text x={px(learner.z[0]) + 14} y={py(learner.z[1]) - 10} fontSize="13" fontWeight="700" fill="var(--text)">{learner.label}</text>}
        </g>
      )}
      <defs>
        <marker id="arrowhead" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="var(--coral)" />
        </marker>
      </defs>
    </svg>
  )
}

/** Lobanov normalisation with calibration params (falls back to generic adult ranges). */
export function normaliseFormants(f1: number, f2: number, cal?: { f1: { m: number; s: number }; f2: { m: number; s: number } }): [number, number] {
  const c = cal ?? { f1: { m: 560, s: 170 }, f2: { m: 1650, s: 480 } }
  return [(f2 - c.f2.m) / c.f2.s, (f1 - c.f1.m) / c.f1.s]
}
