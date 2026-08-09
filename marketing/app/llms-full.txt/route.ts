import { getLLMText, getMarkdownPages } from '@/lib/source';

export const revalidate = false;

export async function GET() {
  const scan = getMarkdownPages().map(getLLMText);
  const scanned = await Promise.all(scan);

  return new Response(scanned.join('\n\n'));
}
