'use client';

import { createOpenAPIPage } from 'fumadocs-openapi/ui';
import { withScalar } from 'fumadocs-openapi/scalar';
import { useTheme } from 'fumadocs-ui/provider/base';
import { useEffect, type ComponentProps } from 'react';

/**
 * `withScalar()` swaps Fumadocs' built-in playground for the Scalar API client
 * (@scalar/api-client-react), which is what the API server's own /docs page uses — same
 * request UI in both places. It pulls in its own stylesheet.
 */
const GeneratedPage = createOpenAPIPage(withScalar());

/**
 * Scalar defines its entire palette under `.light-mode` / `.dark-mode`, and its dialog
 * portals to a `<div class="scalar-app">` directly under `<body>` — outside the wrapper
 * Fumadocs puts the theme class on. Without this the dialog renders with every
 * `--scalar-*` variable unset: transparent panels over the page. Scoped to API pages, and
 * removed on unmount, so the classes never outlive the reference section.
 */
function useScalarTheme() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const dark = resolvedTheme === 'dark';
    const { classList } = document.body;
    classList.toggle('dark-mode', dark);
    classList.toggle('light-mode', !dark);

    return () => classList.remove('dark-mode', 'light-mode');
  }, [resolvedTheme]);
}

export function OpenAPIPage(props: ComponentProps<typeof GeneratedPage>) {
  useScalarTheme();

  return <GeneratedPage {...props} />;
}
