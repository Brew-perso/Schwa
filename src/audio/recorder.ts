/**
 * Microphone capture with automatic end-of-speech detection (no "stop" button to aim for — charte §2.1).
 *  - getUserMedia with echo cancellation / noise suppression / AGC disabled (they distort formants & F0)
 *  - AudioWorklet on the audio thread, native sample rate kept for instant, faithful playback
 *  - Silero VAD (neural) → end of utterance after `silenceMs` of silence, 300 ms pre-roll
 *  - "hold to talk" fallback for noisy rooms
 */
import { resampleTo16k, StreamingDecimator } from './dsp'

export interface Recording {
  native: Float32Array
  sampleRate: number
  audio16k: Float32Array
  durationMs: number
  endedBy: 'vad' | 'manual' | 'max' | 'timeout'
  appliedConstraints?: MediaTrackSettings
}

export interface RecordOptions {
  mode: 'vad' | 'hold'
  silenceMs: number
  maxMs: number
  noSpeechTimeoutMs?: number
  onLevel?: (rms: number, peak: number) => void
  onSpeech?: (speaking: boolean) => void
}

let ctx: AudioContext | null = null
let stream: MediaStream | null = null
let source: MediaStreamAudioSourceNode | null = null
let vadWorker: Worker | null = null
let vadReady: Promise<boolean> | null = null
let workletLoaded = false

export function micSupported() {
  return !!(navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function' && (window.AudioContext || (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext))
}

export function getAudioContext(): AudioContext {
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    ctx = new AC({ latencyHint: 'interactive' })
  }
  return ctx
}

/** Must be called from a user gesture on iOS Safari. */
export async function unlockAudio() {
  const c = getAudioContext()
  if (c.state !== 'running') await c.resume().catch(() => {})
  return c
}

export async function openMic(deviceId?: string): Promise<MediaStreamAudioSourceNode> {
  const c = await unlockAudio()
  if (source && stream && stream.getAudioTracks()[0]?.readyState === 'live') return source
  const supported = navigator.mediaDevices.getSupportedConstraints?.() ?? {}
  const audio: MediaTrackConstraints = { channelCount: 1 }
  if (supported.echoCancellation) audio.echoCancellation = false
  if (supported.noiseSuppression) audio.noiseSuppression = false
  if (supported.autoGainControl) audio.autoGainControl = false
  if (deviceId) audio.deviceId = { exact: deviceId }
  stream = await navigator.mediaDevices.getUserMedia({ audio })
  source = c.createMediaStreamSource(stream)
  if (!workletLoaded) {
    await c.audioWorklet.addModule('/worklets/capture.js')
    workletLoaded = true
  }
  return source
}

export function closeMic() {
  stream?.getTracks().forEach((t) => t.stop())
  stream = null
  source = null
}

export function micSettings(): MediaTrackSettings | undefined {
  return stream?.getAudioTracks()[0]?.getSettings()
}

function ensureVad(): Promise<boolean> {
  if (!vadReady) {
    vadReady = new Promise((resolve) => {
      try {
        vadWorker = new Worker(new URL('./vad.worker.ts', import.meta.url), { type: 'module' })
        const t = setTimeout(() => resolve(false), 8000)
        vadWorker.onmessage = (e) => { if (e.data.type === 'ready') { clearTimeout(t); resolve(true) } if (e.data.type === 'error') { clearTimeout(t); resolve(false) } }
        vadWorker.postMessage({ type: 'init' })
      } catch { resolve(false) }
    })
  }
  return vadReady
}
export function preloadVad() { void ensureVad() }

export interface ActiveRecording {
  done: Promise<Recording>
  stop: () => void
  cancel: () => void
}

export async function record(opts: RecordOptions): Promise<ActiveRecording> {
  // dev-only end-to-end test hook: "speak" a given audio file instead of the microphone
  const testUrl = import.meta.env.DEV ? (window as unknown as { __schwaNextAudio?: string }).__schwaNextAudio : undefined
  if (testUrl) return testRecording(testUrl)
  const src = await openMic()
  const c = getAudioContext()
  const sr = c.sampleRate
  const node = new AudioWorkletNode(c, 'schwa-capture', { numberOfInputs: 1, numberOfOutputs: 0, channelCount: 1 })
  src.connect(node)
  const hasVad = opts.mode === 'vad' ? await ensureVad() : false
  if (hasVad) vadWorker!.postMessage({ type: 'reset' })

  const chunks: Float32Array[] = []
  const dec = new StreamingDecimator(sr)
  let vadBuf = new Float32Array(0)
  let seq = 0
  let speaking = false
  let speechStartChunk = -1
  let lastSpeechMs = 0
  let above = 0
  let noiseFloor = 1e-4
  const startedAt = performance.now()
  const chunkMs = 20
  let resolveDone!: (r: Recording) => void
  let rejectDone!: (e: Error) => void
  const done = new Promise<Recording>((res, rej) => { resolveDone = res; rejectDone = rej })
  let finished = false

  const finish = (endedBy: Recording['endedBy']) => {
    if (finished) return
    finished = true
    node.port.postMessage('stop')
    node.port.onmessage = null
    try { src.disconnect(node) } catch { /* already disconnected */ }
    if (vadWorker) vadWorker.onmessage = null
    // keep 300 ms pre-roll before detected speech and ~200 ms after the end
    const pre = Math.round(300 / chunkMs)
    const first = speechStartChunk >= 0 ? Math.max(0, speechStartChunk - pre) : 0
    let lastIdx = chunks.length
    if (endedBy === 'vad') lastIdx = Math.min(chunks.length, Math.round(lastSpeechMs / chunkMs) + 10)
    const used = chunks.slice(first, lastIdx)
    const len = used.reduce((a, b) => a + b.length, 0)
    const native = new Float32Array(len)
    let o = 0
    for (const ch of used) { native.set(ch, o); o += ch.length }
    const audio16k = resampleTo16k(native, sr)
    resolveDone({ native, sampleRate: sr, audio16k, durationMs: (native.length / sr) * 1000, endedBy, appliedConstraints: micSettings() })
  }

  const onVadProb = (p: number, s: number) => {
    const tMs = (s * 512 * 1000) / 16000
    if (!speaking) {
      if (p > 0.55) { above++ } else above = 0
      if (above >= 2) {
        speaking = true
        speechStartChunk = Math.max(0, Math.floor((tMs - 64) / chunkMs))
        lastSpeechMs = tMs
        opts.onSpeech?.(true)
      }
    } else {
      if (p > 0.35) lastSpeechMs = tMs
      else if (tMs - lastSpeechMs > opts.silenceMs) { opts.onSpeech?.(false); finish('vad') }
    }
  }
  if (hasVad) vadWorker!.onmessage = (e) => { if (e.data.type === 'prob') onVadProb(e.data.p, e.data.seq) }

  node.port.onmessage = (e) => {
    const { samples, rms, peak } = e.data as { samples: Float32Array; rms: number; peak: number }
    chunks.push(samples)
    opts.onLevel?.(rms, peak)
    const elapsed = performance.now() - startedAt
    if (opts.mode === 'vad') {
      if (hasVad) {
        const d = dec.push(samples.slice())
        const merged = new Float32Array(vadBuf.length + d.length)
        merged.set(vadBuf); merged.set(d, vadBuf.length)
        vadBuf = merged
        while (vadBuf.length >= 512) {
          vadWorker!.postMessage({ type: 'frame', frame: vadBuf.slice(0, 512), seq: seq++ })
          vadBuf = vadBuf.slice(512)
        }
      } else {
        // energy fallback (VAD unavailable): adaptive threshold above the noise floor
        if (chunks.length < 10) noiseFloor = Math.max(noiseFloor, rms)
        const t = Math.max(0.012, noiseFloor * 3.5)
        const ms = chunks.length * chunkMs
        if (rms > t) {
          if (!speaking) { speaking = true; speechStartChunk = Math.max(0, chunks.length - 3); opts.onSpeech?.(true) }
          lastSpeechMs = ms
        } else if (speaking && ms - lastSpeechMs > opts.silenceMs) { opts.onSpeech?.(false); finish('vad') }
      }
      if (!speaking && elapsed > (opts.noSpeechTimeoutMs ?? 9000)) finish('timeout')
    }
    if (elapsed > opts.maxMs) finish('max')
  }

  return {
    done,
    stop: () => finish(speaking || opts.mode === 'hold' ? 'manual' : 'timeout'),
    cancel: () => { if (!finished) { finished = true; node.port.postMessage('stop'); try { src.disconnect(node) } catch { /* noop */ } rejectDone(new Error('cancelled')) } },
  }
}

async function testRecording(url: string): Promise<ActiveRecording> {
  const c = getAudioContext()
  const buf = await c.decodeAudioData(await (await fetch(url)).arrayBuffer())
  const pad = new Float32Array(Math.round(buf.sampleRate * 0.3))
  const x = buf.getChannelData(0)
  const native = new Float32Array(pad.length * 2 + x.length)
  native.set(x, pad.length)
  for (let i = 0; i < native.length; i++) native[i] += (Math.random() - 0.5) * 2e-3
  const rec: Recording = { native, sampleRate: buf.sampleRate, audio16k: resampleTo16k(native, buf.sampleRate), durationMs: (native.length / buf.sampleRate) * 1000, endedBy: 'vad' }
  return { done: new Promise((r) => setTimeout(() => r(rec), 300)), stop: () => {}, cancel: () => {} }
}
