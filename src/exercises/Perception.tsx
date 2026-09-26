import { useEffect, useMemo, useState } from 'react'
import type { AudioRef, PerceptionItem, PerceptionOption, Target, Variety } from '../content/types'
import { useSettings, instrFor } from '../data/settings'
import { useCourse } from '../content/store'
import { pickBi, reg, useT } from '../i18n'
import { playKey, preload, stopAll } from '../audio/player'
import { sfx } from '../audio/sfx'
import { IconArrowRight, IconEar, IconPlay } from '../art/Icons'
import { db } from '../data/db'
import { Bubbles } from '../viz/Bubbles'

/** Choose a voice: mostly the learner's model, sometimes the other variety (exposure to variation). */
function pickAudio(a: Record<Variety, AudioRef[]> | undefined, v: Variety, rnd: number, avoidModel = true): { ref: AudioRef; variety: Variety } | null {
  if (!a) return null
  const other: Variety = v === 'GA' ? 'SBE' : 'GA'
  const useOther = rnd < 0.28 && a[other]?.length
  const list = useOther ? a[other] : a[v]
  if (!list?.length) return null
  // the first two voices are the production models: prefer "new" voices for HVPT consolidation
  const pool = avoidModel && list.length > 3 ? list.slice(2) : list
  const idx = Math.floor((rnd * 997) % pool.length)
  return { ref: pool[idx], variety: useOther ? other : v }
}

export interface PerceptionOutcome { ok: boolean; novelVoice: boolean }

export function PerceptionItemView({ item, target, onAnswer, onNext }: {
  item: PerceptionItem; target: Target; onAnswer: (o: PerceptionOutcome) => void; onNext: () => void
}) {
  const s = useSettings((st) => st.s)
  const course = useCourse()
  const t = useT()
  const v = s.variety
  const lang = instrFor(s, target.level) === 'en' ? 'en' : 'fr'
  const rnd = useMemo(() => Math.random(), [item.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const answerIdx = useMemo(() => Math.floor(Math.random() * 1000), [item.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const [picked, setPicked] = useState<number | null>(null)
  const [picks, setPicks] = useState<Set<number>>(new Set())
  const [typed, setTyped] = useState('')

  // resolve what is played
  const opts = (item.options ?? []) as PerceptionOption[]
  const isIdentify = item.type === 'identify'
  const correct = isIdentify ? answerIdx % opts.length : -1
  const played = isIdentify ? pickAudio(opts[correct]?.audio, v, rnd) : item.type === 'letters' ? pickAudio(item.audio, v, rnd) : pickAudio(item.audio, v, rnd, false)
  const ref = item.ref?.[played?.variety ?? v]
  const word = ref ? (item.word ? ref.words.find((w) => w.w.toLowerCase() === item.word) : ref.words.reduce((b, w) => (w.syl.length > b.syl.length ? w : b), ref.words[0])) : undefined

  useEffect(() => {
    setPicked(null); setPicks(new Set()); setTyped('')
    if (played) {
      preload([played.ref.f])
      const tm = setTimeout(() => void playKey(played.ref.f).catch(() => {}), 350)
      return () => { clearTimeout(tm); stopAll() }
    }
  }, [item.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const answered = picked !== null
  const replay = () => played && void playKey(played.ref.f)

  const finish = async (ok: boolean, chosen: number) => {
    setPicked(chosen)
    sfx(ok ? 'right' : 'miss')
    await db.attempts.add({ ts: Date.now(), targetId: target.id, itemId: item.id, step: 'hear', kind: 'perception', ok, voice: played?.ref.f })
    onAnswer({ ok, novelVoice: true })
  }

  // ---------- instructions per task
  const ask: Record<string, { fr: string; en: string }> = {
    identify: { fr: "Quel mot [avez-vous|as-tu] entendu ?", en: 'Which word did you hear?' },
    letters: { fr: 'Quelle lettre ?', en: 'Which letter?' },
    stress: { fr: 'Où est la syllabe forte ?', en: 'Where is the strong syllable?' },
    'stress-phrase': { fr: 'Quel mot porte l’accent principal ?', en: 'Which word carries the main stress?' },
    schwa: { fr: '[Touchez|Touche] la ou les syllabes réduites (/ə/).', en: 'Tap the reduced syllable(s) (/ə/).' },
    count: { fr: 'Combien de syllabes [entendez-vous|entends-tu] ?', en: 'How many syllables do you hear?' },
    endings: { fr: 'Comment se prononce la terminaison ?', en: 'How is the ending pronounced?' },
    nucleus: { fr: 'Sur quel mot la voix fait-elle son plus grand mouvement ?', en: 'On which word does the voice make its biggest move?' },
    focus: { fr: 'À quelle question cette phrase répond-elle ?', en: 'Which question does this sentence answer?' },
    tone: { fr: 'La voix monte ou descend à la fin ?', en: 'Does the voice rise or fall at the end?' },
    chunks: { fr: '[Touchez|Touche] les endroits où la voix fait une pause.', en: 'Tap where the voice pauses.' },
    dictation: { fr: '[Écrivez|Écris] les mots manquants.', en: 'Type the missing words.' },
  }
  const q = ask[item.type] ?? ask.identify

  let body: React.ReactNode = null
  if (isIdentify) {
    body = (
      <div className="tiles">
        {opts.map((o, i) => {
          const cls = answered ? (i === correct ? 'is-right' : i === picked ? 'is-wrong' : '') : ''
          return (
            <button key={i} className={`tile ${cls}`} disabled={answered} onClick={() => finish(i === correct, i)}>
              {o.text}
              {answered && <span className="tile-sub">/{o.ref[v].ipa.replace(/[ˈˌ]/g, '')}/</span>}
            </button>
          )
        })}
      </div>
    )
  } else if (item.type === 'letters') {
    const opt = item.options as string[]
    const ci = opt.indexOf(item.say!)
    body = (
      <div className="tiles">
        {opt.map((o, i) => (
          <button key={i} className={`tile ${answered ? (i === ci ? 'is-right' : i === picked ? 'is-wrong' : '') : ''}`} disabled={answered} onClick={() => finish(i === ci, i)} style={{ fontSize: '2.2rem' }}>{o}</button>
        ))}
      </div>
    )
  } else if ((item.type === 'stress' || item.type === 'schwa') && word) {
    const expected = item.type === 'stress' ? [item.stress!] : (item.weak ?? [])
    const multi = item.type === 'schwa'
    body = (
      <div className="stack" style={{ ['--stack' as string]: '12px' }}>
        <div className="row" style={{ justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
          {word.syl.map((sy, i) => {
            const sel = multi ? picks.has(i) : picked === i
            const right = expected.includes(i)
            const cls = answered ? (right ? 'is-right' : sel ? 'is-wrong' : '') : sel ? 'selected' : ''
            return (
              <button key={i} className={`tile ${cls}`} disabled={answered} style={{ minWidth: 86, minHeight: 72, fontSize: '1.4rem' }}
                onClick={() => {
                  if (multi) { const n = new Set(picks); if (n.has(i)) n.delete(i); else n.add(i); setPicks(n) }
                  else void finish(i === item.stress, i)
                }}>
                {answered && i === item.stress && item.type === 'stress' ? sy.l.toUpperCase() : sy.l}
              </button>
            )
          })}
        </div>
        {multi && !answered && (
          <div className="center"><button className="btn small" disabled={!picks.size} onClick={() => {
            const ok = picks.size === expected.length && expected.every((e) => picks.has(e))
            void finish(ok, -1)
          }}>{lang === 'fr' ? 'Valider' : 'Check'}</button></div>
        )}
        {answered && item.type === 'stress' && <Bubbles word={word} units={course?.units ?? []} stress={item.stress} compact />}
      </div>
    )
  } else if (item.type === 'count' && item.count) {
    const exp = item.count[played?.variety ?? v]
    const choices = Array.from(new Set([Math.max(1, exp - 1), exp, exp + 1, exp + 2])).sort((a, b) => a - b)
    body = (
      <div className="tiles">
        {choices.map((n) => (
          <button key={n} className={`tile ${answered ? (n === exp ? 'is-right' : n === picked ? 'is-wrong' : '') : ''}`} disabled={answered} onClick={() => finish(n === exp, n)}>
            {n}<span className="tile-sub">{answered && n === exp ? item.text : ' '}</span>
          </button>
        ))}
      </div>
    )
  } else if (item.type === 'endings') {
    const set = ['t', 'd', 'ɪd'].includes(item.ending!) ? ['t', 'd', 'ɪd'] : ['s', 'z', 'ɪz']
    body = (
      <div className="stack" style={{ ['--stack' as string]: '10px' }}>
        <p className="center" style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', margin: 0 }}>{item.text}</p>
        <div className="tiles">
          {set.map((e, i) => (
            <button key={e} className={`tile ${answered ? (e === item.ending ? 'is-right' : i === picked ? 'is-wrong' : '') : ''}`} disabled={answered} onClick={() => finish(e === item.ending, i)}>
              <span className="ipa">/{e}/</span>
            </button>
          ))}
        </div>
      </div>
    )
  } else if ((item.type === 'nucleus' || item.type === 'stress-phrase') && ref) {
    const content = ref.words.map((w, i) => ({ w, i })).filter(({ w }) => item.type !== 'stress-phrase' || !['a', 'an', 'the'].includes(w.w.toLowerCase()))
    const expIdx = item.type === 'nucleus'
      ? ref.words.findIndex((w) => w.w.toLowerCase().replace(/[^a-z']/g, '') === (item.nucleus ?? '').toLowerCase())
      : content[item.focus_word ?? 0]?.i
    body = (
      <div className="row wrap" style={{ justifyContent: 'center', gap: 8 }}>
        {content.map(({ w, i }) => (
          <button key={i} className={`tile ${answered ? (i === expIdx ? 'is-right' : i === picked ? 'is-wrong' : '') : ''}`} disabled={answered}
            style={{ minHeight: 64, fontSize: '1.3rem', flex: '0 0 auto', minWidth: 70 }} onClick={() => finish(i === expIdx, i)}>{w.w}</button>
        ))}
      </div>
    )
  } else if (item.type === 'focus' && ref) {
    // choose the question the sentence answers: the correct one + 2 others from the same target
    const others = (target.perception.items.filter((x) => x.type === 'focus' && x.text === item.text && x.focus !== item.focus && x.question).slice(0, 2))
    const all = [item, ...others].sort((a, b) => (a.focus ?? 0) - (b.focus ?? 0))
    body = (
      <div className="choices">
        {all.map((x, i) => (
          <button key={i} className={`choice ${answered ? (x === item ? 'selected' : i === picked ? '' : '') : ''}`} disabled={answered}
            style={answered && x === item ? { borderColor: 'var(--clear)', background: 'var(--clear-bg)' } : answered && i === picked ? { borderColor: 'var(--rework)', background: 'var(--rework-bg)' } : undefined}
            onClick={() => finish(x === item, i)}>
            <span className="choice-title">{x.question ? pickBi(x.question, 'en', s.register) : ''}</span>
            {lang === 'fr' && x.question && <span className="choice-sub">{reg(x.question.fr, s.register)}</span>}
          </button>
        ))}
      </div>
    )
  } else if (item.type === 'tone') {
    const choices: ('fall' | 'rise' | 'fall-rise')[] = target.id === 'c1-tones' ? ['fall', 'rise', 'fall-rise'] : ['fall', 'rise']
    const glyph = { fall: '↘', rise: '↗', 'fall-rise': '↘↗' }
    const name = lang === 'fr' ? { fall: 'descend', rise: 'monte', 'fall-rise': 'descend puis remonte' } : { fall: 'falls', rise: 'rises', 'fall-rise': 'falls then rises' }
    body = (
      <div className="stack" style={{ ['--stack' as string]: '10px' }}>
        <p className="center" style={{ fontFamily: 'var(--font-display)', fontSize: '1.7rem', margin: 0 }}>{item.text?.replace(/[?.]$/, '…')}</p>
        <div className="tiles">
          {choices.map((c, i) => (
            <button key={c} className={`tile ${answered ? (c === item.tone ? 'is-right' : i === picked ? 'is-wrong' : '') : ''}`} disabled={answered} onClick={() => finish(c === item.tone, i)}>
              {glyph[c]}<span className="tile-sub">{name[c]}</span>
            </button>
          ))}
        </div>
      </div>
    )
  } else if (item.type === 'chunks' && ref && item.chunks) {
    let n = 0
    const exp = new Set(item.chunks.slice(0, -1).map((c) => { n += c.split(/\s+/).length; return n - 1 }))
    body = (
      <div className="stack" style={{ ['--stack' as string]: '12px' }}>
        <div className="annot" style={{ fontSize: '1.35rem', lineHeight: 2.2, textAlign: 'center' }}>
          {ref.words.map((w, i) => (
            <span key={i}>
              {w.w}
              {i < ref.words.length - 1 && (
                <button aria-label={`pause après ${w.w}`} disabled={answered}
                  onClick={() => { const nn = new Set(picks); if (nn.has(i)) nn.delete(i); else nn.add(i); setPicks(nn) }}
                  style={{ margin: '0 4px', width: 26, height: 26, borderRadius: 999, border: '2px solid var(--ink)', cursor: 'pointer', verticalAlign: 'middle',
                    background: answered ? (exp.has(i) ? 'var(--mint)' : picks.has(i) ? 'var(--rework-bg)' : 'transparent') : picks.has(i) ? 'var(--mustard)' : 'transparent' }}>
                  {picks.has(i) || (answered && exp.has(i)) ? '/' : ''}
                </button>
              )}
            </span>
          ))}
        </div>
        {!answered && <div className="center"><button className="btn small" onClick={() => {
          const ok = picks.size === exp.size && [...exp].every((e) => picks.has(e))
          void finish(ok, -1)
        }}>{lang === 'fr' ? 'Valider' : 'Check'}</button></div>}
      </div>
    )
  } else if (item.type === 'dictation' && item.text) {
    const blanks = item.blanks ?? []
    const norm = (x: string) => x.toLowerCase().replace(/[^a-z' ]/g, '').replace(/\s+/g, ' ').trim()
    const shown = blanks.reduce((acc, b) => acc.replace(new RegExp(`\\b${b.replace(/'/g, "'")}\\b`, 'i'), '____'), item.text)
    body = (
      <div className="stack" style={{ ['--stack' as string]: '12px' }}>
        <p className="center" style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', margin: 0 }}>{answered ? item.text : shown}</p>
        {!answered && (
          <form className="row" onSubmit={(e) => { e.preventDefault(); const ok = norm(typed) === norm(blanks.join(' ')); void finish(ok, -1) }}>
            <input type="text" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={blanks.map(() => '…').join(' / ')} aria-label="Mots manquants" autoFocus />
            <button className="btn small" type="submit">OK</button>
          </form>
        )}
      </div>
    )
  }

  return (
    <div className="stack" style={{ ['--stack' as string]: '18px' }}>
      <div className="center">
        <p className="label" style={{ margin: 0 }}>{pickBi(q, lang, s.register)}</p>
      </div>
      <div className="row" style={{ justifyContent: 'center' }}>
        <button className="audio-btn" style={{ width: 76, height: 76 }} onClick={replay} aria-label={t('listen')}><IconPlay /></button>
      </div>
      {body}
      {answered && (
        <div className="fade-in stack" style={{ ['--stack' as string]: '10px' }}>
          {isIdentify && (
            <div className="row wrap" style={{ justifyContent: 'center', gap: 8 }}>
              {opts.map((o, i) => {
                const a = pickAudio(o.audio, played?.variety ?? v, rnd)
                return a ? <button key={i} className="chip" onClick={() => void playKey(a.ref.f)}><IconEar width={16} height={16} /> {o.text}</button> : null
              })}
            </div>
          )}
          <p className="center small muted" style={{ margin: 0 }}>
            {played?.variety !== v ? (lang === 'fr' ? reg(`Voix ${played?.variety === 'SBE' ? 'britannique' : 'américaine'} : on s'entraîne aussi à comprendre d'autres accents.`, s.register) : `A ${played?.variety === 'SBE' ? 'British' : 'American'} voice: we also practise understanding other accents.`) : t('synthetic_voice')}
          </p>
          <div className="center"><button className="btn primary" onClick={() => { sfx('page'); onNext() }}>{t('next')} <IconArrowRight width={20} height={20} /></button></div>
        </div>
      )}
    </div>
  )
}
