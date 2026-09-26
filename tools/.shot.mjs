import { chromium } from '@playwright/test'
const [url, out, w, h] = process.argv.slice(2)
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-fake-ui-for-media-stream'] })
const p = await b.newPage({ viewport: { width: +w || 1200, height: +h || 900 }, deviceScaleFactor: 1 })
p.on('console', m => { if (m.type() === 'error') console.log('console:', m.text()) })
await p.goto(url, { waitUntil: 'networkidle' })
await p.waitForTimeout(800)
await p.screenshot({ path: out, fullPage: true })
await b.close()
