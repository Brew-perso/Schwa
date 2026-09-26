/** Small deterministic PRNG so hand-drawn art is stable between renders. */
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** A slightly irregular closed path around a rectangle (torn / cut paper edge). */
export function roughRect(w: number, h: number, seed: number, amp = 2.2, step = 14): string {
  const r = mulberry32(seed)
  const pts: [number, number][] = []
  const j = () => (r() - 0.5) * 2 * amp
  for (let x = 0; x <= w; x += step) pts.push([Math.min(x, w), j()])
  for (let y = step; y <= h; y += step) pts.push([w + j(), Math.min(y, h)])
  for (let x = w - step; x >= 0; x -= step) pts.push([Math.max(x, 0), h + j()])
  for (let y = h - step; y > 0; y -= step) pts.push([j(), Math.max(y, 0)])
  return 'M' + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L') + 'Z'
}

/** A wobbly circle path (hand-cut paper disc). */
export function roughCircle(cx: number, cy: number, rad: number, seed: number, amp = 0.025, n = 36): string {
  const r = mulberry32(seed)
  const pts: string[] = []
  const phase = r() * Math.PI * 2
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const rr = rad * (1 + Math.sin(a * 3 + phase) * amp * 0.6 + (r() - 0.5) * amp)
    pts.push(`${(cx + Math.cos(a) * rr).toFixed(2)},${(cy + Math.sin(a) * rr).toFixed(2)}`)
  }
  return 'M' + pts.join('L') + 'Z'
}
