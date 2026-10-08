const squash = (s: string) => s.replace(/\s+/g, "");

/**
 * Matches an accessible name exactly, ignoring whitespace. Browsers put a space
 * between a button's flex/grid children (they are blockified); jsdom has no
 * stylesheet, sees bare inline spans, and runs the words together.
 */
export const looseName = (expected: string) => (name: string) => squash(name) === squash(expected);
