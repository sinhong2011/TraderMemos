#!/usr/bin/env node
// Converts the canonical spec (api/openapi/openapi.yaml — the same bytes the Go binary
// embeds and serves at /openapi.yaml) into a JSON module the docs site imports.
//
// Why a generated module rather than reading the YAML at request time: the docs pages are
// static, but /api/search and on-demand rendering keep lib/openapi.ts alive at runtime, and
// Next's file tracing won't pull a path outside the app directory into the serverless
// bundle. A static import always ships with the bundle.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const specPath = path.join(root, '..', 'api', 'openapi', 'openapi.yaml');
const outPath = path.join(root, 'lib', 'openapi.generated.json');

let raw;
try {
  raw = await readFile(specPath, 'utf8');
} catch (error) {
  console.error(`sync-openapi: cannot read ${path.relative(root, specPath)}`);
  console.error(
    'The docs site reads the spec from the api/ directory of this repo. On Vercel that ' +
      'requires "Include files outside of the Root Directory in the Build Step" to be enabled.',
  );
  console.error(error.message);
  process.exit(1);
}

await writeFile(outPath, `${JSON.stringify(parse(raw), null, 2)}\n`);
console.log(`sync-openapi: wrote ${path.relative(root, outPath)}`);
