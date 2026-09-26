/**
 * Schwa evaluation contract:  evaluate(audio, item, profile) → result   (spec "Interface interne du moteur")
 *
 * Diagnosis is *constrained by the target*: we never ask "what did the learner say?" but
 * "did they produce /θ/ or one of the substitutions a French speaker typically makes (/s f t/)?".
 * Decisions favour precision over recall: when the evidence is weak we say "je n'ai pas bien entendu"
 * rather than flag a sound that may well be fine.
 */
import { align, bestPathScore, forward, type Span } from './ctc'
import { intensityDb, toSemitones, yin, formants } from './acoustics'
import type { Check, Level, Ref } from '../content/types'

export type State = 'clear' | 'refine' | 'rework' | 'unsure'

export interface Expect {
  stressWord?: number               // index of the word whose stress is checked
  stress?: number                   // expected stressed syllable in that word
  stressWords?: { w: number; st: number }[]
  nucleusWord?: number              // expected most prominent word
  tone?: 'fall' | 'rise' | 'fall-rise'
  chunkEnds?: number[]              // word indices after which a pause is expected
  count?: number
  vowelWord?: number                // word whose stressed vowel formants we want (vowel map)
}

export interface EvalInput {
  audio: Float32Array               // 16 kHz mono
  lp: Float32Array; T: number; V: number   // phone log-probs, 20 ms frames
  ref: Ref
  checks: Check[]
  expect: Expect
  level: Level
  competitor?: Ref                  // minimal pair / guided alternative (whole utterance)
  f0ref?: number                    // speaker median F0 from calibration
  model?: SylRaw[]                  // the model recording analysed by the same pipeline (same text)
}

/** Raw per-syllable prosodic cues of one word: log duration, max F0 (st re. median), max intensity (dB). */
export interface SylRaw { logDur: number[]; f0: number[]; int: number[] }

export interface CheckOutcome {
  w: number; p: number; target: number; realized: string | null; fiche: string | null; llr: number; state: State; weight: number; mode?: string
}

export interface Issue {
  kind: 'segment' | 'stress' | 'nucleus' | 'tone' | 'chunk' | 'pair'
  w: number
  state: State
  fiche?: string
  vars: Record<string, string>
  weight: number
}

export interface EvalResult {
  qc: null | 'too-short' | 'too-quiet' | 'clipped' | 'mismatch'
  confidence: number
  words: { state: State; t0: number; t1: number }[]
  unitSpans: [number, number][]
  checks: CheckOutcome[]
  syllables: { w: number; prom: number[]; dur: number[]; f0: number[]; perceived: number | null; margin: number }[]
  sylRaw: SylRaw[]
  wordProm: number[]
  perceivedNucleus: number | null
  tone: { shape: 'fall' | 'rise' | 'fall-rise' | 'flat' | null; drop: number }
  pauses: number[]
  pair: { heard: 'target' | 'competitor' | null; margin: number } | null
  f0: number[]                    // semitone contour (NaN unvoiced), 10 ms
  vowel: { f1: number; f2: number } | null
  issues: Issue[]
  priority: Issue | null
  ms: number
}

const FRAME = 0.02
const THR: Record<Level, { err: number; ok: number }> = {
  A2: { err: 3.2, ok: 0.6 },
  B1: { err: 2.8, ok: 0.6 },
  B2: { err: 2.4, ok: 0.5 },
  C1: { err: 2.1, ok: 0.5 },
}
const VOWELS = new Set(['iː', 'ɪ', 'ɛ', 'æ', 'ʌ', 'ɑː', 'ɒ', 'ɔː', 'ʊ', 'uː', 'ɜː', 'ə', 'eɪ', 'aɪ', 'ɔɪ', 'oʊ', 'aʊ', 'ɪə', 'ɛə', 'ʊə', 'o', 'e', 'œ'])

export function flatUnits(ref: Ref): { seq: number[]; wordOf: number[]; offsets: number[] } {
  const seq: number[] = [], wordOf: number[] = [], offsets: number[] = []
  ref.words.forEach((w, wi) => {
    offsets.push(seq.length)
    for (const u of w.u) { seq.push(u); wordOf.push(wi) }
  })
  return { seq, wordOf, offsets }
}

export function evaluate(inp: EvalInput, units: string[]): EvalResult {
  const t0 = performance.now()
  const { audio, lp, T, V, ref, checks, expect, level } = inp
  const thr = THR[level] ?? THR.B1
  const res: EvalResult = {
    qc: null, confidence: 0, words: [], unitSpans: [], checks: [], syllables: [], sylRaw: [], wordProm: [], perceivedNucleus: null,
    tone: { shape: null, drop: 0 }, pauses: [], pair: null, f0: [], vowel: null, issues: [], priority: null, ms: 0,
  }
  // ---------------- quality control (client-side, before any verdict)
  let peak = 0, clip = 0
  for (let i = 0; i < audio.length; i++) { const a = Math.abs(audio[i]); if (a > peak) peak = a; if (a > 0.985) clip++ }
  const inten = intensityDb(audio)
  const maxI = Math.max(...Array.from(inten))
  const speechFrames = Array.from(inten).filter((v) => v > maxI - 25).length
  if (speechFrames * 0.01 < 0.22) res.qc = 'too-short'
  else if (peak < 0.015) res.qc = 'too-quiet'
  else if (clip / audio.length > 0.004) res.qc = 'clipped'

  const { seq, wordOf, offsets } = flatUnits(ref)
  if (!seq.length || T < seq.length) {
    res.qc = res.qc ?? 'too-short'
    res.ms = performance.now() - t0
    return res
  }
  // ---------------- alignment & global fit
  const llRef = forward(lp, T, V, seq)
  const best = bestPathScore(lp, T, V)
  const gapPerFrame = (best - llRef) / T
  const { spans } = align(lp, T, V, seq)
  res.unitSpans = spans.map((s) => [s.s * FRAME, (s.e + 1) * FRAME])
  // confidence: how well the expected text explains the audio (1 = perfectly)
  res.confidence = Math.max(0, Math.min(1, 1 - gapPerFrame / 1.2))
  // per speech frame too (20 ms head frames): leading/trailing silence must not dilute the gap on single words.
  // For a minimal pair, either member of the pair is an acceptable text here (the pair decision comes later).
  const llAlt = inp.competitor ? forward(lp, T, V, flatUnits(inp.competitor).seq) : -Infinity
  const gapSpeech = (best - Math.max(llRef, llAlt)) / Math.max(speechFrames / 2, seq.length * 1.5)
  if (!res.qc && (gapPerFrame > 1.15 || gapSpeech > 1.6)) res.qc = 'mismatch'

  // ---------------- segmental checks (graph of expected errors)
  for (const c of checks) {
    const off = offsets[c.w]
    let bestAlt: { llr: number; r: string; f: string; wt: number } | null = null
    for (const a of c.alts) {
      let alt: number[]
      if (c.word) {
        alt = [...seq.slice(0, off), ...a.seq, ...seq.slice(off + ref.words[c.w].u.length)]
      } else if (c.ins) {
        alt = [...seq.slice(0, off + c.p), ...a.seq, ...seq.slice(off + c.p)]
      } else {
        alt = [...seq.slice(0, off + c.p), ...a.seq, ...seq.slice(off + c.p + 1)]
      }
      if (alt.length === 0 || T < alt.length) continue
      const llr = llRef - forward(lp, T, V, alt)
      if (!bestAlt || llr < bestAlt.llr) bestAlt = { llr, r: a.r, f: a.f, wt: a.wt }
    }
    if (!bestAlt) continue
    let state: State
    const errThr = thr.err * (c.ins ? 1.15 : 1)
    if (bestAlt.llr >= thr.ok) state = 'clear'
    else if (bestAlt.llr <= -errThr) state = bestAlt.wt >= 0.7 ? 'rework' : 'refine'
    else state = 'unsure'
    res.checks.push({ w: c.w, p: c.p, target: c.t, realized: state === 'clear' ? null : bestAlt.r, fiche: bestAlt.f, llr: bestAlt.llr, state, weight: bestAlt.wt, mode: c.mode })
  }

  // ---------------- prosody: F0 & per-syllable prominence
  const f0 = yin(audio)
  const { st } = toSemitones(f0, inp.f0ref)
  res.f0 = Array.from(st)
  const vowelSpan = (gi: number): Span => spans[gi]
  const sylStats = ref.words.map((w, wi) => {
    const out = { w: wi, prom: [] as number[], dur: [] as number[], f0: [] as number[], int: [] as number[] }
    let k = offsets[wi]
    for (const sy of w.syl) {
      const idx = Array.from({ length: sy.n }, (_, j) => k + j)
      k += sy.n
      const vi = idx.filter((g) => VOWELS.has(units[seq[g]]))
      const sp = vi.length ? { s: vowelSpan(vi[0]).s, e: vowelSpan(vi[vi.length - 1]).e } : { s: spans[idx[0]].s, e: spans[idx[idx.length - 1]].e }
      const syll = { s: spans[idx[0]].s, e: spans[idx[idx.length - 1]].e }
      const a = Math.max(0, sp.s * 2), b = Math.min(inten.length - 1, (sp.e + 1) * 2)
      let im = -100, fm = NaN
      for (let i = a; i <= b; i++) { if (inten[i] > im) im = inten[i]; if (!isNaN(st[i]) && (isNaN(fm) || st[i] > fm)) fm = st[i] }
      out.dur.push(Math.max(1, sp.e - sp.s + 1) * FRAME * 0.6 + Math.max(1, syll.e - syll.s + 1) * FRAME * 0.4)
      out.int.push(im)
      out.f0.push(fm)
    }
    return out
  })
  // utterance-level references
  const allF0 = sylStats.flatMap((s) => s.f0).filter((x) => !isNaN(x))
  const medF0 = allF0.length ? allF0.slice().sort((a, b) => a - b)[Math.floor(allF0.length / 2)] : 0
  res.sylRaw = sylStats.map((s) => ({ logDur: s.dur.map((d) => Math.log(d)), f0: s.f0.map((x) => (isNaN(x) ? medF0 - 2 : x - medF0)), int: s.int.slice() }))
  const lastWord = ref.words.length - 1
  sylStats.forEach((s, wi) => {
    const raw = res.sylRaw[wi]
    const prom = prominence(raw, wi === lastWord && !inp.model)
    s.prom = prom
    let bi = null as number | null, bv = -1e9, sv = -1e9
    prom.forEach((p, i) => { if (p > bv) { sv = bv; bv = p; bi = i } else if (p > sv) sv = p })
    res.syllables.push({ w: s.w, prom, dur: s.dur, f0: s.f0, perceived: prom.length > 1 ? bi : null, margin: prom.length > 1 ? bv - sv : 0 })
  })
  res.wordProm = sylStats.map((s) => Math.max(...s.prom))

  // ---------------- stress verdicts
  const stressTargets: { w: number; st: number }[] = []
  if (expect.stressWord !== undefined && expect.stress !== undefined) stressTargets.push({ w: expect.stressWord, st: expect.stress })
  for (const x of expect.stressWords ?? []) stressTargets.push(x)
  for (const tgt of stressTargets) {
    const s = res.syllables[tgt.w]
    if (!s || s.prom.length < 2) continue
    const word = ref.words[tgt.w]
    const stressedLabel = word.syl[tgt.st]?.l ?? ''
    const m = inp.model?.[tgt.w]
    let perceived = s.perceived!
    let margin: number
    if (m && m.logDur.length === s.prom.length) {
      // Model-relative: how much more prominent is a rival syllable (vs the expected one) than in the model?
      // Phrase-final lengthening, intrinsic vowel length and syllable weight cancel out.
      const sl = stressScore(res.sylRaw[tgt.w]), sm = stressScore(m)
      let rival = -1, best = -1e9
      sl.forEach((_, i) => {
        if (i === tgt.st) return
        const d = (sl[i] - sl[tgt.st]) - (sm[i] - sm[tgt.st])
        if (d > best) { best = d; rival = i }
      })
      margin = best
      // only a rival that actually outweighs the expected syllable counts as "stress heard elsewhere"
      perceived = rival >= 0 && sl[rival] > sl[tgt.st] && best > 1.5 ? rival : tgt.st
      margin = best - 0.5 // map onto the shared scale below: > 1.5 rework, > 1 refine (i.e. 2.0 / 1.5 raw)
    } else {
      margin = s.prom[perceived] - s.prom[tgt.st]
    }
    if (perceived === tgt.st) {
      res.issues.push({ kind: 'stress', w: tgt.w, state: 'clear', vars: { word: word.w, stressed: stressedLabel }, weight: 0 })
    } else {
      const conf: State = inp.model?.[tgt.w] ? (margin > 2.1 ? 'rework' : margin > 1.5 ? 'refine' : 'unsure') : (margin > 1.8 ? 'rework' : margin > 1.1 ? 'refine' : 'unsure')
      const final = perceived === s.prom.length - 1
      res.issues.push({
        kind: 'stress', w: tgt.w, state: conf,
        fiche: final ? 'accent-final' : 'accent-deplace',
        vars: { word: word.w, stressed: stressedLabel, heard: word.syl[perceived]?.l ?? '' },
        weight: conf === 'unsure' ? 0.1 : 1.0,
      })
    }
  }

  // ---------------- nucleus / focus
  if (res.wordProm.length) {
    let bi = 0
    res.wordProm.forEach((p, i) => { if (p > res.wordProm[bi]) bi = i })
    res.perceivedNucleus = bi
    if (expect.nucleusWord !== undefined) {
      const exp = expect.nucleusWord
      const sorted = res.wordProm.slice().sort((a, b) => b - a)
      const spread = sorted[0] - (sorted[sorted.length - 1] ?? sorted[0])
      if (bi === exp || res.wordProm[exp] >= res.wordProm[bi] - 0.08) {
        res.issues.push({ kind: 'nucleus', w: exp, state: 'clear', vars: { nucleus: ref.words[exp].w }, weight: 0 })
      } else if (spread < 0.25) {
        res.issues.push({ kind: 'nucleus', w: exp, state: 'refine', fiche: 'noyau-plat', vars: { nucleus: ref.words[exp].w }, weight: 0.6 })
      } else {
        const margin = res.wordProm[bi] - res.wordProm[exp]
        res.issues.push({ kind: 'nucleus', w: exp, state: margin > 0.3 ? 'rework' : 'refine', fiche: 'noyau-deplace', vars: { nucleus: ref.words[exp].w, heard: ref.words[bi].w }, weight: 0.8 })
      }
    }
  }

  // ---------------- final tone
  {
    const lastW = ref.words.length - 1
    const lastSt = ref.words[lastW]?.st ?? 0
    // start of the last stressed syllable (nucleus region) → end of speech
    let startUnit = offsets[lastW]
    const w = ref.words[lastW]
    if (w) { let k = offsets[lastW]; for (let i = 0; i < lastSt; i++) k += w.syl[i].n; startUnit = k }
    const a = Math.max(0, (spans[Math.min(startUnit, spans.length - 1)]?.s ?? 0) * 2 - 6)
    const b = Math.min(st.length - 1, (spans[spans.length - 1]?.e ?? 0) * 2)
    // only strong voiced frames: the weak, often creaky tail of an utterance produces spurious pitch jumps
    let peak = -1e9
    for (let i = a; i <= b; i++) if (inten[i] !== undefined && inten[i] > peak) peak = inten[i]
    const raw: number[] = []
    for (let i = a; i <= b; i++) if (!isNaN(st[i]) && (inten[i] ?? -1e9) > peak - 18) raw.push(st[i])
    // split at discontinuities (> 3 st in 10 ms is a tracking artefact, not intonation) and drop short fragments
    const seg: number[] = []
    for (let i = 0, j = 0; i < raw.length; i = j) {
      j = i + 1
      while (j < raw.length && Math.abs(raw[j] - raw[j - 1]) <= 3) j++
      if (j - i >= 6) seg.push(...raw.slice(i, j))
    }
    if (seg.length >= 6) {
      // 3-point median smoothing
      // 5-point median smoothing: a rise must be sustained, not a 20–30 ms creaky uptick
      const sm = seg.map((_, i) => { const w = seg.slice(Math.max(0, i - 2), i + 3).sort((x, y) => x - y); return w[Math.floor(w.length / 2)] })
      const n = sm.length
      const k = Math.max(5, Math.round(n * 0.2))
      const mean = (arr: number[]) => arr.reduce((x, y) => x + y, 0) / arr.length
      const start = mean(sm.slice(0, k)), end = mean(sm.slice(n - k))
      const lo = Math.min(...sm), hi = Math.max(...sm.slice(0, Math.ceil(n * 0.7)))
      const loIdx = sm.indexOf(lo)
      let shape: 'fall' | 'rise' | 'fall-rise' | 'flat' = 'flat'
      if (end - lo >= 2.5 && end >= start + 1) shape = 'rise'
      else if (start - lo >= 1.5 && end - lo >= 1.8 && loIdx > n * 0.25 && loIdx < n * 0.8) shape = 'fall-rise'
      else if (start - end >= 1.5 || hi - end >= 2.5) shape = 'fall'
      res.tone = { shape, drop: start - end }
      if (expect.tone) {
        const finalRise = end - lo
        let state: State = 'clear'
        let fiche = ''
        if (expect.tone === 'fall') {
          if ((shape === 'rise' && finalRise >= 3) || (shape === 'fall-rise' && finalRise >= 3.5)) { state = 'rework'; fiche = 'montee-finale' }
          else if (shape === 'rise' || shape === 'fall-rise') { state = 'unsure' }
          else if (shape === 'flat' && hi - lo < 1.5) { state = 'refine'; fiche = 'melodie-plate' }
        } else if (expect.tone === 'rise') {
          if (shape === 'fall' && start - end >= 3) { state = 'rework'; fiche = 'question-descendante' }
          else if (shape !== 'rise') state = 'unsure'
        } else if (expect.tone === 'fall-rise') {
          if (shape !== 'fall-rise') state = shape === 'flat' ? 'refine' : 'unsure'
          fiche = 'ton-inattendu'
        }
        res.issues.push({ kind: 'tone', w: lastW, state, fiche: fiche || undefined, vars: { nucleus: w?.w ?? '', heard: shape, expected: expect.tone }, weight: state === 'rework' ? 0.7 : state === 'refine' ? 0.4 : 0 })
      }
    }
  }

  // ---------------- pauses between words (chunking)
  for (let wi = 0; wi < ref.words.length - 1; wi++) {
    const endU = offsets[wi] + ref.words[wi].u.length - 1
    const nextU = offsets[wi + 1]
    const g0 = spans[endU].e, g1 = spans[nextU].s
    // look for a low-energy stretch ≥ 90 ms between the words
    let run = 0, bestRun = 0
    for (let f = Math.max(0, (g0 - 2) * 2); f <= Math.min(inten.length - 1, (g1 + 2) * 2); f++) {
      if (inten[f] < maxI - 28) { run++; bestRun = Math.max(bestRun, run) } else run = 0
    }
    if (bestRun >= 9) res.pauses.push(wi)
  }
  if (expect.chunkEnds && ref.words.length > 3) {
    const expSet = new Set(expect.chunkEnds)
    const hits = res.pauses.filter((p) => expSet.has(p)).length
    const extra = res.pauses.filter((p) => !expSet.has(p)).length
    const exp = expect.chunkEnds.length
    if (extra >= Math.max(3, ref.words.length / 3)) res.issues.push({ kind: 'chunk', w: res.pauses[0] ?? 0, state: 'refine', fiche: 'groupes-courts', vars: { chunk: '' }, weight: 0.6 })
    else if (exp > 0 && hits === 0 && res.pauses.length === 0) res.issues.push({ kind: 'chunk', w: expect.chunkEnds[0], state: 'refine', fiche: 'sans-pause', vars: { chunk: ref.words.slice(0, expect.chunkEnds[0] + 1).map((w) => w.w).join(' ') }, weight: 0.5 })
    else res.issues.push({ kind: 'chunk', w: 0, state: 'clear', vars: {}, weight: 0 })
  }

  // ---------------- minimal pair / guided alternative ("faites-vous comprendre")
  if (inp.competitor) {
    const cseq = flatUnits(inp.competitor).seq
    if (cseq.length && T >= cseq.length) {
      const m = llRef - forward(lp, T, V, cseq)
      const need = thr.err * 0.55
      res.pair = { heard: m > need ? 'target' : m < -need ? 'competitor' : null, margin: m }
      res.issues.push({
        kind: 'pair', w: 0,
        state: res.pair.heard === 'target' ? 'clear' : res.pair.heard === 'competitor' ? 'rework' : 'unsure',
        vars: { word: ref.text, heard: inp.competitor.text }, weight: res.pair.heard === 'competitor' ? 0.9 : 0,
      })
    }
  }

  // ---------------- vowel formants for the vowel map
  if (expect.vowelWord !== undefined) {
    const w = ref.words[expect.vowelWord]
    if (w) {
      let k = offsets[expect.vowelWord]
      let vIdx = -1
      for (let i = 0; i < w.syl.length; i++) {
        for (let j = 0; j < w.syl[i].n; j++) if (VOWELS.has(units[seq[k + j]]) && (w.syl[i].s === 1 || vIdx < 0)) vIdx = k + j
        k += w.syl[i].n
      }
      if (vIdx >= 0) {
        const sp = spans[vIdx]
        const dur = (sp.e - sp.s + 1) * FRAME
        if (dur >= 0.06) {
          const fm = formants(audio, sp.s * 320, (sp.e + 1) * 320)
          if (fm) res.vowel = { f1: fm[0], f2: fm[1] }
        }
      }
    }
  }

  // ---------------- word states (worst issue per word)
  const rank: Record<State, number> = { clear: 0, unsure: 1, refine: 2, rework: 3 }
  res.words = ref.words.map((_, wi) => {
    const us = [offsets[wi], offsets[wi] + ref.words[wi].u.length - 1]
    let stt: State = 'clear'
    for (const c of res.checks) if (c.w === wi && rank[c.state] > rank[stt]) stt = c.state
    for (const is of res.issues) if (is.w === wi && is.kind === 'stress' && rank[is.state] > rank[stt]) stt = is.state
    return { state: stt, t0: spans[us[0]].s * FRAME, t1: (spans[us[1]].e + 1) * FRAME }
  })
  void wordOf

  // segment issues
  for (const c of res.checks) {
    if (c.state === 'clear') continue
    const word = ref.words[c.w]
    res.issues.push({
      kind: 'segment', w: c.w, state: c.state, fiche: c.fiche ?? undefined,
      vars: { word: word.w, heard: c.realized ?? '', target: units[c.target] ?? '' },
      weight: c.state === 'unsure' ? 0.05 : c.weight,
    })
  }
  // ---------------- one thing at a time: pick the issue that hurts intelligibility most
  const cand = res.issues.filter((i) => i.state === 'rework' || i.state === 'refine')
  cand.sort((a, b) => b.weight * (b.state === 'rework' ? 1.2 : 1) - a.weight * (a.state === 'rework' ? 1.2 : 1))
  res.priority = cand[0] ?? null
  res.ms = performance.now() - t0
  return res
}

/** Syllable prominence from raw cues, z-scored within the word (duration first, then pitch, then intensity). */
export function prominence(r: SylRaw, finalCorrection: boolean): number[] {
  const n = r.logDur.length
  if (n < 2) return [0]
  const dur = r.logDur.map((d, i) => d + (finalCorrection && i === n - 1 ? Math.log(0.62) : 0))
  const z = (a: number[]) => { const m = a.reduce((x, y) => x + y, 0) / a.length; const sd = Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length); return a.map((x) => (x - m) / Math.max(sd, 1e-6)) }
  const spread = (a: number[]) => Math.max(...a) - Math.min(...a)
  const zD = z(dur), zF = z(r.f0), zI = z(r.int)
  const wD = spread(dur) > 0.18 ? 1 : 0.3, wF = spread(r.f0) > 1.2 ? 0.8 : 0.25, wI = spread(r.int) > 2 ? 0.4 : 0.12
  return zD.map((_, i) => wD * zD[i] + wF * zF[i] + wI * zI[i])
}

/** Fixed-weight stress cue (log duration dominates; pitch in st and intensity in dB contribute a little). */
export function stressScore(r: SylRaw): number[] {
  return r.logDur.map((d, i) => 3 * d + 0.1 * r.f0[i] + 0.05 * r.int[i])
}
