import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useCourse, useTarget } from '../content/store'
import { useSettings } from '../data/settings'
import { allMastery } from '../learning/mastery'
import { dueCards, review } from '../learning/srs'
import { flightPlan, sessionPlan, type Activity } from '../learning/plan'
import { StepRunner, type StepSummary } from '../exercises/Blocks'
import { PerceptionItemView } from '../exercises/Perception'
import { ProductionItemView } from '../exercises/ProductionItem'
import { TopBar } from '../components/Nav'
import { Paper } from '../components/Paper'
import { pickBi, reg, useT } from '../i18n'
import { loadTarget } from '../content/loader'
import type { SrsCard } from '../data/db'
import type { Target } from '../content/types'
import { logSession, XP } from '../learning/xp'
import { IconArrowRight, IconCheck } from '../art/Icons'
import { Bird } from '../art/Bird'
import { sfx } from '../audio/sfx'
import { closeMic } from '../audio/recorder'

export default function Session() {
  const course = useCourse()
  const s = useSettings((st) => st.s)
  const nav = useNavigate()
  const t = useT()
  const [acts, setActs] = useState<Activity[] | null>(null)
  const [k, setK] = useState(0)
  const xp = useRef(0)
  const started = useRef(Date.now())
  const touched = useRef(new Set<string>())
  useEffect(() => {
    if (!course) return
    ;(async () => {
      const m = await allMastery()
      const plan = flightPlan(course, m, s.priorities, s.level)
      const due = await dueCards(Date.now(), 10)
      setActs(sessionPlan(plan, m, due, 12))
    })()
  }, [course]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => closeMic(), [])
  if (!acts) return <div className="main"><TopBar /><p>{t('loading')}</p></div>
  const act = acts[k]
  const next = (sum?: StepSummary) => {
    if (sum) xp.current += sum.xp
    if (act?.type === 'step') touched.current.add(act.targetId)
    sfx('page')
    setK((x) => x + 1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  return (
    <div className="main">
      <TopBar title={`${Math.min(k + 1, acts.length)} / ${acts.length}`} back="/" />
      {act?.type === 'review' && <ReviewBlock cards={act.cards} onDone={(x) => { xp.current += x; next() }} />}
      {act?.type === 'step' && <StepAct targetId={act.targetId} step={act.step} onFinish={next} />}
      {act?.type === 'reflect' && (
        <Reflect onDone={async (refl) => {
          await logSession({ minutes: (Date.now() - started.current) / 60000, xp: xp.current, targets: [...touched.current], reflection: refl })
          sfx('milestone')
          nav('/', { replace: true, state: { sessionDone: xp.current } })
        }} xp={xp.current} register={s.register} />
      )}
    </div>
  )
}

function StepAct({ targetId, step, onFinish }: { targetId: string; step: import('../learning/plan').Step; onFinish: (s: StepSummary) => void }) {
  const target = useTarget(targetId)
  if (!target) return <p>…</p>
  return <StepRunner key={targetId + step} target={target} step={step} onFinish={onFinish} />
}

function ReviewBlock({ cards, onDone }: { cards: SrsCard[]; onDone: (xp: number) => void }) {
  const s = useSettings((st) => st.s)
  const t = useT()
  const [targets, setTargets] = useState<Record<string, Target>>({})
  const [i, setI] = useState(0)
  const xp = useRef(0)
  useEffect(() => {
    const ids = Array.from(new Set(cards.map((c) => c.targetId)))
    Promise.all(ids.map((id) => loadTarget(id))).then((ts) => setTargets(Object.fromEntries(ts.map((x) => [x.id, x]))))
  }, [cards])
  const card = cards[i]
  const target = card ? targets[card.targetId] : undefined
  const item = useMemo(() => {
    if (!target || !card) return null
    return card.kind === 'perception' ? target.perception.items.find((x) => x.id === card.itemId) : [...target.production, ...target.guided].find((x) => x.id === card.itemId)
  }, [target, card])
  const advance = () => { if (i + 1 >= cards.length) onDone(xp.current); else setI(i + 1) }
  useEffect(() => { if (target && card && !item) advance() }, [target, card, item]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!card || !target || !item) return <p>…</p>
  const lang = s.instr === 'en' ? 'en' : 'fr'
  return (
    <div className="stack" style={{ ['--stack' as string]: '14px' }}>
      <div className="session-top">
        <span className="tape">{lang === 'fr' ? 'Échauffement' : 'Warm-up'}</span>
        <div className="bar"><span style={{ width: `${(i / cards.length) * 100}%` }} /></div>
        <span className="small muted">{pickBi(target.title, lang, s.register)}</span>
      </div>
      <p className="small muted" style={{ margin: 0 }}>{lang === 'fr' ? reg('On retrouve de mémoire ce qu’on a travaillé — c’est ce qui fixe l’acquis.', s.register) : 'Recall what you practised before — that is what makes it stick.'}</p>
      <Paper seed={card.itemId}>
        {card.kind === 'perception'
          ? <PerceptionItemView key={card.itemId} item={item as import('../content/types').PerceptionItem} target={target}
              onAnswer={(o) => { xp.current += XP.perception; void review(card.itemId, card.targetId, 'perception', o.ok ? 'good' : 'fail') }} onNext={advance} />
          : <ProductionItemView key={card.itemId} item={item as import('../content/types').ProductionItem} target={target} step="review"
              onDone={(o) => { xp.current += XP.production; void review(card.itemId, card.targetId, 'production', !o.judged ? 'unsure' : o.state === 'clear' ? 'good' : o.state === 'refine' ? 'hard' : 'fail') }} onNext={advance} />}
      </Paper>
      <div className="center"><button className="btn ghost small" onClick={advance}>{t('skip')}</button></div>
    </div>
  )
}

function Reflect({ onDone, xp, register }: { onDone: (r: { improved?: string; watch?: string }) => void; xp: number; register: 'vous' | 'tu' }) {
  const s = useSettings((st) => st.s)
  const lang = s.instr === 'en' ? 'en' : 'fr'
  const [improved, setImproved] = useState('')
  const [watch, setWatch] = useState('')
  return (
    <Paper tone="kraft" seed="reflect" tape={lang === 'fr' ? 'Clôture' : 'Wrap-up'}>
      <div className="stack" style={{ ['--stack' as string]: '14px' }}>
        <div className="row" style={{ alignItems: 'center' }}>
          <Bird pose="cheer" size={96} />
          <div>
            <h2 style={{ margin: 0 }}>{lang === 'fr' ? 'Séance terminée' : 'Session complete'}</h2>
            <p className="muted" style={{ margin: 0 }}>+{xp} {lang === 'fr' ? 'points d’effort' : 'effort points'}</p>
          </div>
        </div>
        <label className="stack" style={{ ['--stack' as string]: '6px' }}>
          <span style={{ fontWeight: 700 }}>{lang === 'fr' ? reg('Qu’[avez-vous|as-tu] amélioré aujourd’hui ?', register) : 'What did you improve today?'}</span>
          <input type="text" value={improved} onChange={(e) => setImproved(e.target.value)} placeholder={lang === 'fr' ? 'ex. mon /h/ dans « hair »' : "e.g. my /h/ in 'hair'"} />
        </label>
        <label className="stack" style={{ ['--stack' as string]: '6px' }}>
          <span style={{ fontWeight: 700 }}>{lang === 'fr' ? reg('Que [surveillerez-vous|surveilleras-tu] demain ?', register) : 'What will you watch out for tomorrow?'}</span>
          <input type="text" value={watch} onChange={(e) => setWatch(e.target.value)} placeholder={lang === 'fr' ? 'ex. allonger la syllabe forte' : 'e.g. lengthen the strong syllable'} />
        </label>
        <button className="btn primary block" onClick={() => onDone({ improved, watch })}><IconCheck width={20} height={20} /> {lang === 'fr' ? 'Enregistrer et terminer' : 'Save and finish'} <IconArrowRight width={20} height={20} /></button>
      </div>
    </Paper>
  )
}
