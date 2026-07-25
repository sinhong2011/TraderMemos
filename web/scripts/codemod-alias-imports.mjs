#!/usr/bin/env node
import { readdir, readFile, writeFile, unlink } from "node:fs/promises";
import { join, dirname, relative, normalize, extname } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SRC = join(ROOT, "src");

async function walk(dir) {
  const out = [];
  for (const ent of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) {
      if (["node_modules", "dist"].includes(ent.name)) continue;
      out.push(...(await walk(p)));
    } else if (/\.(tsx?|css)$/.test(ent.name)) out.push(p);
  }
  return out;
}

function rewriteImportSpec(fromFile, spec) {
  if (!spec.startsWith(".")) return null;
  // Gate: rewrite all `../` cross-folder imports to `@/`.
  // Leave same-folder `./sibling` alone.
  if (!spec.startsWith("../")) return null;

  const resolved = normalize(join(dirname(fromFile), spec));
  if (!resolved.startsWith(SRC)) return null;

  let rel = relative(SRC, resolved).replaceAll("\\", "/");
  const isAsset = /\.(css|json|svg|png|jpg|jpeg|webp|gif)$/i.test(spec);
  if (!isAsset) {
    rel = rel.replace(/\.(tsx?|jsx?)$/, "");
  }
  return `@/${rel}`;
}

const IMPORT_RE =
  /(from\s+|import\s*\(|export\s+\*\s+from\s+|export\s+\{[^}]*\}\s+from\s+)(["'])(\.[^"']+)\2/g;

const files = await walk(SRC);
let fileCount = 0;
let rewriteCount = 0;

for (const file of files) {
  let text = await readFile(file, "utf8");
  let changed = false;
  const next = text.replace(IMPORT_RE, (full, prefix, quote, spec) => {
    const alias = rewriteImportSpec(file, spec);
    if (!alias) return full;
    rewriteCount++;
    changed = true;
    return `${prefix}${quote}${alias}${quote}`;
  });
  if (changed) {
    await writeFile(file, next);
    fileCount++;
  }
}

// Cleanup leftovers
const leftovers = [
  ["SignalToastVariant", "ToastVariant"],
  ["SignalImage", "EditorImage"],
  ["// SignalDrawer:", "// Drawer:"],
];

for (const file of files) {
  let text = await readFile(file, "utf8");
  let next = text;
  for (const [a, b] of leftovers) next = next.replaceAll(a, b);
  if (next !== text) await writeFile(file, next);
}

// Delete deprecated shims
for (const shim of [
  join(SRC, "components/signal-field-styles.ts"),
  join(SRC, "components/signal-overlay-styles.ts"),
]) {
  if (existsSync(shim)) {
    await unlink(shim);
    console.log("deleted", relative(ROOT, shim));
  }
}

// Remove skeleton-shimmer utility from global.css
const globalCss = join(SRC, "global.css");
let css = await readFile(globalCss, "utf8");
const css2 = css
  .replace(/@utility skeleton-shimmer \{[\s\S]*?\}\n\n/, "")
  .replace(/\n  \.skeleton-shimmer \{[\s\S]*?\}\n/, "\n");
if (css2 !== css) {
  await writeFile(globalCss, css2);
  console.log("removed skeleton-shimmer from global.css");
}

console.log(`rewrote ${rewriteCount} imports in ${fileCount} files`);
