import { useEffect, useMemo, useState } from 'react'
import { useCourse } from '../content/store'
import { useSettings } from '../data/settings'
import { kvGet, kvSet } from '../data/db'
import type { LearnerReport } from '../learning/report'
import { pickBi, reg } from '../i18n'
import { TopBar } from '../components/Nav'
import { Paper } from '../components/Paper'
import { IconUpload, IconDownload, IconTrash, IconTeacher } from '../art/Icons'
import { StarChart } from '../art/StarChart'

/**
 * L'Observatoire (teacher view). Reports are imported as files the learners chose to send:
 * no server, no account, data stays on the teacher's device. The dashboard says what to re-teach next.
 */
export default function Teacher() {
  const course = useCourse()
  const s = useSettings((st) => st.s)
  const [reports, setReports] = useState<LearnerReport[]>([])
  const [code, setCode] = useState<string>('')
  const L = (a: string, b: string) => (s.instr !== 'en' ? reg(a, s.register) : b)
  useEffect(() => { void kvGet<LearnerReport[]>('teacher-reports', []).then(setReports) }, [])
  const save = (r: LearnerReport[]) => { setReports(r); void kvSet('teacher-reports', r) }
  const onFiles = async (files: FileList | null) => {
    if (!files) return
    const next = [...reports]
    for (const f of Array.from(files)) {
      try {
        const j = JSON.parse(await f.text()) as LearnerReport
        if (j.schema !== 'schwa-report-v1') continue
        const i = next.findIndex((x) => x.learner.name === j.learner.name && x.learner.classCode === j.learner.classCode)
        if (i >= 0) next[i] = j; else next.push(j)
      } catch { /* ignore invalid files */ }
    }
    save(next)
  }
  const shown = code ? reports.filter((r) => r.learner.classCode === code) : reports
  const codes = Array.from(new Set(reports.map((r) => r.learner.classCode).filter(Boolean)))
  const stats = useMemo(() => {
    if (!course) return []
    return course.targets.map((t) => {
      const lv = shown.map((r) => r.mastery[t.id]?.level ?? 0)
      const started = lv.filter((x) => x > 0).length
      const stuck = shown.filter((r) => (r.mastery[t.id]?.level ?? 0) > 0 && (r.mastery[t.id]?.level ?? 0) < 3 && (r.errors[t.id] ?? 0) >= 4).length
      const errs = shown.reduce((a, r) => a + (r.errors[t.id] ?? 0), 0)
      const prio = shown.filter((r) => r.priorities.includes(t.id)).length
      return { t, started, stuck, errs, prio, mean: lv.reduce((a, b) => a + b, 0) / Math.max(1, lv.length) }
    })
  }, [course, shown])
  if (!course) return <div className="main">…</div>
  const lang = s.instr === 'en' ? 'en' : 'fr'
  const reteach = stats.filter((x) => x.stuck > 0 || x.prio > 0).sort((a, b) => b.stuck * 2 + b.prio + b.errs / 10 - (a.stuck * 2 + a.prio + a.errs / 10)).slice(0, 3)
  const exportCsv = () => {
    const header = ['learner', 'class', 'variety', 'level', 'sessions_week', ...course.targets.map((t) => t.id)]
    const rows = shown.map((r) => [r.learner.name, r.learner.classCode, r.learner.variety, r.learner.level, r.week.sessions, ...course.targets.map((t) => r.mastery[t.id]?.level ?? 0)])
    const csv = [header, ...rows].map((r) => r.join(';')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `schwa-observatoire-${code || 'tous'}.csv`; a.click()
  }
  return (
    <div className="main wide stack" style={{ ['--stack' as string]: '18px' }}>
      <TopBar back="/settings" title={L('Espace enseignant', 'Teacher space')} />
      <section className="hero">
        <StarChart night className="starchart" seed={21} />
        <div style={{ position: 'relative' }}>
          <div className="label" style={{ color: 'var(--star)' }}><IconTeacher width={18} height={18} style={{ verticalAlign: '-3px' }} /> {L('L’Observatoire', 'The Observatory')}</div>
          <h1 style={{ margin: '6px 0' }}>{L('Où en est le groupe ?', 'Where is the group?')}</h1>
          <p style={{ color: '#e2d8c2', maxWidth: '52ch' }}>{L('Importez les bilans que vos apprenants vous envoient (fichiers .json exportés depuis leurs réglages). Aucun serveur : les données restent sur cet appareil. Les enregistrements ne sont jamais inclus sans leur accord.', 'Import the reports your learners send you (.json files exported from their settings). No server: data stays on this device. Recordings are never included without their consent.')}</p>
          <label className="btn primary">
            <IconUpload width={20} height={20} /> {L('Importer des bilans', 'Import reports')}
            <input type="file" accept="application/json,.json" multiple onChange={(e) => void onFiles(e.target.files)} style={{ display: 'none' }} />
          </label>
        </div>
      </section>
      {reports.length > 0 && (
        <div className="row wrap" style={{ gap: 8 }}>
          <button className={`chip ${code === '' ? 'on' : ''}`} onClick={() => setCode('')}>{L('Tous', 'All')} ({reports.length})</button>
          {codes.map((c) => <button key={c} className={`chip ${code === c ? 'on' : ''}`} onClick={() => setCode(c)}>{c}</button>)}
          <span style={{ flex: 1 }} />
          <button className="btn small" onClick={exportCsv}><IconDownload width={18} height={18} /> CSV</button>
          <button className="btn small ghost" onClick={() => { if (confirm(L('Retirer tous les bilans importés ?', 'Remove all imported reports?'))) save([]) }}><IconTrash width={18} height={18} /></button>
        </div>
      )}
      {shown.length > 0 && (
        <>
          <Paper seed="reteach" tone="kraft" tape={L('À reprendre en classe', 'To re-teach in class')} tapeTone="coral">
            {reteach.length === 0 ? <p style={{ margin: 0 }}>{L('Pas de point de blocage collectif pour l’instant.', 'No collective sticking point for now.')}</p> : (
              <ol style={{ margin: 0, paddingLeft: 20 }}>
                {reteach.map((x) => (
                  <li key={x.t.id} style={{ marginBottom: 6 }}>
                    <b>{pickBi(x.t.title, lang, s.register)}</b> — {x.prio} {L('priorité(s) au diagnostic', 'diagnostic priority(ies)')}, {x.stuck} {L('apprenant(s) qui stagnent', 'learner(s) stuck')}, {x.errs} {L('essais « à retravailler » en 30 jours', '"to rework" attempts in 30 days')}.
                  </li>
                ))}
              </ol>
            )}
            <p className="small muted" style={{ marginBottom: 0 }}>{L('Conseil : en classe, privilégiez le travail en binôme et évitez toute correction publique pour les apprenants anxieux.', 'Tip: in class, favour pair work and avoid public correction for anxious learners.')}</p>
          </Paper>
          <Paper seed="heat" tape={L('Carte de chaleur : cibles × apprenants (N1–N5)', 'Heat map: targets × learners (N1–N5)')} tapeTone="teal">
            <div style={{ overflowX: 'auto' }}>
              <table className="heat">
                <thead>
                  <tr><th style={{ textAlign: 'left' }}>{L('Cible', 'Target')}</th>{shown.map((r, i) => <th key={i}>{r.learner.name}</th>)}</tr>
                </thead>
                <tbody>
                  {course.targets.map((t) => (
                    <tr key={t.id}>
                      <td style={{ textAlign: 'left', whiteSpace: 'nowrap' }}><span className="small muted">{t.level}</span> {pickBi(t.title, lang, s.register)}</td>
                      {shown.map((r, i) => { const lv = r.mastery[t.id]?.level ?? 0; return <td key={i} className={`lvl${lv}`}>{lv || '·'}{r.mastery[t.id]?.n4 === 'self' ? '*' : ''}</td> })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="small muted" style={{ marginBottom: 0 }}>{L('* N4 auto-validé par l’apprenant : à confirmer en écoutant un échantillon de parole libre.', '* N4 self-validated by the learner: confirm by listening to a free-speech sample.')}</p>
          </Paper>
          <Paper seed="regularity" tape={L('Régularité (7 derniers jours)', 'Regularity (last 7 days)')}>
            <div className="stack" style={{ ['--stack' as string]: '6px' }}>
              {shown.map((r, i) => (
                <div key={i} className="spread"><span>{r.learner.name} <span className="small muted">({r.learner.variety}, {r.learner.level})</span></span><span>{r.week.sessions} {L('séance(s)', 'session(s)')} · {r.week.minutes} min</span></div>
              ))}
            </div>
          </Paper>
        </>
      )}
    </div>
  )
}
