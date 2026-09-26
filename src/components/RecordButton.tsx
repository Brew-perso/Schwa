import { useEffect, useRef, useState } from 'react'
import { IconMic } from '../art/Icons'
import { record, type ActiveRecording, type Recording, micSupported, preloadVad } from '../audio/recorder'
import { stopAll } from '../audio/player'
import { sfx } from '../audio/sfx'
import { useSettings } from '../data/settings'
import { useT } from '../i18n'

type Phase = 'idle' | 'listening' | 'speaking' | 'processing' | 'error'

/**
 * The big microphone. Tap once and speak: recording stops by itself when you stop talking (VAD).
 * "Hold to talk" is available in settings for noisy rooms. No timer, no countdown.
 */
export function RecordButton({ onRecorded, busy = false, maxMs = 12000, disabled, silenceMs, label, size = 104 }: {
  onRecorded: (r: Recording) => void | Promise<void>
  busy?: boolean
  maxMs?: number
  disabled?: boolean
  silenceMs?: number
  label?: string
  size?: number
}) {
  const t = useT()
  const s = useSettings((st) => st.s)
  const [phase, setPhase] = useState<Phase>('idle')
  const [err, setErr] = useState<string | null>(null)
  const [level, setLevel] = useState(0)
  const rec = useRef<ActiveRecording | null>(null)
  const hold = s.holdToTalk

  useEffect(() => { preloadVad() }, [])
  useEffect(() => () => { rec.current?.cancel() }, [])
  useEffect(() => { if (!busy && phase === 'processing') setPhase('idle') }, [busy, phase])

  const start = async () => {
    if (phase === 'listening' || phase === 'speaking') { rec.current?.stop(); return }
    if (!micSupported()) { setErr(t('rec_denied')); setPhase('error'); return }
    setErr(null)
    stopAll()
    try {
      const r = await record({
        mode: hold ? 'hold' : 'vad',
        silenceMs: silenceMs ?? s.silenceMs,
        maxMs,
        onLevel: (rms) => setLevel(Math.min(1, Math.sqrt(rms) * 3.2)),
        onSpeech: (sp) => { if (sp) setPhase('speaking') },
      })
      rec.current = r
      setPhase('listening')
      sfx('listen')
      const out = await r.done
      rec.current = null
      setLevel(0)
      if (out.endedBy === 'timeout' || out.durationMs < 150) { setErr(t('rec_nothing')); setPhase('idle'); return }
      sfx('captured')
      setPhase('processing')
      await onRecorded(out)
      setPhase((p) => (p === 'processing' ? 'idle' : p))
    } catch (e) {
      rec.current = null
      setLevel(0)
      const name = (e as Error)?.name
      if ((e as Error)?.message === 'cancelled') { setPhase('idle'); return }
      setErr(name === 'NotAllowedError' || name === 'SecurityError' ? t('rec_denied') : String((e as Error)?.message ?? e))
      setPhase('error')
    }
  }

  const live = phase === 'listening' || phase === 'speaking'
  const text = err ?? (phase === 'processing' || busy ? t('rec_processing') : phase === 'speaking' ? t('rec_speaking') : phase === 'listening' ? t('rec_listening') : hold ? t('rec_hold') : (label ?? t('rec_tap')))
  return (
    <div className="rec-wrap">
      <button
        type="button"
        className={`rec-btn phase-${busy ? 'processing' : phase}`}
        style={{ width: size, height: size, ['--lvl' as string]: level.toFixed(3) }}
        disabled={disabled || busy}
        aria-label={text}
        aria-live="polite"
        onClick={hold ? undefined : start}
        onPointerDown={hold ? (e) => { e.preventDefault(); void start() } : undefined}
        onPointerUp={hold ? () => rec.current?.stop() : undefined}
        onPointerLeave={hold && live ? () => rec.current?.stop() : undefined}
      >
        <span className="rec-ring r1" aria-hidden="true" />
        <span className="rec-ring r2" aria-hidden="true" />
        <span className="rec-core"><IconMic /></span>
      </button>
      <div className={`rec-label ${err ? 'is-error' : ''}`} role="status">{text}</div>
    </div>
  )
}
