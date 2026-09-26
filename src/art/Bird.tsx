/**
 * The Schwa bird — the small slate-blue songbird of the art direction (cork-board, 1930s–60s collage mock-up):
 * cream belly, ochre beak, a touch of blush, cut out like a sticker with a paper edge.
 * A calm companion, not a cartoon mascot (charte §1.2): no giant eyes, no speech bubbles, no guilt-tripping.
 */
type Pose = 'perch' | 'fly' | 'listen'

const C = {
  slate: '#7f95b5',
  slate2: '#5d7398',
  slate3: '#3f5276',
  cream: '#f6eedc',
  beak: '#d9943a',
  blush: '#e9a597',
  ink: '#1d2334',
  leg: '#b8743a',
  sticker: '#fbf6ea',
}

/** Silhouette pieces, drawn twice: once as a thick paper outline (the sticker edge), once in colour. */
function Body({ outline, wing }: { outline?: boolean; wing: 'fold' | 'up' }) {
  const o = outline ? { fill: C.sticker, stroke: C.sticker, strokeWidth: 10, strokeLinejoin: 'round' as const } : null
  return (
    <>
      {/* tail */}
      <path d="M66 118 L24 140 C22 146 26 150 32 148 L78 128 Z" {...(o ?? { fill: C.slate3 })} />
      {/* far wing, raised in flight */}
      {wing === 'up' && <path d="M92 92 C80 62 62 38 30 24 C46 50 58 76 74 106 Z" {...(o ?? { fill: C.slate3 })} />}
      {/* body */}
      <ellipse cx="108" cy="112" rx="52" ry="38" {...(o ?? { fill: C.slate })} />
      {/* head */}
      <circle cx="138" cy="66" r="29" {...(o ?? { fill: C.slate })} />
      {/* crest */}
      <path d="M118 42 C120 30 132 26 140 34 C132 34 126 38 122 44 Z" {...(o ?? { fill: C.slate2 })} />
      {/* beak */}
      <path d="M164 60 L184 67 L164 75 Z" {...(o ?? { fill: C.beak, stroke: C.ink, strokeWidth: 1.4, strokeLinejoin: 'round' as const })} />
      {!outline && (
        <>
          {/* cream throat & belly */}
          <path d="M104 148 C86 132 96 102 124 90 C142 84 160 86 164 96 C166 122 146 148 116 150 Z" fill={C.cream} />
          {wing === 'fold' ? (
            <g>
              <path d="M62 104 C76 84 114 82 132 100 C124 124 96 134 60 128 C58 118 58 110 62 104 Z" fill={C.slate2} />
              <path d="M70 110 C88 100 108 100 124 106" stroke={C.slate3} strokeWidth="2.4" fill="none" strokeLinecap="round" />
              <path d="M68 118 C86 112 104 112 118 116" stroke={C.slate3} strokeWidth="2.2" fill="none" strokeLinecap="round" />
              <path d="M66 124 C80 122 92 122 104 124" stroke={C.cream} strokeWidth="1.6" fill="none" strokeLinecap="round" opacity=".7" />
            </g>
          ) : (
            <g>
              {/* near wing, raised behind the head so the face stays visible */}
              <path d="M118 104 C104 70 90 40 62 10 C66 46 76 80 92 112 Z" fill={C.slate2} stroke={C.sticker} strokeWidth="3" strokeLinejoin="round" />
              <path d="M106 96 C98 72 88 50 72 30" stroke={C.slate3} strokeWidth="2.2" fill="none" strokeLinecap="round" />
              <path d="M98 104 C92 86 84 68 74 54" stroke={C.cream} strokeWidth="1.6" fill="none" strokeLinecap="round" opacity=".7" />
            </g>
          )}
          {/* halftone shading under the belly (risograph touch) */}
          <ellipse cx="112" cy="136" rx="38" ry="10" fill="url(#halftone)" opacity=".14" />
          {/* eye & blush */}
          <circle cx="148" cy="60" r="4.6" fill={C.ink} />
          <circle cx="149.6" cy="58.4" r="1.3" fill={C.cream} />
          <ellipse cx="152" cy="75" rx="7.5" ry="4.6" fill={C.blush} opacity=".75" />
        </>
      )}
    </>
  )
}

export function Bird({ pose = 'perch', size = 160, className, title }: { pose?: Pose; size?: number; className?: string; title?: string }) {
  const a11y = { role: title ? 'img' : undefined, 'aria-hidden': title ? undefined : true }
  if (pose === 'fly') {
    return (
      <svg viewBox="0 0 200 170" width={size} height={(size * 170) / 200} className={className} {...a11y}>
        {title && <title>{title}</title>}
        <g transform="rotate(-10 108 100)">
          <g filter="url(#cutout-shadow)"><Body outline wing="up" /></g>
          <Body wing="up" />
        </g>
      </svg>
    )
  }
  const head = pose === 'listen' ? 'rotate(-12 132 96)' : undefined
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} className={className} {...a11y}>
      {title && <title>{title}</title>}
      {/* perch: a slim crescent moon */}
      <g filter="url(#rough)">
        <path d="M24 180 C80 196 150 196 196 172 C154 186 84 188 24 180 Z" fill="#d6a03c" />
        <path d="M24 180 C80 196 150 196 196 172" stroke={C.ink} strokeWidth="1.6" fill="none" />
      </g>
      {/* legs */}
      <path d="M104 146 L100 180 M100 180 l-7 3 M100 180 l6 3 M124 146 L126 180 M126 180 l-6 3 M126 180 l7 3" stroke={C.leg} strokeWidth="3" strokeLinecap="round" fill="none" />
      <g transform={head}>
        <g filter="url(#cutout-shadow)"><Body outline wing="fold" /></g>
        <Body wing="fold" />
      </g>
    </svg>
  )
}
