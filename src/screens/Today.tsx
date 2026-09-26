import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { useCourse } from '../content/store'
import { useSettings } from '../data/settings'
import { allMastery, evidenceLevel } from '../learning/mastery'
import { currentTarget, flightPlan, nextStep } from '../learning/plan'
import { dueCount } from '../learning/srs'
import { weekStats, weeklyStreak } from '../learning/xp'
import { pickBi, reg, useT } from '../i18n'
import type { Mastery } from '../data/db'
import type { TargetSummary } from '../content/types'
import { StarChart } from '../art/StarChart'
import { Planet } from '../art/Planet'
import { Logo } from '../art/Logo'
import { Paper } from '../components/Paper'
import { IconArrowRight, IconBook, IconEar, IconMic, IconRepeat, IconSpeech } from '../art/Icons'
import { Swallow } from '../art/Swallow'

const STEP_LABEL = {
  discover: { fr: 'Découvrir', en: 'Discover' }, hear: { fr: 'Entendre', en: 'Hear' }, produce: { fr: 'Produire', en: 'Produce' },
  guided: { fr: 'En contexte', en: 'In context' }, transfer: { fr: 'Parler librement', en: 'Speak freely' },
}

export default function Today() {
  const course = useCourse()
  const s = useSettings((st) => st.s)
  const t = useT()
  const loc = useLocation()
  const [m, setM] = useState<Record<string, Mastery>>({})
  const [due, setDue] = useState(0)
  const [week, setWeek] = useState({ sessions: 0, minutes: 0, xp: 0 })
  const [streak, setStreak] = useState(0)
  useEffect(() => {
    void allMastery().then(setM)
    void dueCount().then(setDue)
    void weekStats().then(setWeek)
    void weeklyStreak(s.weeklyGoal).then(setStreak)
  }, [s.weeklyGoal, loc.key])
  if (!course) return <div className="main"><p>{t('loading')}</p></div>
  const lang = s.instr === 'en' ? 'en' : 'fr'
  const plan = flightPlan(course, m, s.priorities, s.level)
  const cur = currentTarget(plan, m)
  const step = cur ? nextStep(m[cur.id]) : null
  const hour = new Date().getHours()
  const hello = lang === 'fr' ? (hour < 5 ? 'Bonsoir' : hour < 18 ? 'Bonjour' : 'Bonsoir') : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const msg = course.messages[(new Date().getDate()) % course.messages.length]
  const pct = Math.min(1, week.sessions / s.weeklyGoal)
  const justDone = (loc.state as { sessionDone?: number } | null)?.sessionDone
  return (
    <div className="main stack" style={{ ['--stack' as string]: '18px' }}>
      <div className="spread" style={{ paddingTop: 4 }}>
        <Logo size={34} />
        <WeekRing pct={pct} label={`${week.sessions}/${s.weeklyGoal}`} title={t('week_goal')} />
      </div>
      <section className="hero">
        <StarChart night className="starchart" seed={11} />
        <div style={{ position: 'relative' }}>
          <div className="label" style={{ color: 'var(--star)' }}>{new Date().toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          <h1 style={{ margin: '6px 0 10px' }}>{hello}{s.name ? `, ${s.name}` : ''}.</h1>
          {justDone !== undefined
            ? <p style={{ maxWidth: '34ch', color: '#e2d8c2' }}>{lang === 'fr' ? reg(`Séance enregistrée (+${justDone} points d’effort). [Revenez|Reviens] demain : c’est la régularité qui fait progresser.`, s.register) : `Session saved (+${justDone} effort points). Come back tomorrow: regularity is what builds skill.`}</p>
            : <p style={{ maxWidth: '36ch', color: '#e2d8c2' }}>{pickBi(msg, lang, s.register)}</p>}
          <Link to="/session" className="btn primary big" style={{ marginTop: 6 }}>
            {lang === 'fr' ? 'Commencer la séance' : 'Start today’s session'} <IconArrowRight width={22} height={22} />
          </Link>
          <p className="small" style={{ color: '#b9b3a6', marginTop: 10, marginBottom: 0 }}>{lang === 'fr' ? '10 à 15 minutes · casque conseillé' : '10–15 minutes · headphones recommended'}</p>
        </div>
      </section>

      <Paper seed="plan" tape={lang === 'fr' ? 'Au programme' : 'On the plan'}>
        <div className="plan-list">
          {due > 0 && <PlanRow icon={<IconRepeat />} title={lang === 'fr' ? `Échauffement : ${Math.min(due, 8)} rappel${due > 1 ? 's' : ''}` : `Warm-up: ${Math.min(due, 8)} recall item${due > 1 ? 's' : ''}`} sub={lang === 'fr' ? 'Répétition espacée, sons mélangés' : 'Spaced repetition, interleaved sounds'} />}
          {cur && step && (
            <PlanRow icon={step === 'discover' ? <IconBook /> : step === 'hear' ? <IconEar /> : step === 'transfer' ? <IconSpeech /> : <IconMic />}
              title={`${pickBi(STEP_LABEL[step], lang, s.register)} · ${pickBi(cur.title, lang, s.register)}`} sub={pickBi(cur.criterion, lang, s.register)} planet={cur} />
          )}
          {!cur && <PlanRow icon={<IconSpeech />} title={lang === 'fr' ? 'Tout le ciel est exploré !' : 'The whole sky is explored!'} sub={lang === 'fr' ? 'Place aux révisions et à la parole libre.' : 'Time for reviews and free speech.'} />}
        </div>
      </Paper>

      <div className="grid-2">
        <Paper seed="orbit" tone="kraft">
          <div className="label">{lang === 'fr' ? 'Mes priorités' : 'My priorities'}</div>
          <div className="stack" style={{ ['--stack' as string]: '8px', marginTop: 8 }}>
            {plan.slice(0, 3).map((tg) => (
              <Link key={tg.id} to={`/target/${tg.id}`} className="row" style={{ textDecoration: 'none', color: 'inherit' }}>
                <Planet id={tg.id} color={tg.planet.color} motif={tg.planet.motif} size={40} state={evidenceLevel(m[tg.id]) >= 4 ? 'mastered' : 'progress'} progress={evidenceLevel(m[tg.id]) / 5} />
                <span style={{ fontWeight: 700 }}>{pickBi(tg.title, lang, s.register)}</span>
              </Link>
            ))}
          </div>
        </Paper>
        <Paper seed="week" tone="card">
          <div className="label">{lang === 'fr' ? 'Cette semaine' : 'This week'}</div>
          <p style={{ margin: '8px 0 4px', fontSize: '1.05rem' }}>
            <b>{week.sessions}</b> {lang === 'fr' ? 'séance(s)' : 'session(s)'} · <b>{week.minutes}</b> min · <b>{week.xp}</b> {lang === 'fr' ? 'pts' : 'pts'}
          </p>
          <p className="small muted" style={{ margin: 0 }}>
            {streak > 0
              ? (lang === 'fr' ? `${streak} semaine${streak > 1 ? 's' : ''} d’affilée à votre objectif. Les jours de repos comptent aussi.` : `${streak} week${streak > 1 ? 's' : ''} in a row at your goal. Rest days count too.`)
              : (lang === 'fr' ? reg(`Objectif : ${s.weeklyGoal} séances cette semaine, au rythme qui [vous|te] convient.`, s.register) : `Goal: ${s.weeklyGoal} sessions this week, at your own pace.`)}
          </p>
        </Paper>
      </div>
      <div className="center" style={{ opacity: 0.9 }}><Swallow pose="fly" size={140} /></div>
    </div>
  )
}

function PlanRow({ icon, title, sub, planet }: { icon: React.ReactNode; title: string; sub: string; planet?: TargetSummary }) {
  return (
    <div className="plan-item">
      <span className="dot">{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700 }}>{title}</div>
        <div className="small muted">{sub}</div>
      </div>
      {planet && <Planet id={planet.id} color={planet.planet.color} motif={planet.planet.motif} size={46} />}
    </div>
  )
}

function WeekRing({ pct, label, title }: { pct: number; label: string; title: string }) {
  const r = 18, c = 2 * Math.PI * r
  return (
    <div className="row" title={title} aria-label={`${title} ${label}`} style={{ gap: 8 }}>
      <svg width="46" height="46" viewBox="0 0 46 46" className="ring">
        <circle cx="23" cy="23" r={r} fill="none" stroke="var(--paper-3)" strokeWidth="5" />
        <circle cx="23" cy="23" r={r} fill="none" stroke="var(--teal)" strokeWidth="5" strokeDasharray={`${pct * c} ${c}`} strokeLinecap="round" />
      </svg>
      <span style={{ fontWeight: 800 }}>{label}</span>
    </div>
  )
}
