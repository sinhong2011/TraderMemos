// Artboard renderer for App Store / Play Store marketing screenshots.
//
// Takes raw device captures and composes each one onto a branded artboard:
// gradient field, caption block, and a drawn device shell. The shell is CSS,
// not an image asset, so there is nothing to license and the frame scales to
// whatever canvas the store asks for.
//
// Rendering goes through Playwright's chrome-headless-shell, which is already
// on this machine for the web e2e suite. `--screenshot` on a file:// URL sized
// to the exact canvas gives a 1:1 PNG with no scaling step.

import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '../..')

// chrome-headless-shell ships inside the playwright browser cache. Pick the
// highest build present rather than pinning, so a playwright bump keeps working.
export function findHeadlessShell() {
  const cache = join(process.env.HOME, 'Library/Caches/ms-playwright')
  const dirs = existsSync(cache)
    ? execFileSync('ls', [cache], { encoding: 'utf8' })
        .split('\n')
        .filter((d) => d.startsWith('chromium_headless_shell-'))
        .sort((a, b) => Number(b.split('-')[1]) - Number(a.split('-')[1]))
    : []
  for (const d of dirs) {
    const bin = join(cache, d, 'chrome-headless-shell-mac-arm64/chrome-headless-shell')
    if (existsSync(bin)) return bin
  }
  throw new Error('chrome-headless-shell not found — run `pnpm exec playwright install chromium` in web/')
}

const dataUri = (p) => `data:image/png;base64,${readFileSync(p).toString('base64')}`

// The device shell is drawn at the capture's own aspect ratio, so the same
// template frames a 6.9" iPhone and a Pixel without distorting either.
function artboard(shot, theme, canvas) {
  const { w, h } = canvas
  const screen = shot.screenshot ? dataUri(shot.screenshot) : null
  const bezel = Math.round(w * 0.0068) // metal rim thickness
  const deviceW = Math.round(w * theme.deviceWidth)
  const radius = Math.round(deviceW * theme.cornerRatio)

  return `<!doctype html>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${w}px; height: ${h}px; overflow: hidden; }
  body {
    background: ${theme.base};
    font-family: -apple-system, "SF Pro Display", system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
    position: relative;
  }
  /* Brand glow. Hue shifts per shot so the set reads as a family rather than
     six copies of one slide, while the base field stays identical. */
  .glow {
    position: absolute; inset: 0;
    background:
      radial-gradient(${Math.round(w * 1.5)}px ${Math.round(h * 0.55)}px at 50% ${theme.glowY},
        ${shot.glow} 0%, transparent 68%),
      radial-gradient(${Math.round(w * 0.9)}px ${Math.round(h * 0.35)}px at 88% 8%,
        ${theme.glowSecondary} 0%, transparent 70%);
  }
  .vignette {
    position: absolute; inset: 0;
    background: radial-gradient(130% 78% at 50% 32%, transparent 40%, ${theme.vignette} 100%);
  }
  .stage {
    position: relative; height: 100%;
    display: flex; flex-direction: column; align-items: center;
    padding: ${Math.round(h * 0.052)}px ${Math.round(w * 0.072)}px 0;
    text-align: center;
  }
  .eyebrow {
    font-size: ${Math.round(w * 0.0235)}px;
    font-weight: 620;
    letter-spacing: 0.19em;
    text-transform: uppercase;
    color: ${theme.eyebrow};
    margin-bottom: ${Math.round(h * 0.0155)}px;
  }
  .headline {
    font-size: ${Math.round(w * theme.headlineSize)}px;
    line-height: 1.06;
    font-weight: 640;
    letter-spacing: -0.032em;
    color: ${theme.headline};
    text-wrap: balance;
  }
  .headline em { font-style: normal; color: ${shot.accent}; }
  .sub {
    margin-top: ${Math.round(h * 0.0125)}px;
    font-size: ${Math.round(w * 0.0292)}px;
    line-height: 1.4;
    font-weight: 450;
    letter-spacing: -0.011em;
    color: ${theme.sub};
    max-width: ${Math.round(w * 0.76)}px;
  }

  /* Device shell: metal rim, black bezel, clipped screen. */
  .device {
    position: relative;
    margin-top: ${Math.round(h * theme.deviceGap)}px;
    width: ${deviceW}px;
    border-radius: ${radius}px;
    padding: ${bezel}px;
    background: ${theme.rim};
    box-shadow:
      0 ${Math.round(h * 0.010)}px ${Math.round(h * 0.024)}px rgba(0,0,0,0.50),
      0 ${Math.round(h * 0.032)}px ${Math.round(h * 0.080)}px rgba(0,0,0,0.62),
      inset 0 1px 0 rgba(255,255,255,0.42),
      inset 0 -1px 0 rgba(255,255,255,0.16);
    flex: none;
  }
  /* Thin black bezel between the metal rim and the pixels, the way the real
     hardware reads at this size. Without it the screenshot looks pasted on. */
  .screen {
    border-radius: ${radius - bezel}px;
    overflow: hidden;
    background: #000;
    display: block;
    padding: ${Math.max(2, Math.round(w * 0.0026))}px;
  }
  .screen img {
    display: block;
    width: 100%;
    border-radius: ${radius - bezel - Math.round(w * 0.0026)}px;
  }
  /* Stand-in for a screen not yet captured. Uses a handset aspect rather than
     the canvas aspect so the preview shows the height a real capture will take. */
  .placeholder {
    width: 100%; aspect-ratio: 9 / 19.5;
    background: repeating-linear-gradient(45deg, #14181f 0 40px, #1a1f28 40px 80px);
  }
</style>
<div class="glow"></div>
<div class="vignette"></div>
<div class="stage">
  ${shot.eyebrow ? `<div class="eyebrow">${shot.eyebrow}</div>` : ''}
  <h1 class="headline">${shot.headline}</h1>
  ${shot.sub ? `<p class="sub">${shot.sub}</p>` : ''}
  <div class="device">
    <div class="screen">
      ${screen ? `<img src="${screen}">` : '<div class="placeholder"></div>'}
    </div>
  </div>
</div>`
}

export function render({ shots, theme, canvas, outDir, tmpDir }) {
  const shell = findHeadlessShell()
  // Wipe the output first: renaming a shot's slug would otherwise leave the
  // old file behind and it would ship alongside its replacement.
  rmSync(outDir, { recursive: true, force: true })
  mkdirSync(outDir, { recursive: true })
  mkdirSync(tmpDir, { recursive: true })
  const written = []

  for (const [i, shot] of shots.entries()) {
    const stem = `${String(i + 1).padStart(2, '0')}-${shot.slug}`
    const html = join(tmpDir, `${stem}.html`)
    const png = join(outDir, `${stem}.png`)
    writeFileSync(html, artboard(shot, theme, canvas))
    rmSync(png, { force: true })

    // chrome-headless-shell writes the PNG and then frequently exits non-zero
    // (or has to be killed by the timeout) once the virtual clock runs out.
    // The file on disk is the real success signal, not the exit code.
    try {
      execFileSync(
        shell,
        [
          '--headless',
          '--no-sandbox',
          '--disable-gpu',
          '--hide-scrollbars',
          '--force-device-scale-factor=1',
          // Without a virtual-time budget the shell keeps the renderer alive
          // waiting for idle and never exits on its own.
          '--virtual-time-budget=4000',
          `--window-size=${canvas.w},${canvas.h}`,
          `--screenshot=${png}`,
          `file://${html}`,
        ],
        { stdio: 'pipe', timeout: 60_000 },
      )
    } catch {
      /* checked below */
    }

    if (!existsSync(png)) throw new Error(`render produced no file for ${stem}`)
    written.push(png)
    console.log(`  ${basename(png)}`)
  }
  return written
}

export { REPO }
