/** Resampling, loudness and time-stretching helpers (pure functions). */

/** Windowed-sinc low-pass + fractional resampling to 16 kHz (anti-aliased). */
export function resampleTo16k(x: Float32Array, sr: number): Float32Array {
  if (sr === 16000) return x.slice()
  const ratio = sr / 16000
  const cutoff = 7600 / sr // normalised
  const taps = 48
  const h = new Float32Array(2 * taps + 1)
  let sum = 0
  for (let i = -taps; i <= taps; i++) {
    const w = 0.42 + 0.5 * Math.cos((Math.PI * i) / taps) + 0.08 * Math.cos((2 * Math.PI * i) / taps)
    const s = i === 0 ? 2 * cutoff : Math.sin(2 * Math.PI * cutoff * i) / (Math.PI * i)
    h[i + taps] = s * w
    sum += h[i + taps]
  }
  for (let i = 0; i < h.length; i++) h[i] /= sum
  const n = Math.floor(x.length / ratio)
  const out = new Float32Array(n)
  for (let j = 0; j < n; j++) {
    const pos = j * ratio
    const c = Math.floor(pos)
    let acc = 0
    for (let k = -taps; k <= taps; k++) {
      const idx = c + k
      if (idx < 0 || idx >= x.length) continue
      acc += x[idx] * h[k + taps]
    }
    out[j] = acc
  }
  return out
}

/** Cheap streaming decimator used only to feed the VAD in real time. */
export class StreamingDecimator {
  private ratio: number
  private pos = 0
  private prev = 0
  constructor(sr: number) { this.ratio = sr / 16000 }
  push(chunk: Float32Array): Float32Array {
    const out: number[] = []
    // simple 1-pole low-pass then linear interpolation
    for (let i = 0; i < chunk.length; i++) {
      const v = this.prev + 0.45 * (chunk[i] - this.prev)
      this.prev = v
      chunk[i] = v
    }
    while (this.pos < chunk.length - 1) {
      const i = Math.floor(this.pos)
      const f = this.pos - i
      out.push(chunk[i] * (1 - f) + chunk[i + 1] * f)
      this.pos += this.ratio
    }
    this.pos -= chunk.length
    return Float32Array.from(out)
  }
}

export function rmsDb(x: Float32Array): number {
  let s = 0
  for (let i = 0; i < x.length; i++) s += x[i] * x[i]
  return 10 * Math.log10(s / Math.max(1, x.length) + 1e-12)
}

/** Gain that brings the loud part of a signal to a target level (model and learner compared at equal loudness). */
export function loudnessGain(x: Float32Array, targetDb = -20): number {
  const frame = 480
  const levels: number[] = []
  for (let o = 0; o + frame <= x.length; o += frame) {
    let s = 0
    for (let k = 0; k < frame; k++) s += x[o + k] * x[o + k]
    levels.push(s / frame)
  }
  if (!levels.length) return 1
  const max = Math.max(...levels)
  const loud = levels.filter((l) => l > max * 0.1)
  const cur = 10 * Math.log10(loud.reduce((a, b) => a + b, 0) / loud.length + 1e-12)
  let g = Math.pow(10, (targetDb - cur) / 20)
  let pk = 0
  for (let i = 0; i < x.length; i++) pk = Math.max(pk, Math.abs(x[i]))
  if (pk * g > 0.95) g = 0.95 / pk
  return Math.min(g, 20)
}

/** WSOLA time-stretch (pitch-preserving). rate < 1 slows down. */
export function timeStretch(x: Float32Array, sr: number, rate: number): Float32Array {
  if (Math.abs(rate - 1) < 1e-3) return x.slice()
  const win = Math.round(sr * 0.03)
  const hopOut = Math.round(win / 2)
  const hopIn = hopOut * rate
  const tol = Math.round(sr * 0.008)
  const w = new Float32Array(win)
  for (let i = 0; i < win; i++) w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (win - 1))
  const outLen = Math.ceil(x.length / rate) + win
  const out = new Float32Array(outLen)
  const norm = new Float32Array(outLen)
  let posIn = 0, posOut = 0, prevOff = 0
  while (posIn + win + tol < x.length && posOut + win < outLen) {
    // find best offset around posIn matching the natural continuation of the previous segment
    let bestOff = 0, bestC = -Infinity
    const natural = Math.round(prevOff + hopOut)
    for (let d = -tol; d <= tol; d += 2) {
      const cand = Math.round(posIn) + d
      if (cand < 0 || cand + win >= x.length) continue
      let c = 0
      for (let k = 0; k < win; k += 4) c += x[cand + k] * (x[natural + k] ?? 0)
      if (c > bestC) { bestC = c; bestOff = d }
    }
    const start = Math.max(0, Math.round(posIn) + bestOff)
    for (let k = 0; k < win; k++) { out[posOut + k] += x[start + k] * w[k]; norm[posOut + k] += w[k] }
    prevOff = start
    posIn += hopIn
    posOut += hopOut
  }
  for (let i = 0; i < outLen; i++) if (norm[i] > 1e-3) out[i] /= norm[i]
  return out.subarray(0, posOut)
}

/** Encode Float32 PCM as a 16-bit WAV blob (portfolio export / sharing with the teacher). */
export function toWav(x: Float32Array, sr: number): Blob {
  const buf = new ArrayBuffer(44 + x.length * 2)
  const v = new DataView(buf)
  const wr = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)) }
  wr(0, 'RIFF'); v.setUint32(4, 36 + x.length * 2, true); wr(8, 'WAVE'); wr(12, 'fmt ')
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true)
  v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); wr(36, 'data'); v.setUint32(40, x.length * 2, true)
  for (let i = 0; i < x.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, x[i])) * 32767, true)
  return new Blob([buf], { type: 'audio/wav' })
}
