/**
 * Web Audio playback (sample-accurate segments via AudioBufferSourceNode — spec "Réécoute et comparaison").
 * Model and learner are played at matched loudness. A/B: model → me → model with one button.
 */
import { audioUrl } from '../content/loader'
import { getAudioContext, unlockAudio } from './recorder'
import { loudnessGain, timeStretch } from './dsp'

const cache = new Map<string, Promise<AudioBuffer>>()
let current: AudioBufferSourceNode | null = null
let currentGain: GainNode | null = null
let seqToken = 0
const listeners = new Set<(playing: string | null) => void>()
let playingId: string | null = null

function setPlaying(id: string | null) { playingId = id; listeners.forEach((l) => l(id)) }
export function onPlaying(l: (id: string | null) => void) { listeners.add(l); return () => { listeners.delete(l) } }
export function currentlyPlaying() { return playingId }

export function loadBuffer(key: string): Promise<AudioBuffer> {
  let p = cache.get(key)
  if (!p) {
    p = fetch(audioUrl(key))
      .then((r) => { if (!r.ok) throw new Error('audio ' + key); return r.arrayBuffer() })
      .then((b) => getAudioContext().decodeAudioData(b))
    p.catch(() => cache.delete(key))
    cache.set(key, p)
  }
  return p
}

export function preload(keys: string[]) { keys.forEach((k) => void loadBuffer(k).catch(() => {})) }

function stopCurrent() {
  const c = current
  current = null
  try { c?.stop() } catch { /* not started */ }
}

export function stopAll() {
  seqToken++
  stopCurrent()
  setPlaying(null)
}

export interface PlayOpts { start?: number; end?: number; gain?: number; id?: string }

export async function playBuffer(buf: AudioBuffer, opts: PlayOpts = {}): Promise<void> {
  const c = await unlockAudio()
  stopCurrent()
  return new Promise((resolve) => {
    const src = c.createBufferSource()
    src.buffer = buf
    const g = c.createGain()
    g.gain.value = opts.gain ?? 1
    src.connect(g).connect(c.destination)
    current = src
    currentGain = g
    const start = Math.max(0, opts.start ?? 0)
    const dur = opts.end !== undefined ? Math.max(0.05, opts.end - start) : undefined
    src.onended = () => { if (current === src) { current = null; setPlaying(null) } resolve() }
    setPlaying(opts.id ?? 'x')
    // short fade-in to avoid clicks when playing a segment
    g.gain.setValueAtTime(0, c.currentTime)
    g.gain.linearRampToValueAtTime(opts.gain ?? 1, c.currentTime + 0.008)
    if (dur !== undefined) src.start(0, start, dur + 0.03)
    else src.start(0, start)
  })
}
void currentGain

export async function playKey(key: string, opts: PlayOpts = {}) {
  const b = await loadBuffer(key)
  return playBuffer(b, { id: key, ...opts })
}

/** Make an AudioBuffer from a learner recording, loudness-matched to the models (-20 dBFS). */
export function learnerBuffer(native: Float32Array, sr: number, rate = 1): AudioBuffer {
  const c = getAudioContext()
  const g = loudnessGain(native)
  let x = native
  if (rate !== 1) x = timeStretch(native, sr, rate)
  const buf = c.createBuffer(1, x.length, sr)
  const ch = buf.getChannelData(0)
  for (let i = 0; i < x.length; i++) ch[i] = Math.max(-1, Math.min(1, x[i] * g))
  return buf
}

export async function playSequence(steps: (() => Promise<void>)[], gapMs = 280) {
  const token = ++seqToken
  for (const s of steps) {
    if (token !== seqToken) return
    await s()
    if (token !== seqToken) return
    await new Promise((r) => setTimeout(r, gapMs))
  }
}
