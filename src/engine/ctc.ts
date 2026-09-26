/**
 * CTC utilities over log-probabilities lp[T*V] (frame-major), blank = 0.
 *  - forward(): total log-likelihood of a label sequence (used for constrained comparisons:
 *    "did the learner produce /θ/ or one of the expected French substitutions /s f t/?")
 *  - align(): Viterbi forced alignment → frame span of every label.
 *  - greedy(): best-path decoding.
 */
const NEG = -1e30

function lse(a: number, b: number) {
  if (a === NEG) return b
  if (b === NEG) return a
  return a > b ? a + Math.log1p(Math.exp(b - a)) : b + Math.log1p(Math.exp(a - b))
}

export function forward(lp: Float32Array, T: number, V: number, seq: number[], t0 = 0, t1 = T): number {
  const L = 2 * seq.length + 1
  const ext = new Int32Array(L)
  for (let i = 0; i < seq.length; i++) ext[2 * i + 1] = seq[i]
  let a = new Float64Array(L).fill(NEG)
  let n = new Float64Array(L)
  a[0] = lp[t0 * V]
  if (L > 1) a[1] = lp[t0 * V + ext[1]]
  for (let t = t0 + 1; t < t1; t++) {
    const row = t * V
    for (let s = 0; s < L; s++) {
      let v = a[s]
      if (s > 0) v = lse(v, a[s - 1])
      if (s > 1 && ext[s] !== 0 && ext[s] !== ext[s - 2]) v = lse(v, a[s - 2])
      n[s] = v === NEG ? NEG : v + lp[row + ext[s]]
    }
    const tmp = a; a = n; n = tmp
  }
  return L > 1 ? lse(a[L - 1], a[L - 2]) : a[L - 1]
}

export interface Span { s: number; e: number } // inclusive frame indices

/** Viterbi forced alignment. Returns one span per label (null if the label got no frames, which cannot happen in CTC). */
export function align(lp: Float32Array, T: number, V: number, seq: number[]): { spans: Span[]; score: number } {
  const L = 2 * seq.length + 1
  const ext = new Int32Array(L)
  for (let i = 0; i < seq.length; i++) ext[2 * i + 1] = seq[i]
  const dp = new Float64Array(L).fill(NEG)
  const bp = new Int8Array(T * L) // 0: stay, 1: from s-1, 2: from s-2
  dp[0] = lp[0]
  if (L > 1) dp[1] = lp[ext[1]]
  const nd = new Float64Array(L)
  for (let t = 1; t < T; t++) {
    const row = t * V
    for (let s = 0; s < L; s++) {
      let best = dp[s], arg = 0
      if (s > 0 && dp[s - 1] > best) { best = dp[s - 1]; arg = 1 }
      if (s > 1 && ext[s] !== 0 && ext[s] !== ext[s - 2] && dp[s - 2] > best) { best = dp[s - 2]; arg = 2 }
      nd[s] = best === NEG ? NEG : best + lp[row + ext[s]]
      bp[t * L + s] = arg
    }
    dp.set(nd)
  }
  let s = L > 1 && dp[L - 2] > dp[L - 1] ? L - 2 : L - 1
  const score = dp[s]
  const path = new Int32Array(T)
  for (let t = T - 1; t >= 0; t--) {
    path[t] = s
    if (t > 0) s -= bp[t * L + s]
  }
  const spans: Span[] = seq.map(() => ({ s: -1, e: -1 }))
  for (let t = 0; t < T; t++) {
    const st = path[t]
    if (st % 2 === 1) {
      const k = (st - 1) / 2
      if (spans[k].s < 0) spans[k].s = t
      spans[k].e = t
    }
  }
  // extend each label over the blank frames that follow it (acoustic segment ≈ until next label)
  for (let k = 0; k < spans.length; k++) {
    const next = k + 1 < spans.length ? spans[k + 1].s : T
    if (spans[k].s >= 0 && next > spans[k].e + 1) {
      const gap = next - spans[k].e - 1
      spans[k].e += Math.floor(gap / 2)
    }
  }
  return { spans, score }
}

export function greedy(lp: Float32Array, T: number, V: number): number[] {
  const out: number[] = []
  let prev = -1
  for (let t = 0; t < T; t++) {
    let best = 0, bv = NEG
    const row = t * V
    for (let v = 0; v < V; v++) if (lp[row + v] > bv) { bv = lp[row + v]; best = v }
    if (best !== prev && best !== 0) out.push(best)
    prev = best
  }
  return out
}

/** Best-path score (upper bound used to measure how well the reference explains the audio). */
export function bestPathScore(lp: Float32Array, T: number, V: number): number {
  let s = 0
  for (let t = 0; t < T; t++) {
    let bv = NEG
    const row = t * V
    for (let v = 0; v < V; v++) if (lp[row + v] > bv) bv = lp[row + v]
    s += bv
  }
  return s
}

/** Mean posterior of the aligned label over its frames (a GOP-like confidence, 0..1). */
export function spanPosterior(lp: Float32Array, V: number, label: number, span: Span): number {
  if (span.s < 0) return 0
  let m = 0, n = 0
  for (let t = span.s; t <= span.e; t++) { m = Math.max(m, Math.exp(lp[t * V + label])); n++ }
  return n ? m : 0
}
