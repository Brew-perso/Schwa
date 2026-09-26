/// <reference lib="webworker" />
/**
 * Schwa engine worker: everything runs on-device, no audio ever leaves the browser.
 *   fbank (Kaldi) → NeMo Conformer-CTC encoder (int8) → Schwa phone head → constrained evaluation.
 * The encoder's own BPE output gives an intelligibility transcript ("what the machine understood").
 */
import * as ort from 'onnxruntime-web/wasm'
import { fbank, toChannelsFirst } from './fbank'
import { evaluate, type EvalInput, type SylRaw } from './evaluate'
import type { Check, Level, Ref } from '../content/types'

declare const self: DedicatedWorkerGlobalScope

const BASE = (self as unknown as { SCHWA_BASE?: string }).SCHWA_BASE ?? '/'
ort.env.wasm.wasmPaths = BASE + 'ort/'
ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1)) : 1
ort.env.logLevel = 'error'

let enc: ort.InferenceSession | null = null
let head: ort.InferenceSession | null = null
let units: string[] = []
let bpe: string[] = []
let initPromise: Promise<void> | null = null

async function fetchWithProgress(url: string, onProgress: (loaded: number, total: number) => void): Promise<ArrayBuffer> {
  const cache = await caches.open('schwa-models-v1').catch(() => null)
  const hit = cache ? await cache.match(url) : undefined
  if (hit) {
    const b = await hit.arrayBuffer()
    onProgress(b.byteLength, b.byteLength)
    return b
  }
  const r = await fetch(url)
  if (!r.ok || !r.body) throw new Error(`fetch ${url} ${r.status}`)
  const total = Number(r.headers.get('content-length')) || 0
  const reader = r.body.getReader()
  const chunks: Uint8Array[] = []
  let loaded = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    loaded += value.length
    onProgress(loaded, total)
  }
  const buf = new Uint8Array(loaded)
  let o = 0
  for (const c of chunks) { buf.set(c, o); o += c.length }
  if (cache) await cache.put(url, new Response(buf.slice().buffer, { headers: { 'content-type': 'application/octet-stream' } })).catch(() => {})
  return buf.buffer
}

async function init() {
  const meta = await (await fetch(BASE + 'models/engine.json')).json() as { encoder: string; head: string; units: string[]; bpe: string; version: string }
  units = meta.units
  bpe = (await (await fetch(BASE + 'models/' + meta.bpe)).text()).split('\n').filter(Boolean).map((l) => l.split(' ')[0])
  const progress: Record<string, [number, number]> = {}
  const report = () => {
    const l = Object.values(progress).reduce((a, [x]) => a + x, 0)
    const t = Object.values(progress).reduce((a, [, y]) => a + y, 0)
    self.postMessage({ type: 'progress', loaded: l, total: t })
  }
  const [encBuf, headBuf] = await Promise.all([
    fetchWithProgress(BASE + 'models/' + meta.encoder, (a, b) => { progress.enc = [a, b]; report() }),
    fetchWithProgress(BASE + 'models/' + meta.head, (a, b) => { progress.head = [a, b]; report() }),
  ])
  const opts: ort.InferenceSession.SessionOptions = { executionProviders: ['wasm'], graphOptimizationLevel: 'all' }
  enc = await ort.InferenceSession.create(new Uint8Array(encBuf), opts)
  head = await ort.InferenceSession.create(new Uint8Array(headBuf), opts)
  // warm-up so the first real attempt is fast
  await runModels(new Float32Array(16000))
}

/** Tiny deterministic dither (as in Kaldi): digital silence would otherwise skew per-utterance normalisation. */
function dither(x: Float32Array): Float32Array {
  const y = new Float32Array(x.length)
  let seed = 12345
  for (let i = 0; i < x.length; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    y[i] = x[i] + ((seed / 0x7fffffff) - 0.5) * 6e-4
  }
  return y
}

async function runModels(raw: Float32Array) {
  const audio = dither(raw)
  const { data, frames } = fbank(audio)
  const x = new ort.Tensor('float32', toChannelsFirst(data, frames), [1, 80, frames])
  const len = new ort.Tensor('int64', BigInt64Array.from([BigInt(frames)]), [1])
  const eo = await enc!.run({ audio_signal: x, length: len })
  const bpeLp = eo['logprobs'] as ort.Tensor
  const feats = eo['enc'] as ort.Tensor
  const ho = await head!.run({ enc: feats })
  const lp = ho['logprobs'] as ort.Tensor
  return { lp: lp.data as Float32Array, T: lp.dims[1], V: lp.dims[2], bpeLp: bpeLp.data as Float32Array, Tb: bpeLp.dims[1], Vb: bpeLp.dims[2] }
}

function bpeGreedy(lp: Float32Array, T: number, V: number): string {
  let prev = -1
  const out: string[] = []
  for (let t = 0; t < T; t++) {
    let bi = 0, bv = -1e30
    for (let v = 0; v < V; v++) { const x = lp[t * V + v]; if (x > bv) { bv = x; bi = v } }
    if (bi !== prev && bi !== V - 1) out.push(bpe[bi] ?? '')
    prev = bi
  }
  return out.join('').replace(/▁/g, ' ').trim()
}

export interface EvalRequest {
  id: number
  audio: Float32Array
  ref: Ref
  checks: Check[]
  expect: EvalInput['expect']
  level: Level
  competitor?: Ref
  f0ref?: number
  transcribe?: boolean
  /** Model recording of the same text (16 kHz) + a cache key: its prosody is the reference for stress. */
  model?: { key: string; audio?: Float32Array }
}

const modelCache = new Map<string, SylRaw[]>()
async function modelProsody(req: EvalRequest): Promise<SylRaw[] | undefined> {
  if (!req.model) return undefined
  const hit = modelCache.get(req.model.key)
  if (hit) return hit
  if (!req.model.audio) return undefined
  const m = await runModels(req.model.audio)
  const r = evaluate({ audio: req.model.audio, lp: m.lp, T: m.T, V: m.V, ref: req.ref, checks: [], expect: {}, level: req.level }, units)
  if (r.qc || r.sylRaw.length !== req.ref.words.length) return undefined
  if (modelCache.size > 200) modelCache.clear()
  modelCache.set(req.model.key, r.sylRaw)
  return r.sylRaw
}

self.onmessage = async (e: MessageEvent) => {
  const msg = e.data
  try {
    if (msg.type === 'init') {
      if (!initPromise) initPromise = init()
      await initPromise
      self.postMessage({ type: 'ready' })
      return
    }
    if (msg.type === 'evaluate') {
      if (!initPromise) initPromise = init()
      await initPromise
      const req = msg.req as EvalRequest
      const t0 = performance.now()
      const m = await runModels(req.audio)
      const tModel = performance.now() - t0
      const model = await modelProsody(req).catch(() => undefined)
      const result = evaluate({ audio: req.audio, lp: m.lp, T: m.T, V: m.V, ref: req.ref, checks: req.checks, expect: req.expect, level: req.level, competitor: req.competitor, f0ref: req.f0ref, model }, units)
      const transcript = req.transcribe !== false ? bpeGreedy(m.bpeLp, m.Tb, m.Vb) : undefined
      self.postMessage({ type: 'result', id: req.id, result: { ...result, transcript, modelMs: tModel } })
      return
    }
    if (msg.type === 'hasModel') {
      self.postMessage({ type: 'hasModel', id: msg.id, has: modelCache.has(msg.key) })
      return
    }
    if (msg.type === 'transcribe') {
      if (!initPromise) initPromise = init()
      await initPromise
      const m = await runModels(msg.audio as Float32Array)
      self.postMessage({ type: 'transcript', id: msg.id, text: bpeGreedy(m.bpeLp, m.Tb, m.Vb) })
    }
  } catch (err) {
    self.postMessage({ type: 'error', id: msg?.req?.id ?? msg?.id, message: String((err as Error)?.message ?? err) })
  }
}
