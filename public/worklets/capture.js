// Schwa capture worklet: runs on the audio thread (no UI jank). Posts ~20 ms chunks of raw samples + RMS level.
class CaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.buf = new Float32Array(Math.round(sampleRate * 0.02))
    this.n = 0
    this.active = true
    this.port.onmessage = (e) => { if (e.data === 'stop') this.active = false }
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0]
    if (!ch) return this.active
    for (let i = 0; i < ch.length; i++) {
      this.buf[this.n++] = ch[i]
      if (this.n === this.buf.length) {
        let s = 0, pk = 0
        for (let k = 0; k < this.n; k++) { const v = this.buf[k]; s += v * v; const a = v < 0 ? -v : v; if (a > pk) pk = a }
        const out = this.buf.slice(0, this.n)
        this.port.postMessage({ samples: out, rms: Math.sqrt(s / this.n), peak: pk }, [out.buffer])
        this.n = 0
      }
    }
    return this.active
  }
}
registerProcessor('schwa-capture', CaptureProcessor)
