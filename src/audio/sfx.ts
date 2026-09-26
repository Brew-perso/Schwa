/**
 * UI sound design, synthesised on the fly (no files): celesta-like chimes, a warm vibraphone third,
 * a soft paper swish. Deliberately gentle — no buzzer, nothing that sounds like "wrong".
 */
import { getAudioContext } from './recorder'
import { useSettings } from '../data/settings'

type Sfx = 'listen' | 'captured' | 'right' | 'miss' | 'page' | 'milestone' | 'tick' | 'open'

function vol() { return useSettings.getState().s.sfx }

function bell(c: AudioContext, out: AudioNode, t: number, f: number, dur: number, amp: number) {
  // celesta / music-box: sine + inharmonic partials with fast decay
  const partials: [number, number][] = [[1, 1], [2.76, 0.35], [5.4, 0.12], [8.9, 0.05]]
  for (const [m, a] of partials) {
    const o = c.createOscillator()
    o.type = 'sine'
    o.frequency.value = f * m
    const g = c.createGain()
    g.gain.setValueAtTime(0, t)
    g.gain.linearRampToValueAtTime(amp * a, t + 0.004)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur / (m * 0.6 + 0.4))
    o.connect(g).connect(out)
    o.start(t)
    o.stop(t + dur + 0.05)
  }
}

function vibes(c: AudioContext, out: AudioNode, t: number, f: number, dur: number, amp: number) {
  const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f
  const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 4.01
  const g = c.createGain(), g2 = c.createGain()
  const trem = c.createOscillator(); trem.frequency.value = 5.2
  const tg = c.createGain(); tg.gain.value = amp * 0.18
  trem.connect(tg).connect(g.gain)
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(amp, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  g2.gain.setValueAtTime(0, t); g2.gain.linearRampToValueAtTime(amp * 0.12, t + 0.005); g2.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.3)
  o.connect(g).connect(out); o2.connect(g2).connect(out)
  o.start(t); o2.start(t); trem.start(t)
  o.stop(t + dur + 0.05); o2.stop(t + dur); trem.stop(t + dur)
}

function swish(c: AudioContext, out: AudioNode, t: number, dur: number, amp: number) {
  const n = Math.floor(c.sampleRate * dur)
  const b = c.createBuffer(1, n, c.sampleRate)
  const d = b.getChannelData(0)
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.sin((Math.PI * i) / n) ** 2
  const s = c.createBufferSource(); s.buffer = b
  const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.8
  f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(3800, t + dur)
  const g = c.createGain(); g.gain.value = amp
  s.connect(f).connect(g).connect(out)
  s.start(t)
}

function knock(c: AudioContext, out: AudioNode, t: number, amp: number) {
  const o = c.createOscillator(); o.type = 'triangle'
  o.frequency.setValueAtTime(330, t); o.frequency.exponentialRampToValueAtTime(190, t + 0.12)
  const g = c.createGain()
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(amp, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22)
  o.connect(g).connect(out); o.start(t); o.stop(t + 0.3)
}

export function sfx(kind: Sfx) {
  const v = vol()
  if (v <= 0) return
  let c: AudioContext
  try { c = getAudioContext() } catch { return }
  if (c.state !== 'running') return
  const out = c.createGain()
  out.gain.value = v * 0.5
  // gentle room: short feedback delay
  const dl = c.createDelay(); dl.delayTime.value = 0.11
  const fb = c.createGain(); fb.gain.value = 0.22
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3200
  out.connect(c.destination)
  out.connect(dl); dl.connect(lp).connect(fb).connect(dl); lp.connect(c.destination)
  const t = c.currentTime + 0.01
  switch (kind) {
    case 'listen': bell(c, out, t, 659.25, 0.9, 0.22); bell(c, out, t + 0.09, 987.77, 1.1, 0.2); break
    case 'captured': bell(c, out, t, 987.77, 0.6, 0.14); bell(c, out, t + 0.08, 739.99, 0.8, 0.14); break
    case 'right': vibes(c, out, t, 523.25, 1.1, 0.24); vibes(c, out, t + 0.07, 659.25, 1.2, 0.2); break
    case 'miss': knock(c, out, t, 0.22); break
    case 'page': swish(c, out, t, 0.22, 0.08); break
    case 'milestone': [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => bell(c, out, t + i * 0.085, f, 1.4, 0.18)); break
    case 'tick': knock(c, out, t, 0.06); break
    case 'open': bell(c, out, t, 783.99, 0.9, 0.12); break
  }
}
