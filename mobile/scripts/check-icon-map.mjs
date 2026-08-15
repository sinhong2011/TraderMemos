#!/usr/bin/env node
/**
 * Guards `src/lib/sf-to-material.ts` against two silent failures:
 *
 *   1. A Material target that isn't in the shipped MaterialIcons glyphmap —
 *      renders as a blank box at runtime with no error.
 *   2. An SF Symbol used in `src/` with no row in the map — falls back to the
 *      neutral glyph, which is easy to miss in review.
 *
 * Symbol names that reach `<Icon>` as a prop can't be found statically; list
 * those in DYNAMIC below so they're still covered.
 */
import { readFileSync } from 'node:fs';
import { readdirSync, statSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// expo-symbols' own Material Symbols table — the exact set its Android
// SymbolView can draw, so validating against it can't drift from runtime.
const glyphs = JSON.parse(
  readFileSync(join(root, 'node_modules/expo-symbols/src/android/symbols.json'), 'utf8')
);

// Parse the map without importing TS: pull the quoted-or-bare key → value rows.
const mapSource = readFileSync(join(root, 'src/lib/sf-to-material.ts'), 'utf8');
const start = mapSource.indexOf('export const SF_TO_MATERIAL');
const end = mapSource.indexOf('export const FALLBACK_MATERIAL_ICON');
if (start < 0 || end < 0) {
  console.error('✗ could not locate SF_TO_MATERIAL / FALLBACK_MATERIAL_ICON in sf-to-material.ts');
  process.exit(1);
}
const body = mapSource.slice(start, end);
const map = new Map();
for (const m of body.matchAll(/^\s*'?([A-Za-z0-9.]+)'?:\s*'([a-z0-9_]+)',/gm)) {
  map.set(m[1], m[2]);
}

// Symbol names passed as props / built by ternaries — not statically greppable.
const DYNAMIC = [
  'star',
  'star.fill',
  'eye',
  'eye.slash',
  'circle',
  'checkmark.circle',
  'checkmark.circle.fill',
  'exclamationmark.circle',
  'arrow.up',
  'arrow.down',
  'bell',
  'bell.fill',
  'arrowtriangle.up.fill',
  'arrowtriangle.down.fill',
];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (['.ts', '.tsx'].includes(extname(p))) out.push(p);
  }
  return out;
}

const used = new Set(DYNAMIC);
for (const file of walk(join(root, 'src'))) {
  const s = readFileSync(file, 'utf8');
  for (const m of s.matchAll(/<(?:SymbolView|Icon)\b[^>]*?\bname=\{?['"]([^'"}]+)['"]/gs)) {
    used.add(m[1]);
  }
  for (const m of s.matchAll(/\bsystemImage=\{?['"]([^'"}]+)['"]/g)) used.add(m[1]);
}

const badTarget = [...map].filter(([, material]) => !(material in glyphs));
const unmapped = [...used].filter((sf) => !map.has(sf)).sort();

for (const [sf, material] of badTarget) {
  console.error(`✗ ${sf} → "${material}" is not a Material Symbols name`);
}
for (const sf of unmapped) console.error(`✗ ${sf} is used in src/ but has no mapping`);

if (badTarget.length || unmapped.length) {
  console.error(`\n${badTarget.length} bad target(s), ${unmapped.length} unmapped symbol(s)`);
  process.exit(1);
}
console.log(
  `✓ ${map.size} mappings, all valid Material Symbols names; ${used.size} symbols covered`
);
