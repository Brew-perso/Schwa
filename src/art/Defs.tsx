/** Global SVG definitions (filters & patterns) shared by every illustration. Rendered once at the app root. */
export function ArtDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        {/* hand-drawn wobble for ink lines */}
        <filter id="rough" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="3" result="t" />
          <feDisplacementMap in="SourceGraphic" in2="t" scale="2.4" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id="rough-strong" x="-8%" y="-8%" width="116%" height="116%">
          <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="7" result="t" />
          <feDisplacementMap in="SourceGraphic" in2="t" scale="4" xChannelSelector="R" yChannelSelector="G" />
        </filter>
        {/* printed-paper grain inside shapes */}
        <filter id="grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="1" seed="11" result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .22 0" result="g" />
          <feComposite in="g" in2="SourceGraphic" operator="in" result="gi" />
          <feBlend in="SourceGraphic" in2="gi" mode="multiply" />
        </filter>
        {/* soft paper shadow for cut-outs */}
        <filter id="cutout-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="1.5" dy="2.5" stdDeviation="1.6" floodColor="#1d2334" floodOpacity=".28" />
        </filter>
        {/* halftone dot patterns (risograph shading) */}
        <pattern id="halftone" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
          <circle cx="2.5" cy="2.5" r="1.05" fill="#1d2334" />
        </pattern>
        <pattern id="halftone-fine" width="3.4" height="3.4" patternUnits="userSpaceOnUse" patternTransform="rotate(20)">
          <circle cx="1.7" cy="1.7" r=".7" fill="#1d2334" />
        </pattern>
        <pattern id="halftone-light" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-15)">
          <circle cx="2.5" cy="2.5" r="1" fill="#fff6e4" />
        </pattern>
        <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#1d2334" strokeWidth="1.1" />
        </pattern>
        <pattern id="hatch-light" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="#fff6e4" strokeWidth="1.2" />
        </pattern>
        {/* shading gradient for spheres: light from top-left */}
        <radialGradient id="sphere-shade" cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor="#000" stopOpacity="0" />
          <stop offset=".55" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".38" />
        </radialGradient>
        <mask id="shade-mask">
          <rect x="-50%" y="-50%" width="200%" height="200%" fill="url(#sphere-shade-white)" />
        </mask>
        <radialGradient id="sphere-shade-white" cx="30%" cy="25%" r="85%">
          <stop offset="0" stopColor="#000" />
          <stop offset=".45" stopColor="#000" />
          <stop offset="1" stopColor="#fff" />
        </radialGradient>
      </defs>
    </svg>
  )
}
