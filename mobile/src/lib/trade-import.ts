/**
 * Trade-import plumbing shared by the form's "Scan to fill" menu and the
 * hands-off drop folder: broker screenshots are OCR'd server-side, CSV/JSON
 * fill files are parsed on-device, and every source merges into one extract.
 *
 * The drop folder is how iOS Shortcuts feeds the app — a URL scheme carries
 * text only, so a shortcut saves the screenshot into `Documents/Import` (the
 * folder `UIFileSharingEnabled` exposes as "On My iPhone → TraderMemos") and
 * then opens `tradermemos://new-trade?import=1`. Share-sheet opens land in the
 * system `Documents/Inbox` instead, so both folders are drained together.
 */

import { Directory, File, Paths } from 'expo-file-system';

import type { LlmApiSettings, TradeExtract } from '@/api/types';
import type { RequestOptions } from '@/api/client';
import { parseFillFile } from './fill-file';
import { mergeTradeExtracts } from './trade-prefill';

/** A file to import, in the `{uri,name,type}` shape RN's FormData takes. */
export type ImportSource = { uri: string; name: string; type: string };

/** Cap multi-select screenshots so a single scan stays affordable (web parity). */
export const SCAN_MAX_IMAGES = 8;

const IMAGE_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  heic: 'image/heic',
  heif: 'image/heif',
  webp: 'image/webp',
};

const DATA_MIME: Record<string, string> = {
  csv: 'text/csv',
  json: 'application/json',
  txt: 'text/plain',
};

/** Recognised import type for a filename, or null for anything else. */
export function mimeForFilename(name: string): string | null {
  const extension = name.split('.').pop()?.toLowerCase() ?? '';
  return IMAGE_MIME[extension] ?? DATA_MIME[extension] ?? null;
}

function isImage(source: ImportSource): boolean {
  return source.type.startsWith('image/');
}

/** Screenshot scans need the server-side vision endpoint; CSV/JSON never do. */
export function isVisionReady(settings: LlmApiSettings | undefined): boolean {
  return (
    settings != null &&
    settings.enabled &&
    settings.base_url.trim() !== '' &&
    settings.api_key_set
  );
}

/**
 * Screenshots through `POST /ocr/parse` (one call each), fill files parsed
 * locally, all merged into a single extract.
 */
export async function extractFromSources(
  sources: ImportSource[],
  api: (path: string, options?: RequestOptions) => Promise<Response>,
): Promise<TradeExtract> {
  const extracts: TradeExtract[] = [];
  for (const image of sources.filter(isImage).slice(0, SCAN_MAX_IMAGES)) {
    const formData = new FormData();
    // React Native FormData takes a {uri,name,type} descriptor for file parts.
    formData.append('file', image as unknown as Blob);
    const response = await api('/ocr/parse', { method: 'POST', formData });
    extracts.push((await response.json()) as TradeExtract);
  }
  for (const data of sources.filter((source) => !isImage(source))) {
    extracts.push(parseFillFile(data.name, await new File(data.uri).text()));
  }
  return mergeTradeExtracts(extracts);
}

/** Where a shortcut's "Save File" action drops broker screenshots. */
function dropFolder(): Directory {
  return new Directory(Paths.document, 'Import');
}

/** Where iOS copies documents handed over by another app's share sheet. */
function systemInbox(): Directory {
  return new Directory(Paths.document, 'Inbox');
}

/**
 * Create the drop folder so it can be picked as a Shortcuts save destination
 * before anything has ever been imported. Cheap enough to call every launch.
 */
export function ensureDropFolder(): void {
  const folder = dropFolder();
  if (!folder.exists) folder.create({ intermediates: true });
}

function sourcesIn(folder: Directory): ImportSource[] {
  if (!folder.exists) return [];
  const sources: ImportSource[] = [];
  for (const entry of folder.list()) {
    if (!(entry instanceof File)) continue;
    const type = mimeForFilename(entry.name);
    if (type) sources.push({ uri: entry.uri, name: entry.name, type });
  }
  return sources.sort((a, b) => a.name.localeCompare(b.name));
}

/** Everything waiting to be imported, oldest folder first, name-sorted. */
export function listDroppedSources(): ImportSource[] {
  return [...sourcesIn(dropFolder()), ...sourcesIn(systemInbox())];
}

/** Drop the consumed files — they are one-shot hand-offs, not a library. */
export function clearDroppedSources(sources: ImportSource[]): void {
  for (const source of sources) {
    const file = new File(source.uri);
    if (file.exists) file.delete();
  }
}

/**
 * Copy a file handed over by another app (share sheet / "Open in TraderMemos")
 * into the drop folder. Returns false for anything the form can't read, so a
 * stray hand-off doesn't open an empty import.
 */
export function stageDroppedFile(uri: string): boolean {
  const incoming = new File(uri);
  if (!incoming.exists || !mimeForFilename(incoming.name)) return false;
  ensureDropFolder();
  const target = new File(dropFolder(), incoming.name);
  if (target.exists) target.delete();
  incoming.copySync(target);
  return true;
}
