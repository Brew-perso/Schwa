// Copies the ONNX Runtime Web WASM runtime into public/ort (served from our own origin: no CDN, works offline).
import { copyFileSync, mkdirSync } from 'node:fs'
const src = 'node_modules/onnxruntime-web/dist/'
mkdirSync('public/ort', { recursive: true })
for (const f of ['ort-wasm-simd-threaded.wasm', 'ort-wasm-simd-threaded.mjs']) copyFileSync(src + f, 'public/ort/' + f)
console.log('ORT runtime copied to public/ort')
