import { useEffect, useRef, useState } from 'react'
import { useCourse } from '../content/store'
import { useSettings, type Calibration as Cal } from '../data/settings'
import { reg } from '../i18n'
import { openMic, record, unlockAudio, getAudioContext, micSettings, type Recording } from '../audio/recorder'
import { engine } from '../engine/client'
import { RecordButton } from '../components/RecordButton'
import { AudioButton } from '../components/AudioButton'
import { Paper } from '../components/Paper'
import { IconHeadphones, IconMic, IconCheck, IconArrowRight } from '../art/Icons'
import { yin } from '../engine/acoustics'
import { Bird } from '../art/Bird'

/**
 * "Calibrage du micro" (30 s): permission, level & background noise, then five short neutral phrases
 * that give the speaker's F0 range and vowel space (Lobanov normalisation for the vowel map).
 */
export function CalibrationFlow({ onDone }: { onDone: () => void }) {
  const course = useCourse()
  const { s, set } = useSettings()
  const L = (a: string, b: string) => (s.instr !== 'en' ? reg(a, s.register) : b)
  const [phase, setPhase] = useState<'mic' | 'noise' | 'phrases' | 'done'>('mic')
  const [err, setErr] = useState<string | null>(null)
  const [level, setLevel] = useState(0)
  const [noiseDb, setNoiseDb] = useState<number | null>(null)
  const [k, setK] = useState(0)
  const [busy, setBusy] = useState(false)
  const [engineMsg, setEngineMsg] = useState('')
  const f0s = useRef<number[]>([])
  const vowels = useRef<Record<string, [number, number]>>({})

  useEffect(() => {
    const off = engine.subscribe((st) => {
      if (st.state === 'loading' && st.total) setEngineMsg(L(`Préparation du moteur d’analyse (une seule fois) : ${Math.round((st.loaded / st.total) * 100)} %`, `Preparing the analysis engine (one time only): ${Math.round((st.loaded / st.total) * 100)} %`))
      else if (st.state === 'ready') setEngineMsg('')
      else if (st.state === 'error') setEngineMsg(L('Le moteur d’analyse n’a pas pu se charger. [Vérifiez|Vérifie] la connexion.', 'The analysis engine could not load. Check your connection.'))
    })
    return off
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const askMic = async () => {
    setErr(null)
    try {
      await unlockAudio()
      await openMic()
      void engine.init().catch(() => {})
      setPhase('noise')
      // measure 2 s of background noise
      const r = await record({ mode: 'hold', silenceMs: 1000, maxMs: 2000, onLevel: (rms) => setLevel(Math.min(1, Math.sqrt(rms) * 3.2)) })
      const out = await r.done
      let e = 0
      for (let i = 0; i < out.audio16k.length; i++) e += out.audio16k[i] ** 2
      const db = 10 * Math.log10(e / Math.max(1, out.audio16k.length) + 1e-12)
      setNoiseDb(db)
      setLevel(0)
    } catch (e) {
      const name = (e as Error)?.name
      setErr(name === 'NotAllowedError' ? L('Le micro a été refusé. [Autorisez-le|Autorise-le] dans les réglages du navigateur (icône à gauche de l’adresse), puis [réessayez|réessaie].', 'Microphone access was denied. Allow it in your browser settings (icon left of the address bar), then try again.') : String((e as Error)?.message ?? e))
    }
  }
  void getAudioContext
  const phrases = course?.calibration ?? []
  const cur = phrases[k]
  const onRecorded = async (r: Recording) => {
    setBusy(true)
    try {
      const f0 = yin(r.audio16k)
      f0s.current.push(...Array.from(f0).filter((x) => x > 0))
      await engine.init()
      const ref = cur.ref[s.variety]
      // the calibration vowel sits in the last content word of each phrase
      const wi = ref.words.length - 1
      const res = await engine.evaluate({ audio: r.audio16k, ref, checks: [], expect: { vowelWord: wi }, level: 'C1', transcribe: false })
      if (res.vowel) vowels.current[cur.vowel] = [res.vowel.f1, res.vowel.f2]
      if (k + 1 < phrases.length) setK(k + 1)
      else finish()
    } catch { if (k + 1 < phrases.length) setK(k + 1); else finish() } finally { setBusy(false) }
  }
  const finish = () => {
    const f = f0s.current.sort((a, b) => a - b)
    const med = f.length ? f[Math.floor(f.length / 2)] : 160
    const v = Object.values(vowels.current)
    const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length)
    const sd = (a: number[]) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))) || 1 }
    const f1 = v.map((x) => x[0]), f2 = v.map((x) => x[1])
    const cal: Cal = {
      ts: Date.now(), f0med: med, f0lo: f[Math.floor(f.length * 0.1)] ?? med * 0.8, f0hi: f[Math.floor(f.length * 0.9)] ?? med * 1.3,
      noiseDb: noiseDb ?? -60,
      f1: v.length >= 3 ? { m: mean(f1), s: sd(f1) * 1.25 } : { m: 560, s: 170 },
      f2: v.length >= 3 ? { m: mean(f2), s: sd(f2) * 1.25 } : { m: 1650, s: 480 },
      vowels: vowels.current,
    }
    set({ calibration: cal })
    setPhase('done')
  }
  const applied = micSettings()
  return (
    <div className="stack" style={{ ['--stack' as string]: '16px' }}>
      <h2>{L('Faisons connaissance avec [votre|ta] voix', 'Let’s get to know your voice')}</h2>
      {phase === 'mic' && (
        <Paper seed="cal-mic" tape={L('Réglage du micro', 'Microphone setup')}>
          <div className="stack" style={{ ['--stack' as string]: '12px' }}>
            <div className="row"><IconHeadphones width={34} height={34} style={{ color: 'var(--teal)', flex: 'none' }} /><p style={{ margin: 0 }}>{L('Un casque avec micro donne les meilleurs résultats. Un endroit calme aussi — mais pas besoin d’un studio.', 'A headset with a mic gives the best results. A quiet place too — no studio needed.')}</p></div>
            <p className="small muted" style={{ margin: 0 }}>{L('[Votre|Ta] voix est analysée sur cet appareil et n’est envoyée nulle part.', 'Your voice is analysed on this device and sent nowhere.')}</p>
            <button className="btn primary" onClick={askMic}><IconMic width={20} height={20} /> {L('Autoriser le micro', 'Allow the microphone')}</button>
            {err && <p style={{ color: 'var(--rework)', margin: 0 }}>{err}</p>}
          </div>
        </Paper>
      )}
      {phase === 'noise' && (
        <Paper seed="cal-noise" tape={L('Silence, [s’il vous plaît|s’il te plaît]', 'Quiet, please')}>
          <div className="stack center" style={{ ['--stack' as string]: '12px' }}>
            {noiseDb === null ? (
              <>
                <p style={{ margin: 0 }}>{L('[Restez|Reste] en silence deux secondes : j’écoute le bruit de la pièce.', 'Stay silent for two seconds: I’m listening to the room.')}</p>
                <div className="bar" style={{ maxWidth: 300, margin: '0 auto' }}><span style={{ width: `${level * 100}%`, background: 'var(--mustard)' }} /></div>
              </>
            ) : (
              <>
                <p style={{ margin: 0 }}><IconCheck width={20} height={20} style={{ color: 'var(--teal)', verticalAlign: '-4px' }} /> {noiseDb < -50 ? L('Pièce calme : idéal.', 'Quiet room: ideal.') : noiseDb < -38 ? L('Un peu de bruit de fond, ça ira.', 'A little background noise, that’s fine.') : L('La pièce est bruyante : si l’analyse hésite, [essayez|essaie] le mode « maintenir pour parler » ou un casque.', 'The room is noisy: if the analysis hesitates, try "hold to talk" or a headset.')}</p>
                {applied && <p className="small muted" style={{ margin: 0 }}>{L('Traitements du navigateur désactivés pour une analyse fidèle', 'Browser processing disabled for faithful analysis')} : echo {String(applied.echoCancellation ?? '—')}, noise {String(applied.noiseSuppression ?? '—')}, AGC {String(applied.autoGainControl ?? '—')}.</p>}
                <button className="btn primary" onClick={() => setPhase('phrases')}>{L('Continuer', 'Continue')} <IconArrowRight width={20} height={20} /></button>
              </>
            )}
          </div>
        </Paper>
      )}
      {phase === 'phrases' && cur && (
        <Paper seed={'cal-' + k} tape={`${k + 1} / ${phrases.length}`}>
          <div className="stack center" style={{ ['--stack' as string]: '14px' }}>
            <p className="small muted" style={{ margin: 0 }}>{L('[Lisez|Lis] simplement cette phrase, à [votre|ton] rythme. Ce n’est pas un test.', 'Just read this sentence at your own pace. It’s not a test.')}</p>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', margin: 0 }}>{cur.text}</p>
            <AudioButton audio={cur.audio[s.variety].m[0]} />
            <RecordButton onRecorded={onRecorded} busy={busy} />
            {engineMsg && <p className="small muted" style={{ margin: 0 }}>{engineMsg}</p>}
          </div>
        </Paper>
      )}
      {phase === 'done' && (
        <Paper seed="cal-done" tone="mint">
          <div className="stack center" style={{ ['--stack' as string]: '12px' }}>
            <Bird pose="perch" size={110} />
            <p style={{ margin: 0, fontWeight: 700 }}>{L('[Votre|Ta] voix est calibrée.', 'Your voice is calibrated.')}</p>
            <p className="small muted" style={{ margin: 0 }}>{L('La mélodie et la carte des voyelles seront affichées par rapport à [votre|ta] propre voix — jamais par rapport à une hauteur « normale ».', 'Melody and vowel map will be shown relative to your own voice — never to a "normal" pitch.')}</p>
            <button className="btn primary" onClick={onDone}>{L('Continuer', 'Continue')} <IconArrowRight width={20} height={20} /></button>
          </div>
        </Paper>
      )}
    </div>
  )
}
