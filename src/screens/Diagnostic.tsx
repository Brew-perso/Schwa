import { useMemo, useRef, useState } from 'react'
import { useCourse } from '../content/store'
import { useSettings } from '../data/settings'
import { reg, pickBi } from '../i18n'
import { playKey } from '../audio/player'
import { sfx } from '../audio/sfx'
import { RecordButton } from '../components/RecordButton'
import { AudioButton } from '../components/AudioButton'
import { Paper } from '../components/Paper'
import { IconPlay, IconArrowRight } from '../art/Icons'
import { engine } from '../engine/client'
import type { Recording } from '../audio/recorder'
import { analyseDiagnostic, type DiagEvidence, type DiagResult } from '../learning/diagnostic'
import { db } from '../data/db'
import { toWav } from '../audio/dsp'
import { Planet } from '../art/Planet'
import { Bird } from '../art/Bird'

type Phase = 'intro' | 'perception' | 'stress' | 'reading' | 'free' | 'result'

/** Ice-breaker diagnostic (5–8 min), presented as getting to know the learner — never as an exam. */
export function DiagnosticFlow({ onDone }: { onDone: () => void }) {
  const course = useCourse()
  const { s, set } = useSettings()
  const L = (a: string, b: string) => (s.instr !== 'en' ? reg(a, s.register) : b)
  const [phase, setPhase] = useState<Phase>('intro')
  const [k, setK] = useState(0)
  const [busy, setBusy] = useState(false)
  const [picked, setPicked] = useState<number | null>(null)
  const [result, setResult] = useState<DiagResult | null>(null)
  const ev = useRef<DiagEvidence>({ perception: [], stress: [], reading: [] })
  const v = s.variety
  const d = course?.diagnostic
  const answer = useMemo(() => Math.round(Math.random()), [k, phase]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!course || !d) return null
  const next = (n: number, after: Phase) => { setPicked(null); if (k + 1 < n) setK(k + 1); else { setK(0); setPhase(after) } }
  const finish = () => {
    const r = analyseDiagnostic(course, ev.current, s.level)
    setResult(r)
    set({ priorities: r.priorities, phono: r.phono })
    setPhase('result')
  }
  const lang = s.instr === 'en' ? 'en' : 'fr'
  return (
    <div className="stack" style={{ ['--stack' as string]: '16px' }}>
      {phase === 'intro' && (
        <Paper seed="diag-intro" tone="kraft" tape={L('Brise-glace', 'Ice-breaker')}>
          <div className="stack" style={{ ['--stack' as string]: '12px' }}>
            <h2 style={{ margin: 0 }}>{L('Quelques minutes pour régler [votre|ton] parcours', 'A few minutes to set up your course')}</h2>
            <p style={{ margin: 0 }}>{L('[Vous allez|Tu vas] écouter quelques mots, repérer des syllabes fortes, lire cinq phrases, puis (si [vous le souhaitez|tu le souhaites]) parler librement 30 secondes. Ce n’est pas une évaluation : cela sert seulement à choisir par où commencer. [Vos|Tes] priorités seront réajustées en continu.', 'You’ll listen to a few words, spot strong syllables, read five sentences, then (if you wish) speak freely for 30 seconds. It is not an assessment: it only helps choose where to start. Your priorities will keep adjusting.')}</p>
            <button className="btn primary" onClick={() => { void engine.init().catch(() => {}); setPhase('perception') }}>{L('C’est parti', 'Let’s go')} <IconArrowRight width={20} height={20} /></button>
          </div>
        </Paper>
      )}
      {phase === 'perception' && (() => {
        const it = d.perception[k]
        const opt = it.options[answer]
        const au = opt.audio[v]?.[0] ?? opt.audio[v === 'GA' ? 'SBE' : 'GA'][0]
        return (
          <Paper seed={'dp' + k} tape={`${L('Écouter', 'Listen')} · ${k + 1}/${d.perception.length}`}>
            <div className="stack center" style={{ ['--stack' as string]: '14px' }}>
              <p className="label" style={{ margin: 0 }}>{L('Quel mot [entendez-vous|entends-tu] ?', 'Which word do you hear?')}</p>
              <button className="audio-btn" style={{ width: 76, height: 76, margin: '0 auto' }} onClick={() => void playKey(au.f)} aria-label={L('Écouter', 'Listen')}><IconPlay /></button>
              <div className="tiles">
                {it.options.map((o, i) => (
                  <button key={i} className={`tile ${picked !== null ? (i === answer ? 'is-right' : i === picked ? 'is-wrong' : '') : ''}`} disabled={picked !== null}
                    onClick={() => { setPicked(i); sfx(i === answer ? 'right' : 'miss'); ev.current.perception.push({ target: it.target, ok: i === answer }) }}>{o.text}</button>
                ))}
              </div>
              {picked !== null && <button className="btn primary" onClick={() => next(d.perception.length, 'stress')}>{L('Suivant', 'Next')} <IconArrowRight width={20} height={20} /></button>}
            </div>
          </Paper>
        )
      })()}
      {phase === 'stress' && (() => {
        const it = d.stress[k]
        const w = it.ref[v].words[0]
        const au = it.audio[v]?.[0]
        return (
          <Paper seed={'ds' + k} tape={`${L('Syllabe forte', 'Strong syllable')} · ${k + 1}/${d.stress.length}`}>
            <div className="stack center" style={{ ['--stack' as string]: '14px' }}>
              <p className="label" style={{ margin: 0 }}>{L('Où est la syllabe la plus forte ?', 'Where is the strongest syllable?')}</p>
              <button className="audio-btn" style={{ width: 76, height: 76, margin: '0 auto' }} onClick={() => au && void playKey(au.f)} aria-label={L('Écouter', 'Listen')}><IconPlay /></button>
              <div className="row" style={{ justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
                {w.syl.map((sy, i) => (
                  <button key={i} className={`tile ${picked !== null ? (i === it.stress ? 'is-right' : i === picked ? 'is-wrong' : '') : ''}`} disabled={picked !== null}
                    style={{ minWidth: 86, minHeight: 72, fontSize: '1.4rem', flex: '0 0 auto' }}
                    onClick={() => { setPicked(i); sfx(i === it.stress ? 'right' : 'miss'); ev.current.stress.push({ target: it.target, ok: i === it.stress }) }}>
                    {picked !== null && i === it.stress ? sy.l.toUpperCase() : sy.l}
                  </button>
                ))}
              </div>
              {picked !== null && <button className="btn primary" onClick={() => next(d.stress.length, 'reading')}>{L('Suivant', 'Next')} <IconArrowRight width={20} height={20} /></button>}
            </div>
          </Paper>
        )
      })()}
      {phase === 'reading' && (() => {
        const it = d.reading[k]
        const onRec = async (r: Recording) => {
          setBusy(true)
          try {
            const res = await engine.evaluate({ audio: r.audio16k, ref: it.ref[v], checks: it.checks[v], expect: { tone: it.text.endsWith('.') ? 'fall' : undefined }, level: s.level, transcribe: false })
            const issues = res.checks.map((c) => ({ target: it.checks[v].find((x) => x.w === c.w && x.p === c.p)?.target, kind: 'segment', state: c.state }))
            for (const is of res.issues) if (is.kind === 'tone') issues.push({ target: 'b2-final-fall', kind: 'tone', state: is.state })
            ev.current.reading.push({ targets: it.checks_targets, issues })
            if (k === 0) await db.portfolio.add({ ts: Date.now(), kind: 'J0', label: L('Mon premier enregistrement', 'My first recording'), text: it.text, audio: toWav(r.audio16k, 16000), duration: r.durationMs / 1000 })
          } catch { ev.current.reading.push({ targets: it.checks_targets, issues: [] }) }
          setBusy(false)
          next(d.reading.length, 'free')
        }
        return (
          <Paper seed={'dr' + k} tape={`${L('Lire', 'Read')} · ${k + 1}/${d.reading.length}`}>
            <div className="stack center" style={{ ['--stack' as string]: '14px' }}>
              <p className="small muted" style={{ margin: 0 }}>{L('[Lisez|Lis] la phrase à voix haute, naturellement. [Vous pouvez|Tu peux] écouter le modèle après.', 'Read the sentence aloud, naturally. You can listen to the model afterwards.')}</p>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', margin: 0 }}>{it.text}</p>
              <RecordButton key={k} onRecorded={onRec} busy={busy} />
              <AudioButton audio={it.audio[v].m[0]} size="sm" label={L('Écouter le modèle', 'Listen to the model')} />
            </div>
          </Paper>
        )
      })()}
      {phase === 'free' && (
        <Paper seed="df" tape={L('Parler librement (facultatif)', 'Speak freely (optional)')} tapeTone="coral">
          <div className="stack center" style={{ ['--stack' as string]: '14px' }}>
            <p style={{ margin: 0 }}>{pickBi(d.free.prompt, lang, s.register)}</p>
            <RecordButton maxMs={45000} silenceMs={2200} busy={busy} onRecorded={async (r) => {
              setBusy(true)
              await db.portfolio.add({ ts: Date.now(), kind: 'J0', label: L('Présentation — jour 1', 'Introduction — day 1'), audio: toWav(r.audio16k, 16000), duration: r.durationMs / 1000, transcript: await engine.transcribe(r.audio16k).catch(() => undefined) })
              setBusy(false)
              finish()
            }} />
            <button className="btn ghost small" onClick={finish}>{L('Passer', 'Skip')}</button>
          </div>
        </Paper>
      )}
      {phase === 'result' && result && (
        <Paper seed="dres" tone="card" tape={L('[Votre|Ton] plan de vol', 'Your flight plan')} tapeTone="teal">
          <div className="stack" style={{ ['--stack' as string]: '14px' }}>
            <div className="row"><Bird pose="fly" size={96} /><p style={{ margin: 0, fontWeight: 600 }}>{L('Merci ! Voici par où nous allons commencer — les cibles qui comptent le plus pour être compris facilement.', 'Thank you! Here is where we’ll start — the targets that matter most for being understood easily.')}</p></div>
            <div className="stack" style={{ ['--stack' as string]: '10px' }}>
              {result.priorities.map((id, i) => {
                const t = course.targets.find((x) => x.id === id)!
                return (
                  <div key={id} className="row">
                    <Planet id={t.id} color={t.planet.color} motif={t.planet.motif} size={48} />
                    <div><div style={{ fontWeight: 700 }}>{i + 1}. {pickBi(t.title, lang, s.register)}</div><div className="small muted">{pickBi(t.tagline, lang, s.register)}</div></div>
                  </div>
                )
              })}
            </div>
            <p className="small muted" style={{ margin: 0 }}>{L('Ce plan n’est jamais figé : si [vous progressez|tu progresses] plus vite, il s’ajuste tout seul. Et toute la carte du ciel reste ouverte.', 'This plan is never fixed: if you progress faster, it adjusts. And the whole sky map stays open.')}</p>
            <button className="btn primary big" onClick={onDone}>{L('C’est parti', 'Let’s go')} <IconArrowRight width={22} height={22} /></button>
          </div>
        </Paper>
      )}
    </div>
  )
}
