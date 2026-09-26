import type { EvalRequest } from './worker'
import type { EvalResult } from './evaluate'
import { loadBuffer } from '../audio/player'
import { resampleTo16k } from '../audio/dsp'

const sentModels = new Set<string>()
/** Decode the model recording once, so the worker can analyse its prosody with the same pipeline. */
async function modelPayload(key?: string): Promise<EvalRequest['model']> {
  if (!key) return undefined
  if (sentModels.has(key)) return { key }
  try {
    const b = await loadBuffer(key)
    const audio = resampleTo16k(b.getChannelData(0), b.sampleRate)
    sentModels.add(key)
    return { key, audio }
  } catch { return undefined }
}

export type FullResult = EvalResult & { transcript?: string; modelMs?: number }
type Listener = (s: EngineStatus) => void
export interface EngineStatus { state: 'idle' | 'loading' | 'ready' | 'error'; loaded: number; total: number; error?: string }

let worker: Worker | null = null
let status: EngineStatus = { state: 'idle', loaded: 0, total: 0 }
const listeners = new Set<Listener>()
const pending = new Map<number, { res: (r: FullResult) => void; rej: (e: Error) => void }>()
const pendingT = new Map<number, (t: string) => void>()
let nextId = 1
let readyPromise: Promise<void> | null = null

function setStatus(s: Partial<EngineStatus>) {
  status = { ...status, ...s }
  listeners.forEach((l) => l(status))
}

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e) => {
      const m = e.data
      if (m.type === 'progress') setStatus({ state: 'loading', loaded: m.loaded, total: m.total })
      else if (m.type === 'ready') setStatus({ state: 'ready' })
      else if (m.type === 'result') { pending.get(m.id)?.res(m.result); pending.delete(m.id) }
      else if (m.type === 'transcript') { pendingT.get(m.id)?.(m.text); pendingT.delete(m.id) }
      else if (m.type === 'error') {
        if (m.id && pending.has(m.id)) { pending.get(m.id)!.rej(new Error(m.message)); pending.delete(m.id) }
        else setStatus({ state: 'error', error: m.message })
      }
    }
  }
  return worker
}

export const engine = {
  get status() { return status },
  subscribe(l: Listener) { listeners.add(l); l(status); return () => { listeners.delete(l) } },
  init(): Promise<void> {
    if (!readyPromise) {
      setStatus({ state: 'loading' })
      readyPromise = new Promise((resolve, reject) => {
        const w = getWorker()
        const off = engine.subscribe((s) => {
          if (s.state === 'ready') { off(); resolve() }
          if (s.state === 'error') { off(); readyPromise = null; reject(new Error(s.error)) }
        })
        w.postMessage({ type: 'init' })
      })
    }
    return readyPromise
  },
  async evaluate(req: Omit<EvalRequest, 'id' | 'model'> & { modelKey?: string }): Promise<FullResult> {
    const id = nextId++
    const w = getWorker()
    const { modelKey, ...rest } = req
    const model = await modelPayload(modelKey)
    return new Promise((res, rej) => {
      pending.set(id, { res, rej })
      const audio = rest.audio.slice()
      const tr: Transferable[] = [audio.buffer]
      if (model?.audio) tr.push(model.audio.buffer)
      w.postMessage({ type: 'evaluate', req: { ...rest, audio, id, model } }, tr)
    })
  },
  transcribe(audio: Float32Array): Promise<string> {
    const id = nextId++
    const w = getWorker()
    return new Promise((res) => {
      pendingT.set(id, res)
      const a = audio.slice()
      w.postMessage({ type: 'transcribe', audio: a, id }, [a.buffer])
    })
  },
}
