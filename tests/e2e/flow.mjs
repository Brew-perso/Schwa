/**
 * End-to-end walkthrough with a fake microphone (Chromium plays a WAV file as mic input).
 *   node tests/e2e/flow.mjs <baseUrl> <outDir> <mic.wav>
 * Takes a screenshot at every step and reports console errors.
 */
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const [base = 'http://localhost:5173', out = 'test-results/e2e', wav] = process.argv.slice(2)
mkdirSync(out, { recursive: true })
const args = ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required']
if (wav) args.push(`--use-file-for-fake-audio-capture=${wav}`)
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args })
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, permissions: ['microphone'] })
const p = await ctx.newPage()
const errors = []
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
p.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
let n = 0
const shot = async (name) => { await p.waitForTimeout(500); await p.screenshot({ path: `${out}/${String(++n).padStart(2, '0')}-${name}.png`, fullPage: true }); console.log('shot', n, name, p.url()) }
const click = async (re) => { const l = p.getByRole('button', { name: re }).first(); if (await l.count()) { await l.click(); return true } return false }

await p.goto(base + '/welcome', { waitUntil: 'networkidle' })
await shot('welcome')
await click(/Faisons connaissance/)
for (let i = 0; i < 8 && p.url().includes('/welcome'); i++) {
  await shot('onboarding')
  if (await click(/Passer cette étape/)) continue
  if (await click(/Passer — je choisirai/)) break
  const choice = p.locator('.choice[aria-pressed="false"]').first()
  if (await choice.count()) await choice.click()
  const chips = p.locator('.chip')
  if (await chips.count()) for (let k = 0; k < await chips.count(); k += 5) await chips.nth(k + 3).click().catch(() => {})
  if (!(await click(/^Suivant/))) await click(/Commencer|Continuer|C'est parti|Terminer/)
}
await p.waitForTimeout(800)
await shot('today')
await p.goto(base + '/map'); await shot('map')
const target = process.env.TARGET || 'a2-h'
await p.goto(base + '/target/' + target); await shot('target')
for (const step of ['discover', 'hear', 'produce', 'guided', 'transfer']) {
  await p.goto(`${base}/target/${target}/${step}`)
  await p.waitForTimeout(1500)
  await shot(step)
  if (step === 'produce') {
    // say each displayed item with another voice than the model (dev hook), several items in a row
    const content = await (await fetch(`${base}/content/targets/${target}.json`)).json()
    const all = [...content.production, ...content.guided]
    for (let k = 0; k < Number(process.env.ITEMS || 3); k++) {
      const text = await p.locator('[data-item-text]').first().getAttribute('data-item-text').catch(() => null)
      if (!text) break
      let audio
      for (const it of all) {
        const cands = it.pair ? it.pair.map((x) => [x.text, x.audio]) : [[it.text, it.audio]]
        for (const [t, a] of cands) if (t === text && a?.GA?.m) audio = a.GA.m[1]?.f ?? a.GA.m[0].f
      }
      const wrong = process.env.WRONG ? all.find((it) => it.text && it.text !== text)?.audio?.GA?.m[1]?.f : null
      const f = wrong || audio
      if (!f) { console.log('no audio for', text); break }
      await p.evaluate((u) => { window.__schwaNextAudio = u }, `/audio/${f}.mp3`)
      await p.getByRole('button', { name: /parler|speak/i }).first().click()
      await p.waitForSelector('.fb-card', { timeout: 60000 }).catch(() => console.log('no result element'))
      await p.waitForTimeout(800)
      const verdict = await p.locator('.fb-card').first().innerText().catch(() => '')
      console.log(`said «${text}»${wrong ? ' (WRONG TEXT)' : ''} →`, verdict.split('\n').slice(0, 2).join(' | '))
      await shot('produce-result')
      if (!(await click(/^Suivant|^Next/))) break
      await p.waitForTimeout(600)
    }
  }
}
for (const r of ['/journal', '/settings', '/teacher', '/about', '/session']) { await p.goto(base + r); await shot(r.slice(1)) }
console.log('errors:', errors.length ? errors.join('\n') : 'none')
await b.close()
