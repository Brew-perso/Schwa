import type { Check, Level, ProductionItem, Ref, Target, Variety } from '../content/types'
import type { Expect } from '../engine/evaluate'

/** Engine unit → display symbol for the learner's chosen model. */
export function unitSymbol(u: string, v: Variety): string {
  if (v === 'SBE') {
    if (u === 'ɛ') return 'e'
    if (u === 'oʊ') return 'əʊ'
    if (u === 'ɛə') return 'eə'
  } else {
    if (u === 'iː') return 'i'
    if (u === 'uː') return 'u'
    if (u === 'ɑː') return 'ɑ'
    if (u === 'ɔː') return 'ɔ'
    if (u === 'ɜː') return 'ɝ'
  }
  if (u === 'r') return 'r'
  return u
}

export function unitsToIpa(ids: number[], units: string[], v: Variety): string {
  return ids.map((i) => unitSymbol(units[i], v)).join('')
}

/** Build the /heard/ transcription of a word from a check outcome (substitution, deletion or insertion). */
export function heardIpa(ref: Ref, w: number, p: number, realized: string | null, ins: boolean, units: string[], v: Variety, altSeq?: number[]): string {
  const word = ref.words[w]
  if (!word) return ''
  const u = word.u.slice()
  if (altSeq && altSeq.length && (u.length === 0 || ins || realized === 'strong' || realized === 'weak')) {
    if (realized === 'strong' || realized === 'weak') return '/' + unitsToIpa(altSeq, units, v) + '/'
  }
  if (ins) {
    const idx = units.indexOf(realized ?? '')
    if (idx >= 0) u.splice(p, 0, idx)
  } else if (realized === '∅') u.splice(p, 1)
  else if (realized) {
    const idx = units.indexOf(realized === 'e' ? 'ɛ' : realized === 'əʊ' ? 'oʊ' : realized)
    if (idx >= 0) u[p] = idx
  }
  return '/' + unitsToIpa(u, units, v) + '/'
}

function wordIndex(ref: Ref, word?: string, occurrence = 0): number | undefined {
  if (!word) return undefined
  const lw = word.toLowerCase()
  let n = 0
  for (let i = 0; i < ref.words.length; i++) {
    if (ref.words[i].w.toLowerCase().replace(/[^a-z']/g, '') === lw) { if (n === occurrence) return i; n++ }
  }
  return undefined
}

/** Longest word (for single-word stress items where no word is named). */
function mainWord(ref: Ref): number {
  let bi = 0
  ref.words.forEach((w, i) => { if (w.syl.length > ref.words[bi].syl.length) bi = i })
  return bi
}

export interface Prepared {
  ref: Ref
  checks: Check[]
  expect: Expect
  competitor?: Ref
  modelKey?: string
}

/** Translate a content item into an engine request for the learner's variety. */
export function prepareProduction(item: ProductionItem, target: Target, v: Variety, variantIdx = 0): Prepared {
  if (item.type === 'pair' && item.pair) {
    const me = item.pair[variantIdx]
    const other = item.pair[1 - variantIdx]
    return { ref: me.ref[v], checks: [], expect: {}, competitor: other.ref[v] }
  }
  const ref = item.ref![v]
  const checks = item.checks?.[v] ?? []
  const expect: Expect = {}
  const kind = target.kind
  if (kind === 'stress' || kind === 'spelling' || kind === 'count' || kind === 'reduction') {
    if (item.stress !== undefined) {
      const wi = item.word ? wordIndex(ref, item.word) ?? mainWord(ref) : mainWord(ref)
      expect.stressWord = wi
      expect.stress = item.stress
    } else if (item.stress_words) {
      expect.stressWords = []
      for (const [w, st] of Object.entries(item.stress_words)) {
        const list = Array.isArray(st) ? st : [st]
        list.forEach((s, occ) => {
          const wi = wordIndex(ref, w, occ)
          if (wi !== undefined) expect.stressWords!.push({ w: wi, st: s })
        })
      }
    } else if (kind === 'stress' && ref.words.length === 1 && ref.words[0].st !== null && ref.words[0].syl.length > 1) {
      expect.stressWord = 0
      expect.stress = ref.words[0].st!
    }
    if (item.focus_word !== undefined) {
      // compound vs phrase: the main stress is on one of the words
      const content = ref.words.map((w, i) => ({ w, i })).filter(({ w }) => !['a', 'an', 'the'].includes(w.w.toLowerCase()))
      const target = content[item.focus_word]
      if (target) expect.nucleusWord = target.i
    }
  }
  if (kind === 'nucleus') {
    if (item.focus !== undefined) expect.nucleusWord = item.focus
    else if (item.nucleus) expect.nucleusWord = wordIndex(ref, item.nucleus)
  }
  if (item.tone) expect.tone = item.tone
  if (kind === 'intonation' && !item.tone) expect.tone = ref.text.trim().endsWith('?') ? 'rise' : 'fall'
  if (item.chunks) {
    let n = 0
    expect.chunkEnds = item.chunks.slice(0, -1).map((c) => { n += c.split(/\s+/).length; return n - 1 })
  }
  if (kind === 'segment' && target.phones.some((p) => ['iː', 'ɪ', 'æ', 'ʌ', 'ʊ', 'uː'].includes(p)) && ref.words.length === 1) expect.vowelWord = 0
  return { ref, checks, expect }
}

export function levelOf(target: Target): Level { return target.level }
