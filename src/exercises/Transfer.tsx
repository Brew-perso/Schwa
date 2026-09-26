import { useMemo, useState } from 'react'
import type { Target } from '../content/types'
import { useSettings, instrFor } from '../data/settings'
import { pickBi, reg, useT } from '../i18n'
import { RecordButton } from '../components/RecordButton'
import type { Recording } from '../audio/recorder'
import { engine } from '../engine/client'
import { learnerBuffer, playBuffer } from '../audio/player'
import { db } from '../data/db'
import { toWav } from '../audio/dsp'
import { IconDownload, IconEar, IconSpeech, IconArrowRight } from '../art/Icons'
import { yin, toSemitones, intensityDb } from '../engine/acoustics'

/**
 * Transfer to semi-spontaneous speech (step 5). The machine only says what it understood (intelligibility),
 * fluency hints are descriptive, and the evidence level N4 requires a human judgement (self → peer/teacher).
 */
export function TransferTask({ target, onDone }: { target: Target; onDone: (validated: 'self' | null) => void }) {
  const s = useSettings((st) => st.s)
  const t = useT()
  const lang = instrFor(s, target.level) === 'en' ? 'en' : 'fr'
  const task = useMemo(() => target.transfer[Math.floor(Math.random() * target.transfer.length)], [target])
  const [rec, setRec] = useState<Recording | null>(null)
  const [busy, setBusy] = useState(false)
  const [transcript, setTranscript] = useState<string | null>(null)
  const [stats, setStats] = useState<{ wpm: number; pauses: number; falls: number } | null>(null)
  const [self, setSelf] = useState<number | null>(null)
  const [saved, setSaved] = useState(false)
  const hints = task?.hint_words ?? []

  const onRecorded = async (r: Recording) => {
    setRec(r)
    setBusy(true)
    try {
      const text = await engine.transcribe(r.audio16k)
      setTranscript(text)
      // descriptive fluency cues (never a score): words per minute, long pauses, final falls
      const words = text.split(/\s+/).filter(Boolean).length
      const inten = intensityDb(r.audio16k)
      const mx = Math.max(...Array.from(inten))
      let pauses = 0, run = 0
      for (const v of inten) { if (v < mx - 30) run++; else { if (run >= 35) pauses++; run = 0 } }
      const { st } = toSemitones(yin(r.audio16k))
      let falls = 0
      // count phrase ends (voiced stretch followed by ≥350 ms silence) that end lower than they started
      let seg: number[] = []
      for (let i = 0; i < st.length; i++) {
        if (!Number.isNaN(st[i])) seg.push(st[i])
        else if (seg.length > 20) { if (seg[seg.length - 1] < seg[Math.floor(seg.length * 0.6)] - 1.5) falls++; seg = [] }
      }
      setStats({ wpm: Math.round((words / Math.max(1, r.durationMs / 1000)) * 60), pauses, falls })
    } finally { setBusy(false) }
  }

  const save = async () => {
    if (!rec) return
    await db.portfolio.add({ ts: Date.now(), kind: 'transfer', label: pickBi(target.title, lang, s.register), text: pickBi({ fr: task.fr, en: task.en }, lang, s.register), targetId: target.id, audio: toWav(rec.audio16k, 16000), duration: rec.durationMs / 1000, transcript: transcript ?? undefined })
    setSaved(true)
  }
  const download = () => {
    if (!rec) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(toWav(rec.audio16k, 16000))
    a.download = `schwa-${target.id}-${new Date().toISOString().slice(0, 10)}.wav`
    a.click()
  }
  if (!task) return null
  const found = transcript ? hints.filter((h) => transcript.toLowerCase().includes(h.toLowerCase())) : []
  return (
    <div className="stack" style={{ ['--stack' as string]: '16px' }}>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <IconSpeech width={34} height={34} style={{ flex: 'none', color: 'var(--coral)' }} />
        <p style={{ fontSize: '1.15rem', fontWeight: 600, margin: 0 }}>{pickBi({ fr: task.fr, en: task.en }, lang, s.register)}</p>
      </div>
      {hints.length > 0 && (
        <div className="row wrap" style={{ gap: 6 }}>
          {hints.map((h) => <span key={h} className={`chip ${found.includes(h) ? 'on' : ''}`}>{h}</span>)}
        </div>
      )}
      <p className="small muted" style={{ margin: 0 }}>
        {lang === 'fr' ? reg('Pas de chrono, pas de note : [parlez|parle] librement, 20 à 60 secondes. L’enregistrement s’arrête quand [vous vous taisez|tu te tais] un moment.', s.register) : 'No timer, no grade: speak freely, 20 to 60 seconds. Recording stops when you pause for a moment.'}
      </p>
      <RecordButton onRecorded={onRecorded} busy={busy} maxMs={75000} silenceMs={2200} />
      {transcript !== null && rec && (
        <div className="fb-card clear fade-in stack" style={{ ['--stack' as string]: '12px' }}>
          <div className="label">{t('machine_understood')}</div>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', margin: 0 }}>« {transcript || '…'} »</p>
          {stats && (
            <p className="small muted" style={{ margin: 0 }}>
              {lang === 'fr'
                ? `≈ ${stats.wpm} mots/min · ${stats.pauses} pause(s) longue(s) · ${stats.falls} fin(s) de phrase descendante(s).`
                : `≈ ${stats.wpm} words/min · ${stats.pauses} long pause(s) · ${stats.falls} falling sentence end(s).`}
            </p>
          )}
          <div className="row wrap" style={{ gap: 8 }}>
            <button className="btn small" onClick={() => void playBuffer(learnerBuffer(rec.native, rec.sampleRate), { id: 'me' })}><IconEar width={18} height={18} /> {t('listen_me')}</button>
            <button className="btn small" onClick={save} disabled={saved}>{saved ? (lang === 'fr' ? 'Dans le carnet ✓' : 'In the logbook ✓') : (lang === 'fr' ? 'Garder dans mon carnet' : 'Keep in my logbook')}</button>
            <button className="btn small ghost" onClick={download}><IconDownload width={18} height={18} /> {lang === 'fr' ? 'Envoyer à mon enseignant (fichier)' : 'Send to my teacher (file)'}</button>
          </div>
          <div className="divider" style={{ margin: '6px 0' }} />
          <p style={{ margin: 0, fontWeight: 700 }}>{lang === 'fr' ? reg('En [vous|te] réécoutant : la cible « ' + pickBi(target.title, lang, s.register) + ' » était-elle claire quand [vous parliez|tu parlais] librement ?', s.register) : `Listening back: was the target '${pickBi(target.title, lang, s.register)}' clear when you spoke freely?`}</p>
          <div className="row wrap" style={{ gap: 8 }}>
            {[lang === 'fr' ? 'Pas encore' : 'Not yet', lang === 'fr' ? 'Presque' : 'Nearly', lang === 'fr' ? 'Oui, clairement' : 'Yes, clearly'].map((l, k) => (
              <button key={k} className={`chip ${self === k ? 'on' : ''}`} onClick={() => setSelf(k)}>{l}</button>
            ))}
          </div>
          <p className="small muted" style={{ margin: 0 }}>
            {lang === 'fr' ? 'Votre auto-évaluation valide ce palier à titre provisoire ; un enseignant ou un pair peut le confirmer à partir du fichier audio.' : 'Your self-assessment validates this level provisionally; a teacher or peer can confirm it from the audio file.'}
          </p>
          <div className="center"><button className="btn primary" disabled={self === null} onClick={() => onDone(self === 2 ? 'self' : null)}>{t('continue')} <IconArrowRight width={20} height={20} /></button></div>
        </div>
      )}
    </div>
  )
}
