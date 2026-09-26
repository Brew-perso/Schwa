import { useState } from 'react'
import type { LessonBlock, Target } from '../content/types'
import { useSettings, instrFor, ipaFor } from '../data/settings'
import { useCourse } from '../content/store'
import { pickBi, useT } from '../i18n'
import { AudioButton } from '../components/AudioButton'
import { SagittalContrast } from '../viz/Sagittal'
import { VowelMap } from '../viz/VowelMap'
import { Bubbles } from '../viz/Bubbles'
import { Melody } from '../viz/Melody'
import { Paper } from '../components/Paper'
import { IconArrowLeft, IconArrowRight, IconHand, IconInfo, IconBook, IconEar, IconQuestion } from '../art/Icons'
import { playKey, playSequence } from '../audio/player'
import { sfx } from '../audio/sfx'
import { Swallow } from '../art/Swallow'

/** Micro-lesson (60–90 s): one target, why it matters, the gesture, a French↔English contrast, one check question. */
export function LessonPlayer({ target, onDone }: { target: Target; onDone: () => void }) {
  const s = useSettings((st) => st.s)
  const t = useT()
  const mode = instrFor(s, target.level)
  const lang = mode === 'en' ? 'en' : 'fr'
  const [i, setI] = useState(0)
  const [showOther, setShowOther] = useState(false)
  const intro: LessonBlock = { type: 'text', fr: target.why.fr, en: target.why.en }
  const blocks = [intro, ...target.lesson]
  const b = blocks[i]
  const last = i === blocks.length - 1
  const [quizPick, setQuizPick] = useState<number | null>(null)
  const canNext = b.type !== 'quiz' || quizPick !== null
  const go = (d: number) => { sfx('page'); setShowOther(false); setQuizPick(null); setI((x) => Math.max(0, Math.min(blocks.length - 1, x + d))) }
  return (
    <div className="stack" style={{ ['--stack' as string]: '16px' }}>
      <div className="steps-dots" aria-label={`Carte ${i + 1} / ${blocks.length}`}>
        {blocks.map((_, k) => <i key={k} className={k < i ? 'done' : k === i ? 'now' : ''} />)}
      </div>
      <Paper tone={b.type === 'rule' ? 'kraft' : b.type === 'contrast' ? 'sky' : 'card'} seed={target.id + i} tape={tapeFor(b.type, lang)} tapeTone={b.type === 'gesture' ? 'teal' : b.type === 'quiz' ? 'coral' : ''}>
        <div className="lesson-card fade-in" key={i}>
          {i === 0 && (
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <h2 style={{ marginTop: 8 }}>{pickBi(target.title, lang, s.register)}</h2>
                <p className="italic-display" style={{ fontSize: '1.15rem', color: 'var(--text-2)' }}>{pickBi(target.tagline, lang, s.register)}</p>
              </div>
              <Swallow pose="listen" size={92} />
            </div>
          )}
          <BlockBody b={b} target={target} lang={lang} register={s.register} quizPick={quizPick} setQuizPick={setQuizPick} />
          {mode === 'mixed' || mode === 'en' ? (
            <div>
              <button className="chip" onClick={() => setShowOther((x) => !x)} aria-expanded={showOther}>{lang === 'en' ? 'FR' : 'EN'} ↔</button>
              {showOther && <p className="small muted" style={{ marginTop: 8 }}>{pickBi(b.type === 'quiz' ? b.q : { fr: b.fr ?? '', en: b.en ?? '' }, lang === 'en' ? 'fr' : 'en', s.register)}</p>}
            </div>
          ) : null}
        </div>
      </Paper>
      <div className="spread">
        <button className="btn ghost" onClick={() => go(-1)} disabled={i === 0}><IconArrowLeft width={20} height={20} /> {t('back')}</button>
        {last
          ? <button className="btn primary" disabled={!canNext} onClick={() => { sfx('open'); onDone() }}>{t('continue')} <IconArrowRight width={20} height={20} /></button>
          : <button className="btn primary" disabled={!canNext} onClick={() => go(1)}>{t('next')} <IconArrowRight width={20} height={20} /></button>}
      </div>
    </div>
  )
}

function tapeFor(type: LessonBlock['type'], lang: 'fr' | 'en') {
  const fr: Record<string, string> = { text: 'Pourquoi', listen: 'Écouter', contrast: 'Français / anglais', gesture: 'Le geste', rule: 'La règle', quiz: 'Vérifier' }
  const en: Record<string, string> = { text: 'Why', listen: 'Listen', contrast: 'French / English', gesture: 'The gesture', rule: 'The rule', quiz: 'Check' }
  return (lang === 'fr' ? fr : en)[type]
}

function BlockBody({ b, target, lang, register, quizPick, setQuizPick }: { b: LessonBlock; target: Target; lang: 'fr' | 'en'; register: 'vous' | 'tu'; quizPick: number | null; setQuizPick: (n: number) => void }) {
  const s = useSettings((st) => st.s)
  const course = useCourse()
  const v = s.variety
  const text = pickBi({ fr: b.fr ?? '', en: b.en ?? '' }, lang, register)
  const ipa = ipaFor(s, target.level)
  if (b.type === 'listen') {
    const items = b.items ?? []
    return (
      <>
        <p className="lesson-text">{text}</p>
        <div className="row wrap" style={{ gap: 10 }}>
          {items.map((it, k) => (
            <div key={k} className="word-chip">
              <AudioButton audio={it.audio[v].m[0]} size="sm" label={it.text} />
              <span>{it.text}</span>
              {ipa >= 2 && <span className="ipa small muted">/{it.ref[v].ipa}/</span>}
            </div>
          ))}
        </div>
        {items.length > 1 && (
          <div><button className="btn small teal" onClick={() => void playSequence(items.map((it) => () => playKey(it.audio[v].m[0].f)), 450)}><IconEar width={18} height={18} /> {lang === 'fr' ? 'Tout écouter' : 'Play all'}</button></div>
        )}
      </>
    )
  }
  if (b.type === 'contrast') {
    const en = b.audio?.en?.[v]?.m[0]
    return (
      <>
        <p className="lesson-text">{text}</p>
        <div className="contrast-row">
          <div className="paper flat" style={{ padding: 12 }}>
            <div className="flag"><i style={{ background: 'linear-gradient(90deg,#2b4a9b 33%,#fff 33% 66%,#d8403c 66%)' }} /> Français</div>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', margin: '8px 0' }}>{b.french}</p>
            <AudioButton audio={b.audio?.fr ?? undefined} size="sm" label="Français" />
          </div>
          <div className="paper flat" style={{ padding: 12 }}>
            <div className="flag"><i style={{ background: v === 'GA' ? 'repeating-linear-gradient(0deg,#b22234 0 2px,#fff 2px 4px)' : 'linear-gradient(90deg,#012169,#c8102e,#012169)' }} /> English ({v})</div>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', margin: '8px 0' }}>{b.english}</p>
            <AudioButton audio={en} size="sm" label="English" />
          </div>
        </div>
      </>
    )
  }
  if (b.type === 'gesture') {
    const art = b.art ?? ''
    let visual: React.ReactNode = <div className="center"><IconHand width={72} height={72} style={{ color: 'var(--teal)' }} /></div>
    if (art.startsWith('sagittal:')) {
      const id = art.split(':')[1]
      visual = <SagittalContrast id={id === 'θ' ? 'θ' : id} lang={lang} />
    } else if (art.startsWith('vowels:')) {
      const pair = art.split(':')[1].split('-')
      visual = (
        <div className="grid-2" style={{ alignItems: 'center' }}>
          <SagittalContrast id={`${pair[0]}-${pair[1]}`} lang={lang} />
          <VowelMap targets={pair} lang={lang} highlight={pair[1]} />
        </div>
      )
    } else if (art === 'bubbles') {
      const ex = target.lesson.find((x) => x.type === 'listen')?.items?.[0]
      const w = ex?.ref[v].words.reduce((a, x) => (x.syl.length > a.syl.length ? x : a), ex.ref[v].words[0])
      if (w) visual = <Bubbles word={w} units={course?.units ?? []} />
    } else if (art === 'melody') {
      const ex = target.lesson.find((x) => x.type === 'listen')?.items?.[0] ?? (target.lesson.find((x) => x.type === 'contrast') as LessonBlock | undefined)
      const m = ex && 'audio' in ex ? ((ex as { audio: { m?: unknown } }).audio as Record<string, { m: import('../content/types').AudioRef[] }>)?.[v]?.m?.[0] : undefined
      if (m) visual = <Melody model={m} words={(ex as { ref: Record<string, import('../content/types').Ref> }).ref?.[v]?.words.map((w) => w.w)} />
    }
    return (<>{visual}<p className="lesson-text" style={{ fontWeight: 600 }}>{text}</p></>)
  }
  if (b.type === 'rule') {
    return (<div className="row" style={{ alignItems: 'flex-start' }}><IconBook width={30} height={30} style={{ flex: 'none', color: 'var(--rust)', marginTop: 4 }} /><p className="lesson-text" style={{ margin: 0 }}>{text}</p></div>)
  }
  if (b.type === 'quiz' && b.q && b.options) {
    return (
      <>
        <div className="row" style={{ alignItems: 'flex-start' }}><IconQuestion width={28} height={28} style={{ flex: 'none', color: 'var(--indigo)' }} /><p className="lesson-text" style={{ margin: 0, fontWeight: 700 }}>{pickBi(b.q, lang, register)}</p></div>
        <div className="choices">
          {b.options.map((o, k) => {
            const done = quizPick !== null
            const right = k === b.answer
            return (
              <button key={k} className="choice" disabled={done} onClick={() => { setQuizPick(k); sfx(right ? 'right' : 'miss') }}
                style={done ? (right ? { borderColor: 'var(--clear)', background: 'var(--clear-bg)' } : k === quizPick ? { borderColor: 'var(--rework)', background: 'var(--rework-bg)' } : undefined) : undefined}>
                <span className="choice-title ipa" style={{ fontFamily: 'var(--font-body)' }}>{o}</span>
              </button>
            )
          })}
        </div>
        {quizPick !== null && b.explain && <p className="fade-in" style={{ margin: 0 }}><IconInfo width={18} height={18} style={{ verticalAlign: '-3px', color: 'var(--teal)' }} /> {pickBi(b.explain, lang, register)}</p>}
      </>
    )
  }
  return <p className="lesson-text">{text}</p>
}
