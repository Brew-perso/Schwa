import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Cross-origin isolation enables multi-threaded WebAssembly for the on-device speech engine.
const isolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
}

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: 'Schwa — prononciation anglaise',
        short_name: 'Schwa',
        description: 'Gagnez en clarté en anglais : prononciation pour francophones, A2 → C1.',
        lang: 'fr',
        start_url: '/',
        display: 'standalone',
        background_color: '#f4ecdc',
        theme_color: '#17203b',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2,png,json}'],
        globIgnores: ['**/audio/**', '**/models/**', 'content/targets/**'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallbackDenylist: [/^\/audio\//, /^\/models\//],
        runtimeCaching: [
          { urlPattern: ({ url }) => url.pathname.startsWith('/audio/'), handler: 'CacheFirst', options: { cacheName: 'schwa-audio', expiration: { maxEntries: 8000 } } },
          { urlPattern: ({ url }) => url.pathname.startsWith('/content/'), handler: 'StaleWhileRevalidate', options: { cacheName: 'schwa-content' } },
          { urlPattern: ({ url }) => url.pathname.endsWith('.wasm'), handler: 'CacheFirst', options: { cacheName: 'schwa-runtime' } },
        ],
      },
    }),
  ],
  worker: { format: 'es' },
  optimizeDeps: { exclude: ['onnxruntime-web'] },
  server: { headers: isolation },
  preview: { headers: isolation },
  build: { target: 'es2022', chunkSizeWarningLimit: 1200 },
})
