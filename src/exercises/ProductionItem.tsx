import { useEffect, useMemo, useRef, useState } from 'react'
import type { ProductionItem, Target } from '../content/types'
import { useSettings, ipaFor, instrFor } from '../data/settings'
import { useCourse } from '../content/store'
import { pickBi, reg, useT, fill } from '../i18n'
import { prepareProduction, heardIpa } from '../learning/items'
import { engine, type FullResult } from '../engine/client'
import type { Recording } from '../audio/recorder'
import { learnerBuffer, playBuffer, playKey, playSequence, preload, stopAll } from '../audio/player'
import { AnnotatedText } from '../components/AnnotatedText'
import { AudioButton } from '../components/AudioButton'
import { RecordButton } from '../components/RecordButton'
import { StateBadge } from '../components/StateBadge'
import { Bubbles } from '../viz/Bubbles'
import { Melody } from '../viz/Melody'
import { VowelMap, normaliseFormants, VOWEL_Z } from '../viz/VowelMap'
import { IconAB, IconSlow, IconRepeat, IconArrowRight, IconEar, IconInfo } from '../art/Icons'
import { db, pruneAttemptAudio } from '../data/db'
import { toWav } from '../audio/dsp'
import type { State } from '../engine/evaluate'
import { sfx } from '../audio/sfx'

export interface ItemOutcome { state: State; judged: boolean; ok: boolean }

/** One production item with the 3-layer feedback: verdict → gesture instruction → detail. */
export function ProductionItemView({ item, target, step, onDone, onNext, showCriterion = false }: {
  item: ProductionItem
  target: Target
  step: 'produce' | 'guided' | 'review' | 'diagnostic'
  onDone?: (o: ItemOutcome) => void
  onNext?: () => void
  showCriterion?: boolean
}) {
  const s = useSettings((st) => st.s)
  const course = useCourse()
  const t = useT()
  const v = s.variety
  const lang = instrFor(s, target.level) === 'en' ? 'en' : 'fr'
  const ipaLevel = ipaFor(s, target.level)
  const [pairIdx] = useState(() => (item.type === 'pair' ? Math.round(Math.random()) : 0))
  const prep = useMemo(() => prepareProduction(item, target, v, pairIdx), [item, target, v, pairIdx])
  const audio = item.type === 'pair' ? item.pair![pairIdx].audio[v] : item.audio?.[v]
  const [voice, setVoice] = useState(0)
  const model = audio?.m[voice] ?? audio?.m[0]
  const [result, setResult] = useState<FullResult | null>(null)
  const [rec, setRec] = useState<Recording | null>(null)
  const [busy, setBusy] = useState(false)
  const [attempts, setAttempts] = useState(0)
  const [prediction, setPrediction] = useState<number | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const lbuf = useMemo(() => (rec ? learnerBuffer(rec.native, rec.sampleRate) : null), [rec])
  const reported = useRef(false)

  useEffect(() => {
    if (audio) preload([...audio.m.map((a) => a.f), ...(audio.s ? [audio.s.f] : [])])
    setResult(null); setRec(null); setAttempts(0); setPrediction(null); reported.current = false
    return () => stopAll()
  }, [item.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const units = course?.units ?? []

  const onRecorded = async (r: Recording) => {
    setRec(r)
    setBusy(true)
    setErr(null)
    try {
      const res = await engine.evaluate({
        audio: r.audio16k, ref: prep.ref, checks: prep.checks, expect: prep.expect, level: target.level,
        competitor: prep.competitor, f0ref: s.calibration?.f0med, transcribe: item.type !== 'pair',
        modelKey: audio?.m[0]?.f,
      })
      setResult(res)
      setAttempts((a) => a + 1)
      const overall = overallState(res)
      const judged = !res.qc && overall !== 'unsure'
      await db.attempts.add({
        ts: Date.now(), targetId: target.id, itemId: item.id, step: step === 'diagnostic' ? 'diagnostic' : step === 'review' ? 'review' : step,
        kind: 'production', ok: judged ? overall === 'clear' : null, state: overall, prediction: prediction ?? undefined,
        detail: { priority: res.priority, qc: res.qc, transcript: res.transcript },
        audio: s.consent.storeAudio ? toWav(r.audio16k, 16000) : undefined,
      })
      void pruneAttemptAudio(item.id)
      if (!reported.current && judged) {
        reported.current = true
        onDone?.({ state: overall, judged, ok: overall === 'clear' })
      }
    } catch (e) {
      setErr(String((e as Error).message ?? e))
    } finally {
      setBusy(false)
    }
  }

  const playAB = () => {
    if (!model || !lbuf) return
    void playSequence([() => playKey(model.f), () => playBuffer(lbuf, { id: 'me' }), () => playKey(model.f)], 350)
  }
  const playSlowMe = () => { if (rec) void playBuffer(learnerBuffer(rec.native, rec.sampleRate, 0.78), { id: 'me-slow' }) }

  const overall = result ? overallState(result) : null
  const pairWords = item.type === 'pair' ? item.pair!.map((p) => p.text) : null
  const displayRef = prep.ref
  const focusWords = useMemo(() => new Set(prep.checks.map((c) => c.w)), [prep])

  return (
    <div className="stack" style={{ ['--stack' as string]: '18px' }}>
      {showCriterion && (
        <div className="criterion"><IconInfo /><span>{pickBi(target.criterion, lang, s.register)}</span></div>
      )}
      {item.type === 'pair' && (
        <p className="muted" style={{ margin: 0 }}>
          {lang === 'fr' ? reg('[Faites-vous|Fais-toi] comprendre : [dites|dis] ce mot, je [vous|te] dirai lequel j’ai entendu.', s.register) : 'Make yourself understood: say this word, I’ll tell you which one I heard.'}
        </p>
      )}
      {item.type === 'guided' && (item.fr || item.en) && (
        <p className="muted" style={{ margin: 0 }}>{pickBi({ fr: item.fr ?? '', en: item.en ?? '' }, lang, s.register)}</p>
      )}
      <div className="center" data-item-text={displayRef.text}>
        <AnnotatedText refd={displayRef} variety={v} ipaLevel={ipaLevel} focusWords={focusWords}
          states={result && !result.qc ? (item.type === 'pair' ? result.words.map(() => overallState(result)) : result.words.map((w) => w.state)) : undefined}
          model={model} learner={lbuf} learnerWords={result?.words}
          stressMarks={target.kind === 'stress' && ipaLevel >= 2 && !!result} />
      </div>
      <div className="row" style={{ justifyContent: 'center', gap: 14 }}>
        <AudioButton audio={model} label={t('listen_model')} size="lg" />
        {audio?.s && <AudioButton audio={audio.s} label={t('slow')} slow size="md" />}
        {audio && audio.m.length > 1 && (
          <button className="chip" onClick={() => setVoice((x) => (x + 1) % audio.m.length)} title={t('synthetic_voice')}>
            {voice === 0 ? '♀' : '♂'} {v}
          </button>
        )}
      </div>
      {s.predict && attempts === 0 && step !== 'diagnostic' && (
        <div className="stack" style={{ ['--stack' as string]: '8px' }}>
          <p className="small muted center" style={{ margin: 0 }}>{t('predict_q')}</p>
          <div className="pred">
            {[1, 2, 3].map((n) => (
              <button key={n} className={`chip ${prediction === n ? 'on' : ''}`} onClick={() => setPrediction(n)}>
                {n === 1 ? t('predict_1') : n === 2 ? t('predict_2') : t('predict_3')}
              </button>
            ))}
          </div>
        </div>
      )}
      <RecordButton onRecorded={onRecorded} busy={busy} maxMs={item.text && item.text.length > 60 ? 20000 : 12000} />
      {err && <p className="center small" style={{ color: 'var(--rework)' }}>{err}</p>}
      {result && (
        <Feedback result={result} item={item} target={target} prep={prep} lang={lang} register={s.register} units={units}
          variety={v} pairWords={pairWords} pairIdx={pairIdx} model={model} learner={lbuf} ipaLevel={ipaLevel}
          onAB={playAB} onSlowMe={playSlowMe} prediction={prediction} hideScores={s.hideScores} calib={s.calibration} />
      )}
      {result && (
        <div className="row" style={{ justifyContent: 'center', gap: 12, flexWrap: 'wrap' }}>
          {onNext && (
            <button className="btn primary" onClick={() => { sfx('page'); onNext() }}>
              {t('next')} <IconArrowRight width={20} height={20} />
            </button>
          )}
        </div>
      )}
      {!result && overall === null && onNext && attempts === 0 && (
        <div className="center"><button className="btn ghost small" onClick={onNext}>{t('skip')}</button></div>
      )}
    </div>
  )
}

export function overallState(r: FullResult): State {
  if (r.qc) return 'unsure'
  if (r.priority) return r.priority.state
  const all = [...r.issues.map((i) => i.state), ...r.checks.map((c) => c.state)]
  if (all.length && all.every((x) => x === 'unsure')) return 'unsure'
  return 'clear'
}

function Feedback({ result, item, target, prep, lang, register, units, variety, pairWords, pairIdx, model, learner, ipaLevel, onAB, onSlowMe, prediction, hideScores, calib }: {
  result: FullResult; item: ProductionItem; target: Target; prep: ReturnType<typeof prepareProduction>; lang: 'fr' | 'en'; register: 'vous' | 'tu'
  units: string[]; variety: 'GA' | 'SBE'; pairWords: string[] | null; pairIdx: number; model?: import('../content/types').AudioRef; learner: AudioBuffer | null
  ipaLevel: 1 | 2 | 3; onAB: () => void; onSlowMe: () => void; prediction: number | null; hideScores: boolean
  calib?: import('../data/settings').Calibration
}) {
  const t = useT()
  const overall = overallState(result)
  const ref = prep.ref
  // -------- layer 2: one instruction
  let consigne = ''
  let cards: { aim: string; aimIpa: string; heard: string } | null = null
  const p = result.priority
  const qcKey = result.qc ? (`qc_${result.qc.replace('-', '_')}` as 'qc_too_short') : null
  if (qcKey) consigne = t(qcKey)
  else if (item.type === 'pair' && result.pair) {
    const heardWord = result.pair.heard === 'target' ? pairWords![pairIdx] : result.pair.heard === 'competitor' ? pairWords![1 - pairIdx] : null
    consigne = heardWord
      ? `${t('understood_pair')} « ${heardWord} ».` + (result.pair.heard === 'target' ? '' : ' ' + fichePairHint(target, lang, register))
      : t('unsure_msg')
    if (result.pair.heard === 'competitor') cards = { aim: pairWords![pairIdx], aimIpa: ref.words[0]?.ipa ?? '', heard: pairWords![1 - pairIdx] }
  } else if (p) {
    const fiche = p.fiche ? target.fiches[p.fiche] : undefined
    const check = result.checks.find((c) => c.w === p.w && c.state === p.state)
    let heard = p.vars.heard ?? ''
    if (p.kind === 'segment' && check) {
      const alt = prep.checks.find((c) => c.w === check.w && c.p === check.p)?.alts.find((a) => a.r === check.realized)
      heard = heardIpa(ref, check.w, check.p, check.realized, !!prep.checks.find((c) => c.w === check.w && c.p === check.p)?.ins, units, variety, alt?.seq)
      cards = { aim: ref.words[p.w].w, aimIpa: '/' + ref.words[p.w].ipa.replace(/[ˈˌ]/g, '') + '/', heard }
    }
    const vars: Record<string, string> = {
      ...p.vars, heard, word: p.vars.word ?? ref.words[p.w]?.w ?? '',
      stressed: p.vars.stressed ?? '', nucleus: p.vars.nucleus ?? '',
      weak: check?.mode ? ref.words[check.w].ipa.replace(/[ˈˌ]/g, '') : '',
      ending: check ? (units[ref.words[check.w].u[ref.words[check.w].u.length - 1]] ?? '') : '',
      target: p.vars.target ?? '', expected: p.vars.expected ?? '', pos: '', phrase: ref.text, why: '', link: '', chunk: p.vars.chunk ?? '',
    }
    consigne = fiche ? pickBi(fiche, lang, register, vars) : genericHint(p.kind, lang, register, vars)
  } else if (overall === 'unsure') consigne = t('unsure_msg')
  else consigne = praise(target, result, ref, lang, register)

  const stressWords = [
    ...(prep.expect.stressWord !== undefined ? [{ w: prep.expect.stressWord, st: prep.expect.stress! }] : []),
    ...(prep.expect.stressWords ?? []),
  ]
  const showMelody = target.kind === 'intonation' || target.kind === 'nucleus' || prep.expect.tone || prep.expect.nucleusWord !== undefined
  const vowelZ = result.vowel ? normaliseFormants(result.vowel.f1, result.vowel.f2, calib) : null
  const vowelTargets = target.phones.filter((x) => VOWEL_Z[x])
  const predictedMatch = prediction && !result.qc ? (prediction === 3 && overall === 'clear') || (prediction === 1 && overall === 'rework') || (prediction === 2 && overall === 'refine') : null

  return (
    <div className={`fb-card ${overall} fade-in stack`} style={{ ['--stack' as string]: '14px' }} aria-live="polite">
      <div className="fb-verdict">
        {!hideScores && <StateBadge state={overall} />}
        {result.transcript && !result.qc && item.type !== 'pair' && ref.words.length > 1 && (
          <span className="small muted">{t('machine_understood')} : « {result.transcript} »</span>
        )}
      </div>
      <p className="fb-consigne" style={{ margin: 0 }}>{consigne}</p>
      {cards && (
        <div className="cmp-cards">
          <div className="cmp-card aim">
            <span className="label">{t('aimed_at')}</span>
            <span className="big">{cards.aim}</span>
            {ipaLevel >= 2 && <span className="ipa">{cards.aimIpa}</span>}
            {model && <AudioButton audio={model} size="sm" label={t('listen_model')} />}
          </div>
          <div className="cmp-card heard">
            <span className="label">{t('heard_as')}</span>
            <span className="big ipa">{cards.heard}</span>
            {learner && <button className="audio-btn alt" style={{ width: 38, height: 38 }} onClick={() => void playBuffer(learner, { id: 'me' })} aria-label={t('listen_me')}><IconEar /></button>}
          </div>
        </div>
      )}
      <div className="row wrap" style={{ gap: 8 }}>
        <button className="btn small teal" onClick={onAB} disabled={!learner}><IconAB width={20} height={20} /> {t('ab')}</button>
        <button className="btn small" onClick={() => learner && void playBuffer(learner, { id: 'me' })} disabled={!learner}><IconRepeat width={18} height={18} /> {t('listen_me')}</button>
        <button className="btn small" onClick={onSlowMe} disabled={!learner}><IconSlow width={20} height={20} /> {t('slow')}</button>
      </div>
      {predictedMatch !== null && (
        <p className="small muted" style={{ margin: 0 }}>
          {lang === 'fr'
            ? (predictedMatch ? reg('[Votre|Ta] prédiction était juste : [vous entendez|tu entends] bien [votre|ta] propre voix.', register) : reg('[Votre|Ton] ressenti et l’outil divergent : [réécoutez|réécoute] le modèle puis [vous-même|toi-même].', register))
            : (predictedMatch ? 'Your prediction was right: you hear your own voice well.' : 'Your impression and the tool differ: listen to the model, then yourself.')}
        </p>
      )}
      {(stressWords.length > 0 || showMelody || vowelZ || result.issues.length > 1 || result.checks.length > 0) && !result.qc && (
        <details className="more">
          <summary>{lang === 'fr' ? 'Voir le détail' : 'See details'}</summary>
          <div className="stack" style={{ ['--stack' as string]: '14px', marginTop: 12 }}>
            {stressWords.map(({ w, st }) => {
              const syl = result.syllables[w]
              return ref.words[w] && ref.words[w].syl.length > 1 ? (
                <div key={w}>
                  <div className="label" style={{ marginBottom: 6 }}>{ref.words[w].w} — {lang === 'fr' ? reg('modèle (haut), [vous|toi] (bas)', register) : 'model (top), you (bottom)'}</div>
                  <Bubbles word={ref.words[w]} units={units} stress={st} learner={syl?.prom} perceived={syl?.perceived} />
                </div>
              ) : null
            })}
            {showMelody && (
              <Melody model={model} learner={{ f0: result.f0.map((x) => (Number.isNaN(x) ? null : x)) as number[], fps: 100 }}
                learnerSpan={result.words.length ? [result.words[0].t0, result.words[result.words.length - 1].t1] : undefined}
                words={ref.words.map((w) => w.w)} />
            )}
            {vowelZ && vowelTargets.length >= 2 && (
              <div className="center"><VowelMap targets={vowelTargets.slice(0, 3)} learner={{ z: vowelZ, label: lang === 'fr' ? 'vous' : 'you' }} lang={lang} /></div>
            )}
            {result.checks.length > 0 && (
              <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
                {result.checks.map((c, i) => (
                  <li key={i}>
                    <b>{ref.words[c.w]?.w}</b> · /{units[c.target] ?? '∅'}/ — {c.state === 'clear' ? t('st_clear') : c.state === 'unsure' ? t('st_unsure') : `${t('heard_as')} /${c.realized}/`}
                  </li>
                ))}
              </ul>
            )}
            <p className="small muted" style={{ margin: 0 }}>
              {lang === 'fr'
                ? reg('Indice calculé sur [votre|ton] appareil par un modèle de reconnaissance ; c’est une aide, pas un jugement. [Faites confiance à votre|Fais confiance à ton] oreille autant qu’à l’outil.', register)
                : 'This hint is computed on your device by a recognition model; it is a help, not a judgement. Trust your ear as much as the tool.'}
            </p>
          </div>
        </details>
      )}
    </div>
  )
}

function fichePairHint(target: Target, lang: 'fr' | 'en', register: 'vous' | 'tu') {
  const g = target.lesson.find((b) => b.type === 'gesture')
  return g ? pickBi({ fr: g.fr ?? '', en: g.en ?? '' }, lang, register) : ''
}

function genericHint(kind: string, lang: 'fr' | 'en', register: 'vous' | 'tu', vars: Record<string, string>) {
  const fr: Record<string, string> = {
    stress: 'La syllabe forte attendue est « {stressed} ». [Allongez-la|Allonge-la] et [faites|fais] bouger la voix dessus.',
    nucleus: 'Le mot fort attendu est « {nucleus} » : [faites|fais] un vrai mouvement de voix dessus.',
    tone: 'La mélodie finale ne correspond pas à l’intention. [Réécoutez|Réécoute] le modèle en suivant la courbe.',
    chunk: '[Regroupez|Regroupe] les mots qui vont ensemble et [marquez|marque] une petite pause entre les groupes.',
    segment: '[Réécoutez|Réécoute] le mot « {word} » et [comparez|compare] avec votre essai.',
    pair: '[Réécoutez|Réécoute] les deux mots.',
  }
  const en: Record<string, string> = {
    stress: "The expected strong syllable is '{stressed}'. Lengthen it and move your voice on it.",
    nucleus: "The expected key word is '{nucleus}': make a real pitch movement on it.",
    tone: 'The final melody does not match the intention. Listen to the model and follow the curve.',
    chunk: 'Group the words that belong together and pause briefly between groups.',
    segment: "Listen to '{word}' again and compare with your attempt.",
    pair: 'Listen to both words again.',
  }
  const raw = (lang === 'fr' ? fr : en)[kind] ?? (lang === 'fr' ? fr.segment : en.segment)
  return fill(reg(raw, register), vars)
}

/** Precise praise (task/process level, Hattie & Timperley) — never "bravo, vous êtes doué". */
function praise(_target: Target, r: FullResult, ref: import('../content/types').Ref, lang: 'fr' | 'en', register: 'vous' | 'tu') {
  const stressOk = r.issues.find((i) => i.kind === 'stress' && i.state === 'clear')
  if (stressOk) return lang === 'fr' ? `Accent sur « ${stressOk.vars.stressed.toUpperCase()} » dans « ${stressOk.vars.word} » : réussi.` : `Stress on '${stressOk.vars.stressed.toUpperCase()}' in '${stressOk.vars.word}': done.`
  const nuc = r.issues.find((i) => (i.kind === 'nucleus' || i.kind === 'tone') && i.state === 'clear')
  if (nuc) return lang === 'fr' ? `Mélodie claire : le relief tombe sur « ${nuc.vars.nucleus} ».` : `Clear melody: the peak lands on '${nuc.vars.nucleus}'.`
  const seg = r.checks.filter((c) => c.state === 'clear')
  if (seg.length) {
    const words = Array.from(new Set(seg.map((c) => ref.words[c.w]?.w))).slice(0, 3).join(', ')
    return lang === 'fr' ? reg(`Clair : on entend bien la cible dans « ${words} ».`, register) : `Clear: the target sound comes through in '${words}'.`
  }
  return lang === 'fr' ? reg('Clair et compris. [Passez|Passe] à la suite ou [refaites-le|refais-le] pour l’ancrer.', register) : 'Clear and understood. Move on, or do it again to make it stick.'
}
void pickBi
