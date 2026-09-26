/** ONNX Runtime WASM files, served by Vite as hashed assets (works in dev and in the build, cached by the service worker). */
import mjs from 'onnxruntime-web/ort-wasm-simd-threaded.mjs?url'
import wasm from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url'

export const ortWasmPaths = { mjs, wasm }
