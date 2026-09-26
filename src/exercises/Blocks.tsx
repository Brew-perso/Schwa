import { useEffect, useMemo, useRef, useState } from 'react'
import type { PerceptionItem, ProductionItem, Target } from '../content/types'
import { useSettings, instrFor } from '../data/settings'
import { pickBi, reg, useT } from '../i18n'
import { PerceptionItemView } from './Perception'
import { ProductionItemView } from './ProductionItem'
import { LessonPlayer } from './Lesson'
import { TransferTask } from './Transfer'
import { markOpened, recordGuidedBlock, recordPerceptionBlock, recordProductionBlock, recordTransfer, type NLevel } from '../learning/mastery'
import { review } from '../learning/srs'
import { XP } from '../learning/xp'
import type { Step } from '../learning/plan'
import { Paper } from '../components/Paper'
import { IconArrowRight, IconInfo } from '../art/Icons'
import { sfx } from '../audio/sfx'
import { Bird } from '../art/Bird'
import { engine } from '../engine/client'

export interface StepSummary { xp: number; newLevel: NLevel | null; done: boolean; stats?: { ok: number; n: number } }

function shuffle<T>(a: T[]): T[] {
  const b = a.slice()
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]] }
  return b
}

export function StepRunner({ target, step, onFinish }: { target: Target; step: Step; onFinish: (s: StepSummary) => void }) {
  useEffect(() => { void markOpened(target.id) }, [target.id])
  useEffect(() => { if (step === 'produce' || step === 'guided' || step === 'transfer') void engine.init().catch(() => {}) }, [step])
  if (step === 'discover') return <LessonPlayer target={target} onDone={async () => { await markOpened(target.id, true); onFinish({ xp: XP.lesson, newLevel: null, done: true }) }} />
  if (step === 'hear') return <PerceptionBlock target={target} onFinish={onFinish} />
  if (step === 'produce') return <ProductionBlock target={target} items={pickProduction(target)} mode="produce" onFinish={onFinish} />
  if (step === 'guided') return <ProductionBlock target={target} items={pickGuided(target)} mode="guided" onFinish={onFinish} />
  return <TransferTask target={target} onDone={async (v) => {
    let newLevel: NLevel | null = null
    if (v) newLevel = (await recordTransfer(target.id, v)).newLevel
    onFinish({ xp: XP.transfer, newLevel, done: true })
  }} />
}

function pickProduction(t: Target): ProductionItem[] {
  const pairs = t.production.filter((p) => p.type === 'pair')
  const says = t.production.filter((p) => p.type !== 'pair')
  const words = says.filter((p) => (p.text ?? '').split(/\s+/).length <= 2)
  const sentences = says.filter((p) => (p.text ?? '').split(/\s+/).length > 2)
  const sel = [...shuffle(pairs).slice(0, 2), ...shuffle(words).slice(0, pairs.length ? 2 : 4), ...shuffle(sentences).slice(0, 2)]
  return sel.length ? sel.slice(0, 6) : shuffle(t.production).slice(0, 6)
}

function pickGuided(t: Target): ProductionItem[] {
  const g = shuffle(t.guided).slice(0, 3)
  const extra = shuffle(t.production.filter((p) => p.type === 'say' && (p.text ?? '').split(/\s+/).length > 3)).slice(0, Math.max(0, 3 - g.length))
  return [...g, ...extra]
}

export function PerceptionBlock({ target, onFinish, n = 12 }: { target: Target; onFinish: (s: StepSummary) => void; n?: number }) {
  const s = useSettings((st) => st.s)
  const t = useT()
  const lang = instrFor(s, target.level) === 'en' ? 'en' : 'fr'
  const queue = useMemo(() => {
    const items = target.perception.items
    const out: PerceptionItem[] = []
    while (out.length < n && items.length) out.push(...shuffle(items))
    return out.slice(0, Math.min(n, Math.max(items.length, n)))
  }, [target, n])
  const [i, setI] = useState(0)
  const [ok, setOk] = useState(0)
  const [answered, setAnswered] = useState(0)
  const [summary, setSummary] = useState<StepSummary | null>(null)
  const missed = useRef<PerceptionItem[]>([])
  const item = queue[i]
  const finish = async () => {
    const r = await recordPerceptionBlock(target.id, ok, answered, true)
    for (const m of missed.current.slice(0, 4)) await review(m.id, target.id, 'perception', 'fail')
    const sm = { xp: answered * XP.perception, newLevel: r.newLevel, done: true, stats: { ok, n: answered } }
    if (r.newLevel) sfx('milestone')
    setSummary(sm)
  }
  if (summary) return <BlockSummary target={target} summary={summary} kind="hear" onContinue={() => onFinish(summary)} />
  if (!item) return null
  return (
    <div className="stack" style={{ ['--stack' as string]: '14px' }}>
      <BlockHeader target={target} i={i} n={queue.length} label={lang === 'fr' ? 'Entendre' : 'Hear'} />
      <Paper seed={item.id} tone="card">
        <PerceptionItemView key={item.id + i} item={item} target={target}
          onAnswer={(o) => { setAnswered((a) => a + 1); if (o.ok) setOk((x) => x + 1); else missed.current.push(item) }}
          onNext={() => { if (i + 1 >= queue.length) void finish(); else setI(i + 1) }} />
      </Paper>
      <p className="small muted center">{lang === 'fr' ? reg('Plusieurs voix, plusieurs accents : si c’est plus difficile, c’est normal — c’est ce qui fixe l’acquis.', s.register) : 'Several voices and accents: if it feels harder, that’s normal — it’s what makes learning stick.'}</p>
      <div className="center"><button className="btn ghost small" onClick={() => void finish()}>{t('finish')}</button></div>
    </div>
  )
}

export function ProductionBlock({ target, items, mode, onFinish }: { target: Target; items: ProductionItem[]; mode: 'produce' | 'guided'; onFinish: (s: StepSummary) => void }) {
  const s = useSettings((st) => st.s)
  const t = useT()
  const lang = instrFor(s, target.level) === 'en' ? 'en' : 'fr'
  const [i, setI] = useState(0)
  const [clear, setClear] = useState(0)
  const [judged, setJudged] = useState(0)
  const [attempts, setAttempts] = useState(0)
  const [summary, setSummary] = useState<StepSummary | null>(null)
  const item = items[i]
  const finish = async () => {
    const r = mode === 'produce' ? await recordProductionBlock(target.id, clear, judged) : await recordGuidedBlock(target.id, clear, judged)
    const sm = { xp: attempts * XP.production, newLevel: r.newLevel, done: true, stats: { ok: clear, n: judged } }
    if (r.newLevel) sfx('milestone')
    setSummary(sm)
  }
  if (summary) return <BlockSummary target={target} summary={summary} kind={mode} onContinue={() => onFinish(summary)} />
  if (!item) return <BlockSummary target={target} summary={{ xp: 0, newLevel: null, done: true }} kind={mode} onContinue={() => onFinish({ xp: 0, newLevel: null, done: true })} />
  return (
    <div className="stack" style={{ ['--stack' as string]: '14px' }}>
      <BlockHeader target={target} i={i} n={items.length} label={mode === 'produce' ? (lang === 'fr' ? 'Produire' : 'Produce') : (lang === 'fr' ? 'En contexte' : 'In context')} />
      <Paper seed={item.id} tone="card">
        <ProductionItemView key={item.id} item={item} target={target} step={mode} showCriterion={i === 0}
          onDone={(o) => {
            setAttempts((a) => a + 1)
            if (o.judged) { setJudged((j) => j + 1); if (o.ok) setClear((c) => c + 1) }
            void review(item.id, target.id, 'production', !o.judged ? 'unsure' : o.state === 'clear' ? 'good' : o.state === 'refine' ? 'hard' : 'fail')
          }}
          onNext={() => { if (i + 1 >= items.length) void finish(); else setI(i + 1) }} />
      </Paper>
      <div className="center"><button className="btn ghost small" onClick={() => void finish()}>{t('finish')}</button></div>
    </div>
  )
}

function BlockHeader({ target, i, n, label }: { target: Target; i: number; n: number; label: string }) {
  const s = useSettings((st) => st.s)
  const lang = instrFor(s, target.level) === 'en' ? 'en' : 'fr'
  return (
    <div className="session-top">
      <span className="tape teal">{label}</span>
      <div className="bar" aria-label={`${i + 1}/${n}`}><span style={{ width: `${((i) / n) * 100}%` }} /></div>
      <span className="small muted">{pickBi(target.title, lang, s.register)}</span>
    </div>
  )
}

const LEVEL_TEXT: Record<NLevel, { fr: string; en: string }> = {
  N1: { fr: '« Je l’entends »', en: '"I can hear it"' },
  N2: { fr: '« Je sais le faire »', en: '"I can do it"' },
  N3: { fr: '« Je le fais en parlant »', en: '"I do it while speaking"' },
  N4: { fr: '« C’est automatique » (à confirmer par un humain)', en: '"It’s automatic" (to be confirmed by a person)' },
  N5: { fr: '« Acquis durable »', en: '"Lasting skill"' },
}

export function BlockSummary({ target, summary, kind, onContinue }: { target: Target; summary: StepSummary; kind: 'hear' | 'produce' | 'guided'; onContinue: () => void }) {
  const s = useSettings((st) => st.s)
  const t = useT()
  const lang = instrFor(s, target.level) === 'en' ? 'en' : 'fr'
  const st = summary.stats
  const need = kind === 'hear' ? (lang === 'fr' ? 'Critère : 85 % sur des voix nouvelles.' : 'Criterion: 85 % on new voices.') : kind === 'produce' ? (lang === 'fr' ? 'Critère : 80 % « clair », lors de deux séances différentes.' : 'Criterion: 80 % "clear", in two separate sessions.') : (lang === 'fr' ? 'Critère : 80 % « clair » en phrase.' : 'Criterion: 80 % "clear" in sentences.')
  return (
    <Paper tone={summary.newLevel ? 'mint' : 'card'} seed={target.id + kind} tape={lang === 'fr' ? 'Bilan' : 'Wrap-up'}>
      <div className="stack center" style={{ ['--stack' as string]: '12px' }}>
        {summary.newLevel ? <Bird pose="fly" size={130} /> : <Bird pose="perch" size={110} />}
        {summary.newLevel && (
          <h2 className="pop-in" style={{ margin: 0 }}>{summary.newLevel} — {pickBi(LEVEL_TEXT[summary.newLevel], lang, s.register)}</h2>
        )}
        {st && st.n > 0 && (
          <p style={{ fontSize: '1.15rem', margin: 0 }}>
            {kind === 'hear'
              ? (lang === 'fr' ? reg(`[Vous avez|Tu as] reconnu ${st.ok} ${st.ok > 1 ? 'fois' : 'fois'} sur ${st.n}.`, s.register) : `You recognised ${st.ok} out of ${st.n}.`)
              : (lang === 'fr' ? `${st.ok} essai${st.ok > 1 ? 's' : ''} « clair${st.ok > 1 ? 's' : ''} » sur ${st.n} évalué${st.n > 1 ? 's' : ''}.` : `${st.ok} "clear" out of ${st.n} judged attempts.`)}
          </p>
        )}
        <p className="small muted" style={{ margin: 0 }}><IconInfo width={16} height={16} style={{ verticalAlign: '-3px' }} /> {need}</p>
        <p className="small" style={{ margin: 0 }}>+{summary.xp} {t('xp')}</p>
        <button className="btn primary" onClick={onContinue}>{t('continue')} <IconArrowRight width={20} height={20} /></button>
      </div>
    </Paper>
  )
}
