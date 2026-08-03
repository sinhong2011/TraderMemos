/**
 * File hand-off plumbing shared by the trades export and app-config backup:
 * the web build triggers browser downloads, on the phone the equivalent is
 * writing to the cache directory and opening the share sheet.
 */
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/** Pulls the server-chosen filename out of `attachment; filename="…"`. */
export function filenameFromDisposition(header: string | null): string | undefined {
  const match = /filename="?([^";]+)"?/.exec(header ?? '');
  return match?.[1];
}

/** Writes content to a cache file and opens the share sheet on it. */
export async function shareFile(
  name: string,
  content: string | Uint8Array | ArrayBuffer,
  mimeType?: string,
): Promise<void> {
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  await file.write(content instanceof ArrayBuffer ? new Uint8Array(content) : content);
  await Sharing.shareAsync(file.uri, { mimeType });
}
