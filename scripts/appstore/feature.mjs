#!/usr/bin/env node
// Play Store feature graphic — 1024×500, the banner above the listing.
//
//   node scripts/appstore/feature.mjs
//
// Play crops and overlays chrome on this in some placements, so nothing
// meaningful goes within ~64px of any edge and there is no text small enough
// to matter if it gets scaled down.

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { findHeadlessShell, REPO } from './frame.mjs'
import { THEME } from './shots.mjs'

const W = 1024
const H = 500
const outDir = join(REPO, 'scripts/appstore/out/android')
const tmpDir = join(REPO, 'scripts/appstore/.tmp/android')
const png = join(outDir, 'feature-graphic.png')

const iconPath = join(REPO, 'brand/app-icon-1024.png')
if (!existsSync(iconPath)) throw new Error(`app icon missing: ${iconPath}`)
const icon = `data:image/png;base64,${readFileSync(iconPath).toString('base64')}`

const html = `<!doctype html>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${W}px; height: ${H}px; overflow: hidden; }
  body {
    background: ${THEME.base};
    font-family: -apple-system, "SF Pro Display", system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
    position: relative;
  }
  .glow {
    position: absolute; inset: 0;
    background:
      radial-gradient(760px 420px at 22% 52%, rgba(18,100,178,0.50) 0%, transparent 70%),
      radial-gradient(560px 300px at 92% 6%, rgba(58,78,190,0.30) 0%, transparent 72%);
  }
  .vignette {
    position: absolute; inset: 0;
    background: radial-gradient(120% 90% at 30% 50%, transparent 42%, ${THEME.vignette} 100%);
  }
  .row {
    position: relative; height: 100%;
    display: flex; align-items: center; gap: 44px;
    padding: 0 76px;
  }
  .icon {
    width: 188px; height: 188px; border-radius: 42px; flex: none;
    box-shadow: 0 18px 44px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(255,255,255,0.10);
  }
  .word {
    font-size: 66px; font-weight: 660; letter-spacing: -0.033em;
    color: ${THEME.headline}; line-height: 1.04;
  }
  .word em { font-style: normal; color: #63B3F6; }
  .tag {
    margin-top: 14px;
    font-size: 27px; font-weight: 460; letter-spacing: -0.012em;
    color: ${THEME.sub};
  }
  .rule {
    margin-top: 22px; width: 96px; height: 4px; border-radius: 2px;
    background: linear-gradient(90deg, #63B3F6, rgba(99,179,246,0.12));
  }
</style>
<div class="glow"></div>
<div class="vignette"></div>
<div class="row">
  <img class="icon" src="${icon}">
  <div>
    <div class="word">Trader<em>Memos</em></div>
    <div class="tag">The self-hosted trading journal that shows your edge.</div>
    <div class="rule"></div>
  </div>
</div>`

mkdirSync(outDir, { recursive: true })
mkdirSync(tmpDir, { recursive: true })
const htmlPath = join(tmpDir, 'feature.html')
writeFileSync(htmlPath, html)
rmSync(png, { force: true })

try {
  execFileSync(
    findHeadlessShell(),
    [
      '--headless',
      '--no-sandbox',
      '--disable-gpu',
      '--hide-scrollbars',
      '--force-device-scale-factor=1',
      '--virtual-time-budget=4000',
      `--window-size=${W},${H}`,
      `--screenshot=${png}`,
      `file://${htmlPath}`,
    ],
    { stdio: 'pipe', timeout: 60_000 },
  )
} catch {
  /* the file on disk is the success signal — see frame.mjs */
}

if (!existsSync(png)) throw new Error('feature graphic render produced no file')
console.log(`→ ${png} (${W}×${H})`)
