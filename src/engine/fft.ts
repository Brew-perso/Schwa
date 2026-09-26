/** In-place iterative radix-2 FFT on separate real/imag arrays. n must be a power of two. */
export class FFT {
  n: number
  private cos: Float64Array
  private sin: Float64Array
  private rev: Uint32Array
  constructor(n: number) {
    this.n = n
    this.cos = new Float64Array(n / 2)
    this.sin = new Float64Array(n / 2)
    for (let i = 0; i < n / 2; i++) {
      this.cos[i] = Math.cos((2 * Math.PI * i) / n)
      this.sin[i] = -Math.sin((2 * Math.PI * i) / n)
    }
    this.rev = new Uint32Array(n)
    const bits = Math.log2(n)
    for (let i = 0; i < n; i++) {
      let r = 0
      for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b)
      this.rev[i] = r
    }
  }
  transform(re: Float64Array, im: Float64Array) {
    const n = this.n
    for (let i = 0; i < n; i++) {
      const j = this.rev[i]
      if (j > i) {
        let t = re[i]; re[i] = re[j]; re[j] = t
        t = im[i]; im[i] = im[j]; im[j] = t
      }
    }
    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1
      const step = n / size
      for (let i = 0; i < n; i += size) {
        for (let j = 0, k = 0; j < half; j++, k += step) {
          const tr = re[i + j + half] * this.cos[k] - im[i + j + half] * this.sin[k]
          const ti = re[i + j + half] * this.sin[k] + im[i + j + half] * this.cos[k]
          re[i + j + half] = re[i + j] - tr
          im[i + j + half] = im[i + j] - ti
          re[i + j] += tr
          im[i + j] += ti
        }
      }
    }
  }
}
