import type { AudioRef, Ref, Variety } from '../content/types'
import type { State } from '../engine/evaluate'
import { playBuffer, playKey, playSequence } from '../audio/player'

/**
 * Default view (spec "Texte annoté"): the sentence in normal spelling, words underlined by state,
 * IPA shown according to the progressive-disclosure level. Tap a word: model segment, then mine.
 */
export function AnnotatedText({ refd, states, ipaLevel, focusWords, model, learner, learnerWords, stressMarks = false, big = true }: {
  refd: Ref
  variety: Variety
  states?: (State | undefined)[]
  ipaLevel: 1 | 2 | 3
  focusWords?: Set<number>
  model?: AudioRef
  learner?: AudioBuffer | null
  learnerWords?: { t0: number; t1: number }[]
  stressMarks?: boolean
  big?: boolean
}) {
  const playWord = (i: number) => {
    const steps: (() => Promise<void>)[] = []
    const mt = model?.wt?.[i]
    if (model && mt) steps.push(() => playKey(model.f, { start: Math.max(0, mt[0] - 0.04), end: mt[1] + 0.06 }))
    const lt = learnerWords?.[i]
    if (learner && lt) steps.push(() => playBuffer(learner, { start: Math.max(0, lt.t0 - 0.05), end: lt.t1 + 0.08, id: 'me' }))
    if (steps.length) void playSequence(steps, 220)
  }
  return (
    <div className="annot" style={big ? undefined : { fontSize: '1.3rem' }}>
      {refd.words.map((w, i) => {
        const st = states?.[i]
        const showIpa = ipaLevel === 3 || (ipaLevel === 2 && (focusWords?.has(i) || (st && st !== 'clear')))
        const cls = st ? `st-${st}` : ''
        const label = stressMarks && w.syl.length > 1 && w.st !== null
          ? w.syl.map((s, k) => <span key={k} className={k === w.st ? 'syl-strong' : ''}>{k === w.st ? s.l.toUpperCase() : s.l}</span>)
          : w.w
        return (
          <span key={i} className="wbox">
            <span className={`w ${cls}`} role="button" tabIndex={0} onClick={() => playWord(i)} onKeyDown={(e) => { if (e.key === 'Enter') playWord(i) }}
              aria-label={`${w.w}${st ? ' — ' + st : ''}`}>
              {label}
            </span>
            {showIpa && <span className="ipa-under">/{w.ipa.replace(/ˌ/g, 'ˌ')}/</span>}
          </span>
        )
      })}
    </div>
  )
}
