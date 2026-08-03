/**
 * Design tokens — the single source of truth for the app's look, defined
 * shadcn-style: semantic color slots (background / card / mutedForeground …)
 * rather than raw hues, mirrored from the web theme (web/src/global.css
 * `:root` / `.dark`). Values are the resolved hex of the oklch/color-mix
 * expressions there — keep in sync when global.css changes.
 *
 * Consumed through `react-native-unistyles` v3: components build stylesheets
 * with `StyleSheet.create((theme) => …)` and re-render on scheme changes
 * automatically (`adaptiveThemes`). For non-style props (chart colors, icon
 * tints, navigation themes) read the live theme with `useUnistyles()`.
 */

import type { TextStyle } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

/** Scale tokens shared by both schemes (web --radius / Tailwind spacing). */
const scale = {
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const,
  radius: { sm: 6, md: 10, lg: 14, full: 999 } as const,
  /** DESIGN.md applies tabular-nums globally — numbers must not jitter. */
  numeric: { fontVariant: ['tabular-nums'] } as Pick<TextStyle, 'fontVariant'>,
};

export interface ThemeColors {
  background: string;
  foreground: string;
  card: string;
  muted: string;
  mutedForeground: string;
  border: string;
  /** Outline for interactive controls (inputs, outlined buttons) — web `--input`. */
  input: string;
  primary: string;
  primaryForeground: string;
  destructive: string;
  profit: string;
  loss: string;
  flat: string;
  accent: string;
}

export const lightTheme = {
  colors: {
    background: '#FFFFFF',
    foreground: '#262626',
    // Nudged off web's pure white-on-white — RN has no shadow stack, so a
    // flat white card on a white page would vanish.
    card: '#F7F7F7',
    muted: 'rgba(0, 0, 0, 0.04)',
    mutedForeground: '#686868',
    border: 'rgba(0, 0, 0, 0.08)',
    input: 'rgba(0, 0, 0, 0.10)',
    /** TraderMemos brand — web `--primary` oklch(0.617 0.1305 235.19). */
    primary: '#0490C8',
    primaryForeground: '#FFFFFF',
    destructive: '#FB2C36',
    /** Domain P&L hues (web --profit/--loss/--flat) — not error colors. */
    profit: '#098926',
    loss: '#E7000B',
    flat: '#737373',
    /** Section-title accent — web `--chart-3`. */
    accent: '#164E63',
  } satisfies ThemeColors as ThemeColors,
  ...scale,
};

export const darkTheme = {
  colors: {
    background: '#161616',
    foreground: '#F5F5F5',
    card: '#1B1B1B',
    muted: 'rgba(255, 255, 255, 0.04)',
    mutedForeground: '#818181',
    border: 'rgba(255, 255, 255, 0.06)',
    input: 'rgba(255, 255, 255, 0.08)',
    primary: '#0490C8',
    primaryForeground: '#FFFFFF',
    destructive: '#FB414A',
    profit: '#54BF5C',
    loss: '#FF6467',
    flat: '#A1A1A1',
    accent: '#F59E0B',
  } satisfies ThemeColors as ThemeColors,
  ...scale,
};

type AppThemes = { light: typeof lightTheme; dark: typeof darkTheme };
export type AppTheme = typeof lightTheme;

declare module 'react-native-unistyles' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface UnistylesThemes extends AppThemes {}
}

StyleSheet.configure({
  themes: { light: lightTheme, dark: darkTheme },
  settings: { adaptiveThemes: true },
});

/**
 * Saturated P&L fills for solid, white-on-color surfaces (outcome badges, the
 * Long/Short and Buy/Sell toggles) — the light-scheme hues in both themes,
 * because white text needs the saturation and a same-in-both-modes fill is the
 * Stocks-app signature those surfaces borrow. Deliberately not theme tokens:
 * `colors.profit`/`colors.loss` lighten in the dark theme for *text*, where
 * that is what keeps them legible.
 */
export const PnlFill = {
  pos: '#098926',
  neg: '#E7000B',
  flat: '#737373',
  open: '#0490C8',
} as const;

/** Returns the P&L color for a value, honoring the flat/zero case. */
export function pnlColor(colors: ThemeColors, value: number | null | undefined): string {
  if (value == null || value === 0) return colors.flat;
  return value > 0 ? colors.profit : colors.loss;
}

/**
 * Translucent P&L surface tint for calendar heatmap cells: profit/loss hue
 * with alpha scaled by magnitude relative to the month's largest day.
 */
export function pnlBgTint(colors: ThemeColors, value: number, maxAbs: number): string {
  const base = value > 0 ? colors.profit : colors.loss;
  const intensity = maxAbs > 0 ? Math.min(1, Math.abs(value) / maxAbs) : 0;
  // Capped so profit/loss text keeps ~4.5:1 on the deepest wash; green is
  // damped for luminance parity — at equal alpha it reads far louder than red.
  const parity = value > 0 ? 0.85 : 1;
  const alpha = Math.round((0.08 + 0.16 * intensity) * parity * 255);
  return `${base}${alpha.toString(16).padStart(2, '0')}`;
}

/**
 * Vivid P&L fill for heatmap dots that never carry text — the quiet
 * `pnlBgTint` ramp reads as noise at dot size, so these run much hotter.
 */
export function pnlDotTint(colors: ThemeColors, value: number, maxAbs: number): string {
  const base = value > 0 ? colors.profit : colors.loss;
  const intensity = maxAbs > 0 ? Math.min(1, Math.abs(value) / maxAbs) : 0;
  const alpha = Math.round((0.3 + 0.6 * intensity) * 255);
  return `${base}${alpha.toString(16).padStart(2, '0')}`;
}
