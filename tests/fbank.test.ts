import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fbank } from '../src/engine/fbank'

describe('fbank', () => {
  it('matches kaldi-native-fbank (+ CMVN) within tolerance', () => {
    const ref = JSON.parse(readFileSync(new URL('./fixtures/fbank_ref.json', import.meta.url), 'utf8'))
    const audio = Float32Array.from(ref.audio as number[])
    const { data, frames } = fbank(audio)
    expect(frames).toBe(ref.T)
    let maxErr = 0
    for (let t = 0; t < frames; t++) for (let b = 0; b < 80; b++) maxErr = Math.max(maxErr, Math.abs(data[t * 80 + b] - ref.norm[t][b]))
    expect(maxErr).toBeLessThan(0.02)
  })
})
