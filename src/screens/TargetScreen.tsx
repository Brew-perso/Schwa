import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useTarget } from '../content/store'
import { useSettings, instrFor } from '../data/settings'
import { getMastery, evidenceLevel } from '../learning/mastery'
import { nextStep, type Step } from '../learning/plan'
import { pickBi, useT } from '../i18n'
import type { Mastery } from '../data/db'
import { TopBar } from '../components/Nav'
import { Planet } from '../art/Planet'
import { Paper } from '../components/Paper'
import { StepRunner } from '../exercises/Blocks'
import { IconArrowRight, IconBook, IconEar, IconMic, IconSpeech, IconTarget } from '../art/Icons'
import { closeMic } from '../audio/recorder'

const STEPS: { step: Step; icon: React.ReactNode; fr: string; en: string; subFr: string; subEn: string }[] = [
  { step: 'discover', icon: <IconBook />, fr: 'Découvrir', en: 'Discover', subFr: 'Micro-leçon de 90 secondes : pourquoi, le geste, la règle', subEn: '90-second micro-lesson: why, the gesture, the rule' },
  { step: 'hear', icon: <IconEar />, fr: 'Entendre', en: 'Hear', subFr: 'Reconnaître la cible dans plusieurs voix et accents', subEn: 'Recognise the target across voices and accents' },
  { step: 'produce', icon: <IconMic />, fr: 'Produire', en: 'Produce', subFr: 'Mots et paires « faites-vous comprendre »', subEn: 'Words and "make yourself understood" pairs' },
  { step: 'guided', icon: <IconTarget />, fr: 'En contexte', en: 'In context', subFr: 'Garder la cible quand le sens occupe l’attention', subEn: 'Keep the target while focusing on meaning' },
  { step: 'transfer', icon: <IconSpeech />, fr: 'Parler librement', en: 'Speak freely', subFr: 'Une mini-tâche de parole spontanée', subEn: 'A short spontaneous-speech task' },
]

const RUNGS = [
  { k: 'N1', fr: 'Je l’entends', en: 'I hear it' }, { k: 'N2', fr: 'Je sais le faire', en: 'I can do it' },
  { k: 'N3', fr: 'En parlant', en: 'While speaking' }, { k: 'N4', fr: 'Automatique', en: 'Automatic' }, { k: 'N5', fr: 'Durable', en: 'Lasting' },
]

export default function TargetScreen() {
  const { id, step } = useParams()
  const target = useTarget(id)
  const s = useSettings((st) => st.s)
  const t = useT()
  const nav = useNavigate()
  const [m, setM] = useState<Mastery | null>(null)
  useEffect(() => { if (id) void getMastery(id).then(setM) }, [id, step])
  useEffect(() => () => closeMic(), [])
  if (!target) return <div className="main"><TopBar back="/map" /><p>{t('loading')}</p></div>
  const lang = instrFor(s, target.level) === 'en' ? 'en' : 'fr'
  if (step) {
    return (
      <div className="main">
        <TopBar back={`/target/${target.id}`} title={pickBi(target.title, lang, s.register)} />
        <StepRunner key={step} target={target} step={step as Step} onFinish={() => nav(`/target/${target.id}`, { replace: true })} />
      </div>
    )
  }
  const lvl = evidenceLevel(m ?? undefined)
  const now = nextStep(m ?? undefined)
  const doneMap: Record<Step, boolean> = { discover: !!m?.lessonSeen, hear: !!m?.n1, produce: !!m?.n2, guided: !!m?.n3, transfer: !!m?.n4 }
  return (
    <div className="main stack" style={{ ['--stack' as string]: '18px' }}>
      <TopBar back="/map" title={`${target.level} · ${lang === 'fr' ? 'cible' : 'target'}`} />
      <div className="target-hero">
        <Planet id={target.id} color={target.planet.color} motif={target.planet.motif} size={112} state={lvl >= 4 ? 'mastered' : 'progress'} progress={lvl / 5} />
        <div>
          <h1 style={{ marginBottom: 4 }}>{pickBi(target.title, lang, s.register)}</h1>
          <p className="italic-display" style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-2)' }}>{pickBi(target.tagline, lang, s.register)}</p>
        </div>
      </div>
      <Paper seed={target.id + 'why'} tone="kraft" tape={lang === 'fr' ? 'Pourquoi ça compte' : 'Why it matters'}>
        <p style={{ margin: 0 }}>{pickBi(target.why, lang, s.register)}</p>
      </Paper>
      <Paper seed={target.id + 'crit'} tape={lang === 'fr' ? 'Critère de réussite' : 'Success criterion'} tapeTone="teal">
        <p style={{ margin: 0, fontWeight: 600 }}>{pickBi(target.criterion, lang, s.register)}</p>
      </Paper>
      <div>
        <div className="label" style={{ marginBottom: 8 }}>{lang === 'fr' ? 'Niveaux de preuve' : 'Evidence levels'}</div>
        <div className="ladder">
          {RUNGS.map((r, i) => <div key={r.k} className={`rung ${i < lvl ? 'done' : ''} ${i === 3 ? 'human' : ''}`}><b>{r.k}</b>{lang === 'fr' ? r.fr : r.en}</div>)}
        </div>
      </div>
      <div className="step-list">
        {STEPS.map((x, i) => (
          <button key={x.step} className={`step-row ${doneMap[x.step] ? 'done' : ''} ${now === x.step ? 'now' : ''}`} onClick={() => nav(`/target/${target.id}/${x.step}`)}>
            <span className="num">{i + 1}</span>
            <span>
              <span style={{ display: 'block', fontWeight: 700 }}>{lang === 'fr' ? x.fr : x.en}</span>
              <span className="small muted">{lang === 'fr' ? x.subFr : x.subEn}</span>
            </span>
            <IconArrowRight width={20} height={20} />
          </button>
        ))}
      </div>
    </div>
  )
}
