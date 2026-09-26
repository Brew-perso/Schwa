import { useEffect, useState } from 'react'
import { IconPlay, IconSlow, IconVolume } from '../art/Icons'
import { currentlyPlaying, onPlaying, playKey, stopAll } from '../audio/player'
import type { AudioRef } from '../content/types'

export function usePlaying() {
  const [p, setP] = useState<string | null>(currentlyPlaying())
  useEffect(() => onPlaying(setP), [])
  return p
}

/** Round play button for a model recording. */
export function AudioButton({ audio, label, size = 'md', slow = false, className = '', onPlayed, start, end }: {
  audio?: AudioRef | null; label?: string; size?: 'sm' | 'md' | 'lg'; slow?: boolean; className?: string; onPlayed?: () => void; start?: number; end?: number
}) {
  const playing = usePlaying()
  const active = !!audio && playing === audio.f
  const dim = size === 'lg' ? 64 : size === 'sm' ? 38 : 48
  return (
    <button
      type="button"
      className={`audio-btn ${active ? 'is-playing' : ''} ${className}`}
      style={{ width: dim, height: dim }}
      disabled={!audio}
      aria-label={label ?? 'Écouter'}
      title={label}
      onClick={(e) => {
        e.stopPropagation()
        if (!audio) return
        if (active) { stopAll(); return }
        void playKey(audio.f, { start, end }).then(() => onPlayed?.())
      }}
    >
      {slow ? <IconSlow /> : active ? <IconVolume /> : <IconPlay />}
      {active && <span className="audio-ripple" aria-hidden="true" />}
    </button>
  )
}
