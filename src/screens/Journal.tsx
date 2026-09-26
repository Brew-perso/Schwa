import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useCourse } from '../content/store'
import { useSettings } from '../data/settings'
import { db, type PortfolioEntry, type SessionLog } from '../data/db'
import { allMastery, evidenceLevel } from '../learning/mastery'
import { pickBi } from '../i18n'
import type { Mastery } from '../data/db'
import { Paper } from '../components/Paper'
import { Planet } from '../art/Planet'
import { IconEar, IconTrash, IconDownload } from '../art/Icons'
import { playBuffer } from '../audio/player'
import { getAudioContext, unlockAudio } from '../audio/recorder'
import { totalXp } from '../learning/xp'

const DOMAINS = [
  { k: 'percevoir', fr: 'Percevoir', en: 'Perceive' },
  { k: 'articuler', fr: 'Articuler', en: 'Articulate' },
  { k: 'prosodie', fr: 'Prosodie', en: 'Prosody' },
  { k: 'aisance', fr: 'Aisance', en: 'Fluency' },
] as const

/** Carnet de bord: profile by domain, evidence per target, sound portfolio (then vs now), effort. */
export default function Journal() {
  const course = useCourse()
  const s = useSettings((st) => st.s)
  const [m, setM] = useState<Record<string, Mastery>>({})
  const [port, setPort] = useState<PortfolioEntry[]>([])
  const [sessions, setSessions] = useState<SessionLog[]>([])
  const [xp, setXp] = useState(0)
  const lang = s.instr === 'en' ? 'en' : 'fr'
  const reload = () => {
    void allMastery().then(setM)
    void db.portfolio.orderBy('ts').reverse().toArray().then(setPort)
    void db.sessions.orderBy('ts').reverse().limit(60).toArray().then(setSessions)
    void totalXp().then(setXp)
  }
  useEffect(reload, [])
  if (!course) return <div className="main">…</div>
  const byDomain = DOMAINS.map((d) => {
    const ts = course.targets.filter((t) => t.domain === d.k)
    const lv = ts.reduce((a, t) => a + evidenceLevel(m[t.id]), 0) / Math.max(1, ts.length * 5)
    const diag = s.phono?.[d.k]
    return { ...d, lv, diag, n: ts.length }
  })
  const play = async (p: PortfolioEntry) => {
    await unlockAudio()
    const buf = await getAudioContext().decodeAudioData(await p.audio.arrayBuffer())
    void playBuffer(buf, { id: 'pf' + p.id })
  }
  const j0 = port.filter((p) => p.kind === 'J0' || p.kind === 'diagnostic').slice(-1)[0]
  // last 8 weeks effort bars
  const weeks: number[] = Array(8).fill(0)
  const now = Date.now()
  for (const x of sessions) { const w = Math.floor((now - x.ts) / (7 * 86400000)); if (w < 8) weeks[7 - w] += x.minutes }
  const maxW = Math.max(10, ...weeks)
  return (
    <div className="main stack" style={{ ['--stack' as string]: '18px' }}>
      <h1>{lang === 'fr' ? 'Carnet de bord' : 'Logbook'}</h1>
      <Paper seed="profile" tape={lang === 'fr' ? 'Mon profil de prononciation' : 'My pronunciation profile'}>
        <div className="stack" style={{ ['--stack' as string]: '12px' }}>
          {byDomain.map((d) => (
            <div key={d.k}>
              <div className="spread"><b>{lang === 'fr' ? d.fr : d.en}</b><span className="small muted">{Math.round(d.lv * 100)} %</span></div>
              <div className="bar" style={{ marginTop: 4 }}><span style={{ width: `${Math.max(3, d.lv * 100)}%` }} /></div>
            </div>
          ))}
          <p className="small muted" style={{ margin: 0 }}>
            {lang === 'fr'
              ? 'Progression mesurée par les niveaux de preuve (N1 à N5), domaine par domaine. Ce profil est indépendant de votre niveau général d’anglais.'
              : 'Progress measured by evidence levels (N1 to N5), domain by domain. This profile is independent of your general English level.'}
          </p>
        </div>
      </Paper>

      <Paper seed="portfolio" tone="kraft" tape={lang === 'fr' ? 'Portfolio sonore' : 'Sound portfolio'} tapeTone="coral">
        {j0 && (
          <p className="small" style={{ marginTop: 0 }}>
            {lang === 'fr' ? 'Réécoutez votre premier enregistrement et comparez avec aujourd’hui : c’est la meilleure preuve que votre voix change.' : 'Listen to your first recording and compare with today: the best proof that your voice is changing.'}
          </p>
        )}
        {port.length === 0 && <p className="muted" style={{ margin: 0 }}>{lang === 'fr' ? 'Vos enregistrements choisis (diagnostic, parole libre) apparaîtront ici. Ils restent sur votre appareil.' : 'Your chosen recordings (diagnostic, free speech) will appear here. They stay on your device.'}</p>}
        {port.map((p) => (
          <div key={p.id} className="portfolio-row">
            <button className="audio-btn" style={{ width: 42, height: 42 }} onClick={() => void play(p)} aria-label="Écouter"><IconEar /></button>
            <div>
              <div style={{ fontWeight: 700 }}>{p.label}</div>
              <div className="small muted">{new Date(p.ts).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB')} · {Math.round(p.duration)} s{p.transcript ? ` · « ${p.transcript.slice(0, 60)}${p.transcript.length > 60 ? '…' : ''} »` : ''}</div>
            </div>
            <div className="row" style={{ gap: 6 }}>
              <button className="icon-btn" aria-label="Télécharger" onClick={() => { const a = document.createElement('a'); a.href = URL.createObjectURL(p.audio); a.download = `schwa-${p.kind}-${new Date(p.ts).toISOString().slice(0, 10)}.wav`; a.click() }}><IconDownload /></button>
              <button className="icon-btn" aria-label="Supprimer" onClick={async () => { if (confirm(lang === 'fr' ? 'Supprimer cet enregistrement ?' : 'Delete this recording?')) { await db.portfolio.delete(p.id!); reload() } }}><IconTrash /></button>
            </div>
          </div>
        ))}
      </Paper>

      <Paper seed="evidence" tape={lang === 'fr' ? 'Mes cibles' : 'My targets'} tapeTone="teal">
        <div className="stack" style={{ ['--stack' as string]: '6px' }}>
          {course.targets.filter((t) => m[t.id]?.opened).length === 0 && <p className="muted" style={{ margin: 0 }}>{lang === 'fr' ? 'Aucune cible commencée pour l’instant.' : 'No target started yet.'}</p>}
          {course.targets.filter((t) => m[t.id]?.opened).map((t) => (
            <Link key={t.id} to={`/target/${t.id}`} className="row" style={{ textDecoration: 'none', color: 'inherit', padding: '6px 0' }}>
              <Planet id={t.id} color={t.planet.color} motif={t.planet.motif} size={40} state={evidenceLevel(m[t.id]) >= 4 ? 'mastered' : 'progress'} progress={evidenceLevel(m[t.id]) / 5} />
              <span style={{ flex: 1, fontWeight: 700 }}>{pickBi(t.title, lang, s.register)}</span>
              <span className="chip">{evidenceLevel(m[t.id]) ? `N${evidenceLevel(m[t.id])}` : '—'}</span>
            </Link>
          ))}
        </div>
      </Paper>

      <Paper seed="effort" tone="card" tape={lang === 'fr' ? 'Mon effort' : 'My effort'} tapeTone="indigo">
        <div className="row" style={{ alignItems: 'flex-end', gap: 6, height: 90 }} aria-label={lang === 'fr' ? 'Minutes par semaine, 8 dernières semaines' : 'Minutes per week, last 8 weeks'}>
          {weeks.map((w, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ width: '100%', height: `${(w / maxW) * 70 + 2}px`, background: i === 7 ? 'var(--coral)' : 'var(--teal-2)', borderRadius: 6, border: '1.5px solid var(--ink)' }} />
              <span className="small muted">{i === 7 ? (lang === 'fr' ? 'cette sem.' : 'this wk') : `-${7 - i}`}</span>
            </div>
          ))}
        </div>
        <p className="small muted" style={{ marginBottom: 0 }}>{xp} {lang === 'fr' ? 'points d’effort au total — ils récompensent la pratique, pas la réussite.' : 'effort points in total — they reward practice, not success.'}</p>
      </Paper>
    </div>
  )
}
