/// <reference lib="webworker" />
/** Silero VAD (MIT) in its own worker: ~1 ms per 32 ms frame, so it never waits behind the engine. */
import * as ort from 'onnxruntime-web/wasm'
declare const self: DedicatedWorkerGlobalScope

ort.env.wasm.wasmPaths = '/ort/'
ort.env.wasm.numThreads = 1
ort.env.logLevel = 'error'

let sess: ort.InferenceSession | null = null
let h = new Float32Array(2 * 64)
let c = new Float32Array(2 * 64)

self.onmessage = async (e: MessageEvent) => {
  const m = e.data
  try {
    if (m.type === 'init') {
      if (!sess) sess = await ort.InferenceSession.create('/models/silero_vad.onnx', { executionProviders: ['wasm'] })
      self.postMessage({ type: 'ready' })
    } else if (m.type === 'reset') {
      h = new Float32Array(128); c = new Float32Array(128)
    } else if (m.type === 'frame' && sess) {
      const out = await sess.run({
        x: new ort.Tensor('float32', m.frame as Float32Array, [1, 512]),
        h: new ort.Tensor('float32', h, [2, 1, 64]),
        c: new ort.Tensor('float32', c, [2, 1, 64]),
      })
      h = (out.new_h.data as Float32Array).slice()
      c = (out.new_c.data as Float32Array).slice()
      self.postMessage({ type: 'prob', p: (out.prob.data as Float32Array)[0], seq: m.seq })
    }
  } catch (err) {
    self.postMessage({ type: 'error', message: String(err) })
  }
}
