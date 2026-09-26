/**
 * The Schwa swallow — a mid-century, Charley-Harper-inspired geometric bird.
 * Used sparingly (onboarding, celebrations, empty states): an emblem, not a cartoon mascot.
 */
type Pose = 'perch' | 'fly' | 'listen'

export function Swallow({ pose = 'perch', size = 160, className, title }: { pose?: Pose; size?: number; className?: string; title?: string }) {
  const navy = '#1f2a4a'
  const navy2 = '#2c3a66'
  const cream = '#f6eedc'
  const rust = '#c05a33'
  const teal = '#2b7a76'
  if (pose === 'fly') {
    return (
      <svg viewBox="0 0 240 160" width={size} height={(size * 160) / 240} className={className} role={title ? 'img' : undefined} aria-hidden={title ? undefined : true}>
        {title && <title>{title}</title>}
        <g filter="url(#cutout-shadow)">
          {/* upper wing (far) */}
          <path d="M112 74 C 92 44, 60 22, 14 12 C 50 30, 78 52, 96 82 Z" fill={navy2} />
          {/* tail streamers */}
          <path d="M92 92 C 70 104, 48 118, 20 142 C 44 126, 66 116, 88 108 Z" fill={navy} />
          <path d="M96 96 C 82 112, 66 132, 52 156 C 70 136, 86 120, 100 108 Z" fill={navy} />
          {/* body */}
          <path d="M84 96 C 104 76, 140 64, 170 66 C 186 67, 198 74, 204 82 C 196 88, 184 92, 170 94 C 140 100, 110 104, 84 96 Z" fill={navy} />
          {/* belly */}
          <path d="M104 98 C 128 98, 154 94, 172 90 C 160 100, 136 108, 110 106 Z" fill={cream} />
          {/* throat */}
          <path d="M184 86 C 190 84, 198 82, 204 82 C 198 88, 190 91, 180 92 Z" fill={rust} />
          {/* near wing */}
          <path d="M134 80 C 150 50, 176 26, 226 10 C 196 34, 174 60, 158 90 Z" fill={navy2} />
          <path d="M150 74 C 166 52, 186 34, 214 20" stroke={teal} strokeWidth="2.2" fill="none" strokeLinecap="round" opacity=".8" />
          {/* head details */}
          <circle cx="188" cy="76" r="3.6" fill={cream} />
          <circle cx="189" cy="76" r="1.9" fill={navy} />
          <path d="M204 81 L 214 82 L 204 84 Z" fill={navy} />
        </g>
      </svg>
    )
  }
  const tilt = pose === 'listen' ? 'rotate(-8 150 80)' : undefined
  return (
    <svg viewBox="0 0 240 200" width={size} height={(size * 200) / 240} className={className} role={title ? 'img' : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      {/* perch: a slim crescent moon */}
      <g filter="url(#rough)">
        <path d="M30 168 C 90 186, 170 186, 222 160 C 176 176, 96 176, 30 168 Z" fill="#d6a03c" />
        <path d="M30 168 C 90 186, 170 186, 222 160" stroke={navy} strokeWidth="1.6" fill="none" />
      </g>
      <g filter="url(#cutout-shadow)" transform={tilt}>
        {/* tail streamers */}
        <path d="M86 122 C 66 138, 44 156, 16 190 C 44 164, 70 148, 94 134 Z" fill={navy} />
        <path d="M92 128 C 80 148, 70 170, 62 196 C 78 172, 92 152, 104 136 Z" fill={navy} />
        {/* body */}
        <path d="M86 126 C 96 96, 120 70, 150 58 C 166 52, 182 56, 190 68 C 198 82, 196 104, 184 122 C 168 144, 132 152, 104 144 C 96 140, 90 134, 86 126 Z" fill={navy} />
        {/* cream belly */}
        <path d="M124 146 C 150 146, 174 136, 186 116 C 194 102, 194 90, 190 80 C 180 96, 164 112, 140 126 C 128 133, 118 140, 110 144 Z" fill={cream} />
        {/* rust throat & forehead */}
        <path d="M190 80 C 194 90, 192 100, 186 108 C 180 100, 178 90, 182 80 Z" fill={rust} />
        <path d="M176 58 C 184 58, 190 62, 193 68 C 186 66, 180 64, 174 63 Z" fill={rust} />
        {/* folded wing — long blade reaching past the tail */}
        <path d="M112 96 C 132 86, 156 86, 168 98 C 150 110, 118 126, 72 156 C 88 132, 98 112, 112 96 Z" fill={navy2} />
        <path d="M116 102 C 134 96, 150 96, 160 102" stroke={teal} strokeWidth="2.4" fill="none" strokeLinecap="round" />
        <path d="M110 112 C 124 106, 138 106, 148 110" stroke={teal} strokeWidth="2" fill="none" strokeLinecap="round" opacity=".7" />
        {/* eye */}
        <circle cx="176" cy="74" r="5.4" fill={cream} />
        <circle cx="177.2" cy="74" r="3" fill={navy} />
        <circle cx="178.3" cy="72.8" r=".9" fill={cream} />
        {/* beak */}
        <path d="M192 70 L 206 74 L 193 78 Z" fill={navy} />
        {/* feet */}
        <path d="M136 146 l -3 18 M 150 144 l 1 20" stroke={navy} strokeWidth="2.6" strokeLinecap="round" />
      </g>
    </svg>
  )
}
