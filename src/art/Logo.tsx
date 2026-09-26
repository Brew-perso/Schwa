/** Wordmark: "schwa" in soft Fraunces italic, the ə set inside a ringed planet. */
export function Logo({ size = 40, withWord = true, className }: { size?: number; withWord?: boolean; className?: string }) {
  return (
    <span className={className} style={{ display: 'inline-flex', alignItems: 'center', gap: size * 0.18 }}>
      <LogoMark size={size} />
      {withWord && (
        <span style={{
          fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 600, fontSize: size * 0.78, lineHeight: 1,
          fontVariationSettings: "'SOFT' 100, 'WONK' 1, 'opsz' 72", letterSpacing: '-0.01em',
        }}>schwa</span>
      )}
    </span>
  )
}

export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      <g transform="rotate(-18 32 32)">
        <path d="M4 34 A28 8 0 0 1 60 34" fill="none" stroke="#1d2334" strokeWidth="3.4" />
      </g>
      <circle cx="32" cy="32" r="19" fill="#e07a5f" stroke="#1d2334" strokeWidth="2.4" />
      <circle cx="40" cy="40" r="14" fill="url(#halftone)" opacity=".35" />
      <text x="32" y="41.5" textAnchor="middle" fontFamily="'Charis SIL', serif" fontSize="27" fontWeight="700" fill="#1d2334">ə</text>
      <g transform="rotate(-18 32 32)">
        <path d="M4 34 A28 8 0 0 0 60 34" fill="none" stroke="#1d2334" strokeWidth="3.4" />
        <path d="M4 34 A28 8 0 0 0 60 34" fill="none" stroke="#d6a03c" strokeWidth="1.3" />
      </g>
    </svg>
  )
}
