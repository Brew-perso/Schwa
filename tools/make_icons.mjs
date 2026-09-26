/**
 * Generates the favicon, PWA icons and the social preview image from the logo mark (no external assets).
 *   node tools/make_icons.mjs
 * The ə is a path extracted from Charis SIL Bold (OFL) so the icons do not depend on installed fonts.
 */
import { chromium } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const glyph = readFileSync(root + 'tools/schwa-glyph.path', 'utf8').trim()
const INK = '#1d2334', CORAL = '#e07a5f', MUSTARD = '#d6a03c', NIGHT = '#17203b', PAPER = '#f4ecdc', CREAM = '#f3ead7'

function halftone(id, color) {
  return `<pattern id="${id}" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(30)"><circle cx="1.5" cy="1.5" r=".75" fill="${color}"/></pattern>`
}
/** The planet mark on a 64×64 grid. */
function mark({ ring = INK, ink = INK } = {}) {
  return `
  <g transform="rotate(-18 32 32)"><path d="M4 34 A28 8 0 0 1 60 34" fill="none" stroke="${ring}" stroke-width="3.4" stroke-linecap="round"/></g>
  <circle cx="32" cy="32" r="19" fill="${CORAL}" stroke="${ink}" stroke-width="2.4"/>
  <clipPath id="pl"><circle cx="32" cy="32" r="17.8"/></clipPath>
  <circle cx="42" cy="42" r="16" fill="url(#ht)" opacity=".32" clip-path="url(#pl)"/>
  <path d="${glyph}" fill="${ink}"/>
  <g transform="rotate(-18 32 32)">
    <path d="M4 34 A28 8 0 0 0 60 34" fill="none" stroke="${ring}" stroke-width="3.4" stroke-linecap="round"/>
    <path d="M4 34 A28 8 0 0 0 60 34" fill="none" stroke="${MUSTARD}" stroke-width="1.3" stroke-linecap="round"/>
  </g>`
}
const star = (x, y, r, c = CREAM) => `<path d="M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r}Z" fill="${c}"/>`

// favicon: transparent, the mark alone
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs>${halftone('ht', INK)}</defs>${mark()}</svg>`
writeFileSync(root + 'public/favicon.svg', favicon)

/** App icon: night sky, a few four-point stars, the mark. `pad` shrinks the mark for maskable safe zones. */
function appIcon(pad) {
  const s = 64 * (1 - pad * 2)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64"><defs>${halftone('ht', INK)}
  <radialGradient id="sky" cx=".35" cy=".3" r=".9"><stop offset="0" stop-color="#26325a"/><stop offset="1" stop-color="${NIGHT}"/></radialGradient></defs>
  <rect width="64" height="64" fill="url(#sky)"/>
  ${star(10, 11, 1.6)}${star(54, 9, 1.1, MUSTARD)}${star(52, 53, 1.4)}${star(9, 50, 0.9, MUSTARD)}${star(47, 25, 0.7)}
  <g transform="translate(${64 * pad} ${64 * pad}) scale(${s / 64})">${mark({ ring: CREAM, ink: INK })}</g></svg>`
}

const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
async function renderSvg(svg, size, out) {
  const p = await b.newPage({ viewport: { width: size, height: size } })
  await p.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('width="64" height="64"', `width="${size}" height="${size}"`)}</body></html>`)
  await p.screenshot({ path: root + out, omitBackground: true })
  await p.close()
}
await renderSvg(appIcon(0.06), 192, 'public/icons/icon-192.png')
await renderSvg(appIcon(0.06), 512, 'public/icons/icon-512.png')
await renderSvg(appIcon(0.16), 512, 'public/icons/icon-maskable-512.png')
await renderSvg(appIcon(0.1), 180, 'public/icons/apple-touch-icon.png')

// social preview (1200×630): paper, star chart, the mark and the wordmark in the app's fonts
const fs = (p) => 'file://' + root + 'node_modules/' + p
const og = `<html><head><style>
@font-face{font-family:Fraunces;src:url(${fs('@fontsource-variable/fraunces/files/fraunces-latin-full-italic.woff2')}) format('woff2');font-style:italic;font-weight:100 900}
@font-face{font-family:Atkinson;src:url(${fs('@fontsource/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-400-normal.woff2')}) format('woff2')}
@font-face{font-family:Charis;src:url(${fs('@fontsource/charis-sil/files/charis-sil-latin-ext-400-normal.woff2')}) format('woff2')}
body{margin:0;width:1200px;height:630px;background:${PAPER};color:${INK};font-family:Atkinson;position:relative;overflow:hidden}
.w{position:absolute;left:470px;top:190px;font-family:Fraunces;font-style:italic;font-weight:600;font-size:150px;line-height:1;font-variation-settings:'SOFT' 100,'WONK' 1,'opsz' 144;letter-spacing:-.01em}
.t{position:absolute;left:478px;top:370px;font-size:34px;line-height:1.35;max-width:640px}
.i{position:absolute;left:478px;top:470px;font-family:Charis;font-size:30px;color:#2b7a76}
.card{position:absolute;inset:28px;border:2.5px solid ${INK};border-radius:6px;box-shadow:6px 7px 0 ${INK}22}
.tape{position:absolute;top:14px;left:120px;width:150px;height:34px;background:${MUSTARD}bb;transform:rotate(-4deg)}
</style></head><body><div class="card"></div><div class="tape"></div>
<svg width="1200" height="630" style="position:absolute;inset:0"><defs>${halftone('ht', INK)}</defs>
<g stroke="${INK}" stroke-width="1.4" stroke-dasharray="2 6" opacity=".45" fill="none"><path d="M90 520 L180 470 L260 505 L330 430"/><path d="M880 110 L960 150 L1060 120 L1110 170"/></g>
${[[90, 520], [180, 470], [260, 505], [330, 430], [880, 110], [960, 150], [1060, 120], [1110, 170]].map(([x, y]) => star(x, y, 7, INK)).join('')}
<g transform="translate(70 95) scale(5.6)">${mark()}</g></svg>
<div class="w">schwa</div>
<div class="t">Prononciation anglaise, de A2 à C1.<br>Écouter, comparer, s'entraîner.</div>
<div class="i">/ˈʃwɑː/ · GA &amp; SBE</div></body></html>`
const p = await b.newPage({ viewport: { width: 1200, height: 630 } })
const tmp = root + 'node_modules/.og-preview.html'
writeFileSync(tmp, og)
await p.goto('file://' + tmp, { waitUntil: 'load' })
await p.evaluate(() => document.fonts.ready)
await p.waitForTimeout(300)
await p.screenshot({ path: root + 'public/icons/og.png' })
await b.close()
console.log('icons written')
