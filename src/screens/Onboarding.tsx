import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useSettings, type Settings } from '../data/settings'
import { reg } from '../i18n'
import { Paper } from '../components/Paper'
import { StarChart } from '../art/StarChart'
import { Swallow } from '../art/Swallow'
import { Logo } from '../art/Logo'
import { IconArrowRight, IconArrowLeft } from '../art/Icons'
import { CalibrationFlow } from './Calibration'
import { DiagnosticFlow } from './Diagnostic'
import { unlockAudio } from '../audio/recorder'
import { sfx } from '../audio/sfx'
import { TopBar } from '../components/Nav'

type Step = 'welcome' | 'profile' | 'affect' | 'calibration' | 'diagnostic'

const AFFECT = [
  { k: 'record', fr: 'M’enregistrer et me réécouter, ça me met…', en: 'Recording and hearing myself makes me feel…', lo: { fr: 'mal à l’aise', en: 'uneasy' }, hi: { fr: 'à l’aise', en: 'at ease' } },
  { k: 'others', fr: 'Parler anglais devant d’autres francophones, ça me met…', en: 'Speaking English in front of other French speakers makes me feel…', lo: { fr: 'mal à l’aise', en: 'uneasy' }, hi: { fr: 'à l’aise', en: 'at ease' } },
  { k: 'accent', fr: 'Mon accent français en anglais, je le vis…', en: 'My French accent in English, I feel it is…', lo: { fr: 'comme un handicap', en: 'a handicap' }, hi: { fr: 'comme une partie de moi', en: 'part of me' } },
  { k: 'mistakes', fr: 'Quand je me trompe en parlant, je…', en: 'When I make a mistake speaking, I…', lo: { fr: 'me bloque', en: 'freeze' }, hi: { fr: 'continue', en: 'carry on' } },
  { k: 'ear', fr: 'Entendre la différence entre deux sons anglais proches, je pense que…', en: 'Hearing the difference between two close English sounds, I think…', lo: { fr: 'je n’y arrive pas', en: 'I can’t' }, hi: { fr: 'j’y arrive', en: 'I can' } },
  { k: 'time', fr: 'Le temps que je peux consacrer à l’oral chaque semaine…', en: 'The time I can give to speaking practice each week…', lo: { fr: 'très peu', en: 'very little' }, hi: { fr: 'plusieurs fois 15 min', en: 'several 15-min slots' } },
]

export default function Onboarding() {
  const { part } = useParams()
  const nav = useNavigate()
  const { s, set } = useSettings()
  const standalone = part === 'calibration' || part === 'diagnostic'
  const [step, setStep] = useState<Step>(standalone ? (part as Step) : 'welcome')
  const L = (a: string, b: string) => (s.instr !== 'en' ? reg(a, s.register) : b)
  const go = (x: Step) => { sfx('page'); setStep(x); window.scrollTo({ top: 0 }) }
  const done = () => { set({ onboarded: true }); nav('/', { replace: true }) }

  if (standalone) {
    return (
      <div className="main">
        <TopBar back="/settings" />
        {step === 'calibration' ? <CalibrationFlow onDone={() => nav('/settings')} /> : <DiagnosticFlow onDone={() => nav('/')} />}
      </div>
    )
  }

  return (
    <div className="main stack" style={{ ['--stack' as string]: '18px' }}>
      {step === 'welcome' && (
        <>
          <section className="hero" style={{ minHeight: 420, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
            <StarChart night className="starchart" seed={3} style={{ width: 520, height: 520, right: -120, top: -120 }} />
            <div style={{ position: 'absolute', top: 26, left: 20 }}><span style={{ color: '#f3ead7' }}><Logo size={40} /></span></div>
            <div style={{ position: 'absolute', top: 70, right: 16 }} className="floaty"><Swallow pose="fly" size={210} /></div>
            <div style={{ position: 'relative' }}>
              <h1 style={{ fontSize: 'clamp(2.1rem, 7vw, 3.3rem)', maxWidth: '12ch' }}>{L('Gagnez en clarté.', 'Speak clearly.')}</h1>
              <p style={{ color: '#e2d8c2', fontSize: '1.15rem', maxWidth: '36ch' }}>{L('Une prononciation anglaise pensée pour les francophones : être compris facilement, sans renier son accent.', 'English pronunciation designed for French speakers: be understood easily, without giving up your accent.')}</p>
              <button className="btn primary big" onClick={() => { void unlockAudio(); sfx('open'); go('profile') }}>{L('Faisons connaissance', 'Let’s get started')} <IconArrowRight width={22} height={22} /></button>
            </div>
          </section>
          <div className="grid-2">
            <Paper seed="w1" tape={L('Votre accent', 'Your accent')} tapeTone="coral"><p style={{ margin: 0 }}>{L('Votre accent fait partie de vous. La clarté, elle, est une compétence — et elle s’entraîne.', 'Your accent is part of who you are. Clarity is a skill — and it can be trained.')}</p></Paper>
            <Paper seed="w2" tone="kraft" tape={L('Espace privé', 'Private space')} tapeTone="teal"><p style={{ margin: 0 }}>{L('Pas de compte, pas de note. Votre voix est analysée sur votre appareil et n’en sort que si vous le décidez.', 'No account, no grade. Your voice is analysed on your device and never leaves it unless you decide so.')}</p></Paper>
          </div>
        </>
      )}

      {step === 'profile' && (
        <Paper seed="profile" tape="1 / 4">
          <div className="stack" style={{ ['--stack' as string]: '16px' }}>
            <h2 style={{ margin: 0 }}>{L('Quelques réglages', 'A few settings')}</h2>
            <Q label="Vous ou tu ?" hint="Comment préférez-vous que l’application s’adresse à vous ?">
              <Opts value={s.register} set={(v) => set({ register: v })} options={[{ v: 'vous', l: 'Vouvoiement' }, { v: 'tu', l: 'Tutoiement' }]} />
            </Q>
            <Q label={L('Votre niveau d’anglais (estimation)', 'Your English level (estimate)')} hint={L('Pas besoin d’être précis : le parcours s’ajustera.', 'No need to be precise: the course will adjust.')}>
              <Opts value={s.level} set={(v) => set({ level: v })} options={[
                { v: 'A2', l: 'A2', sub: L('je me débrouille', 'I get by') }, { v: 'B1', l: 'B1', sub: L('je me fais comprendre', 'I make myself understood') },
                { v: 'B2', l: 'B2', sub: L('je suis à l’aise', 'I’m comfortable') }, { v: 'C1', l: 'C1', sub: L('j’approfondis', 'I refine') }]} />
            </Q>
            <Q label={L('Votre modèle de prononciation', 'Your pronunciation model')} hint={L('Les deux sont légitimes. L’important est d’être cohérent. Vous entendrez aussi l’autre variété en écoute.', 'Both are legitimate. What matters is consistency. You’ll also hear the other variety in listening practice.')}>
              <Opts value={s.variety} set={(v) => set({ variety: v })} options={[{ v: 'GA', l: '🇺🇸 ' + L('Américain (GA)', 'American (GA)') }, { v: 'SBE', l: '🇬🇧 ' + L('Britannique (SBE)', 'British (SBE)') }]} />
            </Q>
            <Q label={L('Votre profil', 'Your profile')}>
              <Opts value={s.audience} set={(v) => set({ audience: v })} options={[
                { v: 'general', l: L('Usage personnel', 'Personal use') }, { v: 'student', l: L('Étudiant·e', 'Student') },
                { v: 'cpge', l: 'CPGE / ' + L('concours', 'exams') }, { v: 'anglicist', l: L('Angliciste (LLCER, MEEF…)', 'English major') }, { v: 'pro', l: L('Contexte professionnel', 'Professional') }]} />
            </Q>
            <Q label={L('Prénom (facultatif)', 'First name (optional)')}>
              <input type="text" value={s.name} onChange={(e) => set({ name: e.target.value.slice(0, 40) })} placeholder={L('pour vous saluer', 'to greet you')} />
            </Q>
            <Nav onBack={() => go('welcome')} onNext={() => go('affect')} />
          </div>
        </Paper>
      )}

      {step === 'affect' && (
        <Paper seed="affect" tape="2 / 4" tapeTone="teal">
          <div className="stack" style={{ ['--stack' as string]: '16px' }}>
            <h2 style={{ margin: 0 }}>{L('Et vous, avec l’oral ?', 'And you, with speaking?')}</h2>
            <p className="small muted" style={{ margin: 0 }}>{L('Ces réponses règlent le ton et le rythme de l’application. Elles restent sur votre appareil et ne sont jamais déduites de votre voix.', 'Your answers set the tone and pace of the app. They stay on your device and are never inferred from your voice.')}</p>
            {AFFECT.map((a) => (
              <div key={a.k} className="stack" style={{ ['--stack' as string]: '6px' }}>
                <div style={{ fontWeight: 700 }}>{s.instr === 'en' ? a.en : a.fr}</div>
                <div className="row" style={{ gap: 6 }}>
                  <span className="small muted" style={{ width: 90, textAlign: 'right' }}>{s.instr === 'en' ? a.lo.en : a.lo.fr}</span>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} className={`chip ${s.affect[a.k] === n ? 'on' : ''}`} style={{ minWidth: 36, justifyContent: 'center' }} onClick={() => set({ affect: { ...s.affect, [a.k]: n } })} aria-label={`${n}/5`}>{n}</button>
                  ))}
                  <span className="small muted" style={{ width: 90 }}>{s.instr === 'en' ? a.hi.en : a.hi.fr}</span>
                </div>
              </div>
            ))}
            <Nav onBack={() => go('profile')} onNext={() => { set(affectToSettings(s)); go('calibration') }} />
          </div>
        </Paper>
      )}

      {step === 'calibration' && (
        <>
          <div className="label">3 / 4</div>
          <CalibrationFlow onDone={() => go('diagnostic')} />
          <div className="center"><button className="btn ghost small" onClick={() => go('diagnostic')}>{L('Passer cette étape', 'Skip this step')}</button></div>
        </>
      )}
      {step === 'diagnostic' && (
        <>
          <div className="label">4 / 4</div>
          <DiagnosticFlow onDone={done} />
          <div className="center"><button className="btn ghost small" onClick={done}>{L('Passer — je choisirai sur la carte', 'Skip — I’ll choose on the map')}</button></div>
        </>
      )}
    </div>
  )
}

/** Declared affective profile → gentle adaptations (never labels). */
function affectToSettings(s: Settings): Partial<Settings> {
  const a = s.affect
  const p: Partial<Settings> = {}
  if ((a.mistakes ?? 3) <= 2 || (a.record ?? 3) <= 2) p.hideScores = false // keep verdicts but softer; draft mode offered in settings
  if ((a.mistakes ?? 3) <= 1) p.hideScores = true
  if ((a.time ?? 3) <= 2) p.weeklyGoal = 3
  else if ((a.time ?? 3) >= 4) p.weeklyGoal = 5
  if ((a.record ?? 3) <= 2 || (a.mistakes ?? 3) <= 2) p.silenceMs = 1000 // more time to hesitate
  return p
}

function Q({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="stack" style={{ ['--stack' as string]: '8px' }}>
      <div><div style={{ fontWeight: 700 }}>{label}</div>{hint && <div className="small muted">{hint}</div>}</div>
      {children}
    </div>
  )
}

function Opts<T extends string>({ value, set, options }: { value: T; set: (v: T) => void; options: { v: T; l: string; sub?: string }[] }) {
  return (
    <div className="choices" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
      {options.map((o) => (
        <button key={o.v} className="choice" aria-pressed={value === o.v} onClick={() => { set(o.v); sfx('tick') }} style={{ minHeight: 52 }}>
          <span><span className="choice-title" style={{ display: 'block' }}>{o.l}</span>{o.sub && <span className="choice-sub">{o.sub}</span>}</span>
        </button>
      ))}
    </div>
  )
}

function Nav({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const s = useSettings((st) => st.s)
  return (
    <div className="spread">
      <button className="btn ghost" onClick={onBack}><IconArrowLeft width={20} height={20} /> {s.instr === 'en' ? 'Back' : 'Retour'}</button>
      <button className="btn primary" onClick={onNext}>{s.instr === 'en' ? 'Next' : 'Suivant'} <IconArrowRight width={20} height={20} /></button>
    </div>
  )
}
