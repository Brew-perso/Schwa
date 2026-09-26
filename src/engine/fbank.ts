import { FFT } from './fft'

/**
 * Kaldi-compatible log-mel filterbank (matches kaldi-native-fbank defaults used to train the Schwa engine):
 * 16 kHz, 25 ms povey window, 10 ms shift, pre-emphasis 0.97, DC removal, snip_edges=false,
 * 512-point FFT, 80 mel bins 20 Hz–8 kHz, power spectrum, natural log. Followed by per-utterance CMVN.
 */
const SR = 16000
const WIN = 400
const SHIFT = 160
const NFFT = 512
const NMEL = 80
const LOW = 20
const HIGH = 8000

let melBanks: { start: number; weights: Float64Array }[] | null = null
let window: Float64Array | null = null
let fft: FFT | null = null

const mel = (f: number) => 1127 * Math.log(1 + f / 700)

function init() {
  if (melBanks) return
  window = new Float64Array(WIN)
  for (let i = 0; i < WIN; i++) window[i] = Math.pow(0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (WIN - 1)), 0.85)
  const nbins = NFFT / 2
  const binW = SR / NFFT
  const mLow = mel(LOW), mHigh = mel(HIGH)
  const delta = (mHigh - mLow) / (NMEL + 1)
  melBanks = []
  for (let b = 0; b < NMEL; b++) {
    const left = mLow + b * delta, center = left + delta, right = center + delta
    let first = -1, last = -1
    const w = new Float64Array(nbins)
    for (let i = 0; i < nbins; i++) {
      const m = mel(binW * i)
      if (m > left && m < right) {
        w[i] = m <= center ? (m - left) / (center - left) : (right - m) / (right - center)
        if (first < 0) first = i
        last = i
      }
    }
    melBanks.push({ start: first, weights: w.slice(first, last + 1) })
  }
  fft = new FFT(NFFT)
}

/** Returns features as Float32Array [T * 80] (row-major, frame-major) and T. */
export function fbank(samples: Float32Array): { data: Float32Array; frames: number } {
  init()
  const N = samples.length
  const T = Math.floor((N + SHIFT / 2) / SHIFT)
  const out = new Float32Array(T * NMEL)
  const re = new Float64Array(NFFT), im = new Float64Array(NFFT)
  const frame = new Float64Array(WIN)
  const EPS = 1.1920928955078125e-7
  for (let t = 0; t < T; t++) {
    const start = t * SHIFT + SHIFT / 2 - WIN / 2
    let mean = 0
    for (let i = 0; i < WIN; i++) {
      let s = start + i
      if (s < 0) s = -s - 1
      else if (s >= N) s = 2 * N - 1 - s
      const v = samples[Math.min(Math.max(s, 0), N - 1)] * 32768
      frame[i] = v
      mean += v
    }
    mean /= WIN
    for (let i = 0; i < WIN; i++) frame[i] -= mean
    for (let i = WIN - 1; i > 0; i--) frame[i] -= 0.97 * frame[i - 1]
    frame[0] -= 0.97 * frame[0]
    re.fill(0); im.fill(0)
    for (let i = 0; i < WIN; i++) re[i] = frame[i] * window![i]
    fft!.transform(re, im)
    for (let b = 0; b < NMEL; b++) {
      const { start: st, weights } = melBanks![b]
      let e = 0
      for (let k = 0; k < weights.length; k++) {
        const i = st + k
        e += weights[k] * (re[i] * re[i] + im[i] * im[i])
      }
      out[t * NMEL + b] = Math.log(Math.max(e, EPS))
    }
  }
  // per-utterance mean / variance normalisation (same as training)
  for (let b = 0; b < NMEL; b++) {
    let m = 0
    for (let t = 0; t < T; t++) m += out[t * NMEL + b]
    m /= Math.max(1, T)
    let v = 0
    for (let t = 0; t < T; t++) { const d = out[t * NMEL + b] - m; v += d * d }
    const sd = Math.sqrt(v / Math.max(1, T)) + 1e-5
    for (let t = 0; t < T; t++) out[t * NMEL + b] = (out[t * NMEL + b] - m) / sd
  }
  return { data: out, frames: T }
}

/** Transpose [T, 80] → [80, T] as the NeMo encoder expects (N, C, T). */
export function toChannelsFirst(data: Float32Array, T: number): Float32Array {
  const out = new Float32Array(NMEL * T)
  for (let t = 0; t < T; t++) for (let b = 0; b < NMEL; b++) out[b * T + t] = data[t * NMEL + b]
  return out
}
