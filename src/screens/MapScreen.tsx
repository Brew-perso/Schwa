import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useCourse } from '../content/store'
import { useSettings } from '../data/settings'
import { allMastery, evidenceLevel } from '../learning/mastery'
import { pickBi, reg } from '../i18n'
import type { Mastery } from '../data/db'
import { Planet } from '../art/Planet'
import { StarChart } from '../art/StarChart'
import type { Level } from '../content/types'

const DOMAIN = {
  percevoir: { fr: 'percevoir', en: 'perceive' }, articuler: { fr: 'articuler', en: 'articulate' },
  prosodie: { fr: 'prosodie', en: 'prosody' }, aisance: { fr: 'aisance', en: 'fluency' },
}

/** "Carte du ciel": the whole A2→C1 course as four orbits of planets (targets). Nothing is locked: autonomy. */
export default function MapScreen() {
  const course = useCourse()
  const s = useSettings((st) => st.s)
  const [m, setM] = useState<Record<string, Mastery>>({})
  useEffect(() => { void allMastery().then(setM) }, [])
  if (!course) return <div className="main">…</div>
  const lang = s.instr === 'en' ? 'en' : 'fr'
  const levels: Level[] = ['A2', 'B1', 'B2', 'C1']
  return (
    <div className="main stack" style={{ ['--stack' as string]: '10px' }}>
      <div style={{ position: 'relative' }}>
        <StarChart seed={5} style={{ position: 'absolute', right: -40, top: -30, width: 260, height: 260, opacity: 0.8, pointerEvents: 'none' }} />
        <h1 style={{ position: 'relative' }}>{lang === 'fr' ? 'Carte du ciel' : 'Sky map'}</h1>
        <p className="muted" style={{ position: 'relative', maxWidth: '44ch' }}>
          {lang === 'fr'
            ? reg('Quatre orbites, du décollage (A2) à l’espace profond (C1). Chaque planète est une cible ; les étoiles ★ sont [vos|tes] priorités. Tout est accessible : [vous tracez votre|tu traces ta] route.', s.register)
            : 'Four orbits, from lift-off (A2) to deep space (C1). Each planet is a target; stars ★ mark your priorities. Everything is open: you chart your own course.'}
        </p>
      </div>
      {levels.map((lv) => {
        const info = course.levels.find((l) => l.id === lv)!
        const ts = course.targets.filter((t) => t.level === lv)
        const done = ts.filter((t) => evidenceLevel(m[t.id]) >= 3).length
        return (
          <section key={lv} className="orbit-section">
            <div className="orbit-head">
              <span className="tape night">{lv}</span>
              <h2 style={{ margin: 0 }}>{pickBi(info.name, lang, s.register).split('—')[1]?.trim() ?? pickBi(info.name, lang, s.register)}</h2>
              <span className="small muted">{done}/{ts.length}</span>
            </div>
            <p className="small muted" style={{ margin: '6px 0 0' }}>{pickBi(info.blurb, lang, s.register)}</p>
            <div className="planet-grid">
              {ts.map((t) => {
                const lvl = evidenceLevel(m[t.id])
                return (
                  <Link key={t.id} to={`/target/${t.id}`} className={`planet-btn ${s.priorities.includes(t.id) ? 'is-priority' : ''}`}>
                    <Planet id={t.id} color={t.planet.color} motif={t.planet.motif} size={84} state={lvl >= 4 ? 'mastered' : lvl > 0 || m[t.id]?.opened ? 'progress' : 'open'} progress={lvl / 5} />
                    <span className="p-title">{pickBi(t.title, lang, s.register)}</span>
                    <span className="p-sub">{DOMAIN[t.domain][lang]}{lvl ? ` · N${lvl}` : ''}</span>
                  </Link>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
