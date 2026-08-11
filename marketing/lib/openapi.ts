import { createOpenAPI } from 'fumadocs-openapi/server';
import type { OpenAPIV3_2 } from 'fumadocs-openapi';
// Generated from api/openapi/openapi.yaml by scripts/sync-openapi.mjs (gitignored).
import generated from './openapi.generated.json';

type Document = OpenAPIV3_2.Document;

/**
 * The shipped spec declares `servers: [{ url: '/' }]`, which is right for the Scalar page the
 * API itself serves at `/docs` — there, same-origin *is* the reader's server. Here it would
 * aim the playground at the docs site. Self-hosted instances share no hostname, so the best
 * we can do is a server variable the reader fills in. The canonical spec is untouched.
 */
function withReaderServer(document: Document): Document {
  return {
    ...document,
    servers: [
      {
        url: '{origin}',
        description: 'Your TraderMemos server',
        variables: {
          origin: {
            default: 'http://localhost:8080',
            description: 'Origin of your instance, e.g. https://trades.example.com',
          },
        },
      },
    ],
  };
}

export const openapi = createOpenAPI({
  input: {
    tradermemos: () => withReaderServer(generated as unknown as Document),
  },
});
