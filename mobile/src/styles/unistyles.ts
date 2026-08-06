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
  /**
   * Max width of a content column. Phones never reach these, but on iPad a
   * form stretched across 1024pt is unusable — fields cap here and centre.
   * `auth` is the narrower sign-in measure; `form` fits the two-column tool
   * rows the calculators use.
   */
  measure: { auth: 420, form: 560 } as const,
  /** DESIGN.md applies tabular-nums globally — numbers must not jitter. */
  numeric: { fontVariant: ['tabular-nums'] } as Pick<TextStyle, 'fontVariant'>,
};

export interface ThemeMaterials {
  /**
   * Liquid Glass variant for chrome buttons. Not a color, but scheme-dependent
   * for the same reason one would be: the effect can only refract what sits
   * behind it. On dark, **clear** keeps the rim and lets the surface through so
   * the control reads as glass rather than a swatch; on the light theme's
   * near-flat page there is nothing to refract and clear collapses to an almost
   * invisible rim, so light takes **regular**, which carries its own tint.
   */
  glass: 'regular' | 'clear';
}

export interface ThemeShadows {
  /**
   * Elevation for a floating content card. Light mode needs this: `card` is
   * #FFFFFF against a #F2F2F7 page — 1.12:1, far too little to read as an edge
   * on its own, and it is the shadow (not a tint) that the web theme uses to
   * separate its white card from its white page. Dark leaves it off: there
   * `card` is *lighter* than the page, so luminance already carries elevation.
   */
  card?: string;
}

export interface ThemeColors {
  background: string;
  foreground: string;
  card: string;
  muted: string;
  mutedForeground: string;
  border: string;
  /** Outline for interactive controls (inputs, outlined buttons) — web `--input`. */
  input: string;
  /**
   * iOS `tertiarySystemFill` — the filled capsule/field the system paints
   * behind a compact picker or a plain text field. One grey, two alphas, and
   * deliberately stronger than `muted`: it has to hold its own next to a
   * SwiftUI-drawn control in the same row, which `muted` is too faint to do.
   * A token rather than a per-component `rt.themeName` ternary, so the scheme
   * swap happens where every other color's does.
   */
  fill: string;
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
    // The iOS grouped-table pair, taken exactly: `background` is
    // systemGroupedBackground and `card` is secondarySystemGroupedBackground.
    // Matching the system values (rather than a neutral grey of our own) is what
    // lets the real SwiftUI surfaces agree with the RN ones they abut — the
    // Settings Forms, whose cells are system-drawn and cannot be restyled, the
    // `systemChromeMaterial` nav bar, and the native tab bar. Note the faint
    // blue cast: this pair is not neutral, unlike the dark theme's #161616.
    //
    // Web separates its white card from a white page with a shadow; the page is
    // tinted here *as well*, but `shadows.card` is what actually draws the edge.
    // (An earlier pass darkened the *card* to solve the same problem; that
    // inverted elevation against the dark theme, where card is lighter.)
    background: '#F2F2F7',
    foreground: '#262626',
    card: '#FFFFFF',
    // 8%, not 4%: 4% black over the white card composites to exactly #F5F5F5 —
    // the old page color — so every nested tile, progress track and heatmap
    // idle cell was invisible against the page showing past the card. 8% lands
    // on #EBEBEB, within a hair of iOS `tertiarySystemFill`.
    muted: 'rgba(0, 0, 0, 0.08)',
    mutedForeground: '#686868',
    // Hairlines at 8% resolved to #EBEBEB — identical to the new `muted` fill,
    // and far lighter than iOS's own #C6C6C8 separator. 12%/18% keep a divider
    // and a field outline distinct from each other and from a filled row.
    border: 'rgba(0, 0, 0, 0.12)',
    input: 'rgba(0, 0, 0, 0.18)',
    fill: 'rgba(118, 118, 128, 0.12)',
    /** TraderMemos brand — web `--primary` oklch(0.5013 0.1428 252.49). */
    primary: '#1264B2',
    primaryForeground: '#FFFFFF',
    destructive: '#FB2C36',
    /** Domain P&L hues (web --profit/--loss/--flat) — not error colors. */
    profit: '#098926',
    loss: '#E7000B',
    flat: '#737373',
    /**
     * Section-title accent — web `--chart-3` oklch(0.398 0.07 227.392).
     *
     * The hue deliberately does *not* match the dark theme's amber. An earlier
     * pass read the teal/amber split as a shadcn accident and "corrected" it to
     * amber-700 for consistency, which put a saturated rust-brown heading on
     * every card in a blue-brand app — it read as a warning state, and at
     * 5.02:1 it was also the weakest text on the card. The split is the point:
     * a warm heading needs a dark ground, so light gets this cool, low-chroma
     * tone (9.15:1, a relative of `primary`) and dark gets amber.
     */
    accent: '#104E64',
  } satisfies ThemeColors as ThemeColors,
  shadows: {
    card: '0px 1px 2px rgba(0, 0, 0, 0.04), 0px 6px 16px rgba(0, 0, 0, 0.06)',
  } satisfies ThemeShadows as ThemeShadows,
  materials: { glass: 'regular' } satisfies ThemeMaterials as ThemeMaterials,
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
    fill: 'rgba(118, 118, 128, 0.24)',
    primary: '#1264B2',
    primaryForeground: '#FFFFFF',
    destructive: '#FB414A',
    profit: '#54BF5C',
    loss: '#FF6467',
    flat: '#A1A1A1',
    accent: '#F59E0B',
  } satisfies ThemeColors as ThemeColors,
  /** Undefined, not 'none' — `processBoxShadow` short-circuits on nullish. */
  shadows: { card: undefined } satisfies ThemeShadows as ThemeShadows,
  materials: { glass: 'clear' } satisfies ThemeMaterials as ThemeMaterials,
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
