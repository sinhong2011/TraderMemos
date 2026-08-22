#!/usr/bin/env node
// Compose store artboards from raw device captures.
//
//   node scripts/appstore/build.mjs ios       # 1320×2868, App Store 6.9"
//   node scripts/appstore/build.mjs android   # 1080×2400, Play phone
//
// Raw captures are read from scripts/appstore/captures/<platform>/<screen>.png
// and the finished artboards land in scripts/appstore/out/<platform>/.
// A missing capture renders as a striped placeholder rather than failing, so
// the layout can be reviewed before every screen has been shot.

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { render, REPO } from './frame.mjs'
import { PLATFORM_THEME, SHOTS, THEME } from './shots.mjs'

const CANVAS = {
  // App Store 6.9" — the only iPhone size Apple requires; it downscales this
  // for every smaller device.
  ios: { w: 1320, h: 2868 },
  // Play Store phone screenshots: 9:16, each side 1080–7680px. Play caps the
  // aspect at 2:1, so 9:16 is the safe portrait choice rather than matching the
  // handset's own taller ratio.
  android: { w: 1080, h: 1920 },
  // iPad 13" — required while app.json keeps supportsTablet: true.
  ipad: { w: 2064, h: 2752 },
}

const platform = process.argv[2] ?? 'ios'
const canvas = CANVAS[platform]
if (!canvas) {
  console.error(`unknown platform "${platform}" — expected one of: ${Object.keys(CANVAS).join(', ')}`)
  process.exit(1)
}

const capturesDir = join(REPO, 'scripts/appstore/captures', platform)
const outDir = join(REPO, 'scripts/appstore/out', platform)
const tmpDir = join(REPO, 'scripts/appstore/.tmp', platform)

const shots = SHOTS.map((s) => {
  const capture = join(capturesDir, `${s.screen}.png`)
  const found = existsSync(capture)
  if (!found) console.warn(`  ! no capture for "${s.screen}" — drawing placeholder`)
  return { ...s, screenshot: found ? capture : null }
})

const theme = { ...THEME, ...(PLATFORM_THEME[platform] ?? {}) }

console.log(`composing ${shots.length} artboards at ${canvas.w}×${canvas.h} (${platform})`)
render({ shots, theme, canvas, outDir, tmpDir })
console.log(`\n→ ${outDir}`)
