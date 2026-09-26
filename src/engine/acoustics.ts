/**
 * Targeted acoustic measures (spec: "acoustique ciblée, pas généralisée"):
 *  - F0 by YIN (10 ms hop) → semitones relative to the speaker's median (no Hz shown to learners)
 *  - intensity (dB) per 10 ms
 *  - formants F1/F2 by LPC (autocorrelation + Levinson) with peak picking on the LPC envelope
 */
export const HOP = 160 // 10 ms at 16 kHz

export function intensityDb(x: Float32Array, hop = HOP, win = 400): Float32Array {
  const n = Math.max(1, Math.floor((x.length - win) / hop) + 1)
  const out = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    let e = 0
    const o = i * hop
    for (let k = 0; k < win && o + k < x.length; k++) e += x[o + k] * x[o + k]
    out[i] = 10 * Math.log10(e / win + 1e-10)
  }
  return out
}

/** YIN pitch tracker. Returns Hz per 10 ms frame (0 = unvoiced). */
export function yin(x: Float32Array, sr = 16000, fmin = 65, fmax = 500, thresh = 0.2): Float32Array {
  const win = 640 // 40 ms: covers 2 periods at 50 Hz-ish
  const tauMin = Math.floor(sr / fmax), tauMax = Math.ceil(sr / fmin)
  const n = Math.max(1, Math.floor((x.length - win - tauMax) / HOP) + 1)
  const out = new Float32Array(n)
  const d = new Float32Array(tauMax + 1)
  const inten = intensityDb(x)
  const maxI = Math.max(...Array.from(inten))
  for (let i = 0; i < n; i++) {
    const o = i * HOP
    if ((inten[Math.min(i + 2, inten.length - 1)] ?? -100) < maxI - 38) { out[i] = 0; continue }
    for (let tau = 1; tau <= tauMax; tau++) {
      let s = 0
      for (let k = 0; k < win; k += 2) { const df = x[o + k] - x[o + k + tau]; s += df * df }
      d[tau] = s
    }
    // cumulative mean normalised difference d'(tau) = d(tau) * tau / sum_{j<=tau} d(j)
    let run = 0
    let best = -1
    for (let tau = 1; tau <= tauMax; tau++) {
      run += d[tau]
      d[tau] = run > 0 ? (d[tau] * tau) / run : 1
    }
    for (let tau = tauMin + 1; tau < tauMax; tau++) {
      if (d[tau] < thresh) {
        while (tau + 1 < tauMax && d[tau + 1] < d[tau]) tau++
        best = tau
        break
      }
    }
    if (best < 0) {
      // no dip under the absolute threshold: accept the global minimum if it is still clearly periodic
      let gm = tauMin + 1
      for (let tau = tauMin + 1; tau < tauMax; tau++) if (d[tau] < d[gm]) gm = tau
      if (d[gm] < 0.45) best = gm
    }
    if (best < 0) { out[i] = 0; continue }
    // parabolic interpolation
    const a = d[best - 1], b = d[best], c = d[best + 1]
    const den = a - 2 * b + c
    const shift = den !== 0 ? (0.5 * (a - c)) / den : 0
    out[i] = sr / (best + shift)
  }
  // median smoothing + octave-jump cleanup
  const sm = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const w: number[] = []
    for (let k = -2; k <= 2; k++) { const v = out[i + k]; if (v > 0) w.push(v) }
    if (out[i] <= 0 || w.length < 2) { sm[i] = 0; continue }
    w.sort((p, q) => p - q)
    const med = w[Math.floor(w.length / 2)]
    let v = out[i]
    if (v > med * 1.7) v /= 2
    else if (v < med / 1.7) v *= 2
    sm[i] = v
  }
  return sm
}

export function toSemitones(f0: Float32Array, ref?: number): { st: Float32Array; median: number } {
  const voiced = Array.from(f0).filter((v) => v > 0).sort((a, b) => a - b)
  const median = ref ?? (voiced.length ? voiced[Math.floor(voiced.length / 2)] : 150)
  const st = new Float32Array(f0.length)
  for (let i = 0; i < f0.length; i++) {
    if (f0[i] <= 0) { st[i] = NaN; continue }
    let v = 12 * Math.log2(f0[i] / median)
    // octave errors (creak, period doubling) relative to the speaker's median
    if (v < -8.5) v += 12
    else if (v > 10) v -= 12
    st[i] = v
  }
  return { st, median }
}

/** LPC formant estimate over a segment [s, e) of samples. Returns [F1, F2] in Hz or null. */
export function formants(x: Float32Array, s: number, e: number, sr = 16000): [number, number] | null {
  const len = e - s
  if (len < 480) return null // < 30 ms: unreliable (spec: only vowels > 80 ms in the vowel map)
  // downsample-free approach at 16 kHz with order 12, analysed on 25 ms frames and averaged
  const order = 12
  const frame = 400
  const res: [number, number][] = []
  for (let o = s; o + frame <= e; o += 160) {
    const w = new Float64Array(frame)
    for (let k = 0; k < frame; k++) {
      const pre = x[o + k] - 0.95 * (x[o + k - 1] ?? 0)
      w[k] = pre * (0.54 - 0.46 * Math.cos((2 * Math.PI * k) / (frame - 1)))
    }
    const r = new Float64Array(order + 1)
    for (let l = 0; l <= order; l++) { let a = 0; for (let k = l; k < frame; k++) a += w[k] * w[k - l]; r[l] = a }
    if (r[0] <= 1e-9) continue
    // Levinson–Durbin
    const a = new Float64Array(order + 1); a[0] = 1
    let err = r[0]
    for (let i = 1; i <= order; i++) {
      let acc = r[i]
      for (let j = 1; j < i; j++) acc += a[j] * r[i - j]
      const k = -acc / err
      const tmp = a.slice()
      for (let j = 1; j < i; j++) a[j] = tmp[j] + k * tmp[i - j]
      a[i] = k
      err *= 1 - k * k
    }
    // LPC envelope, find spectral peaks between 200 and 3500 Hz
    const N = 512
    const peaks: number[] = []
    let prev2 = 0, prev1 = 0
    for (let b = 0; b <= N / 2; b++) {
      const wv = (Math.PI * b) / (N / 2)
      let re = 0, im = 0
      for (let j = 0; j <= order; j++) { re += a[j] * Math.cos(wv * j); im -= a[j] * Math.sin(wv * j) }
      const mag = -Math.log(re * re + im * im)
      if (b >= 2 && prev1 > prev2 && prev1 > mag) {
        const f = ((b - 1) * sr) / N
        if (f > 200 && f < 3500) peaks.push(f)
      }
      prev2 = prev1; prev1 = mag
    }
    if (peaks.length >= 2) res.push([peaks[0], peaks[1]])
  }
  if (!res.length) return null
  const med = (arr: number[]) => arr.sort((p, q) => p - q)[Math.floor(arr.length / 2)]
  return [med(res.map((r) => r[0])), med(res.map((r) => r[1]))]
}
