import { SymbolView, type SFSymbol } from 'expo-symbols';
import type { ComponentProps } from 'react';

import { FALLBACK_MATERIAL_ICON, SF_TO_MATERIAL } from '@/lib/sf-to-material';

type SymbolViewProps = ComponentProps<typeof SymbolView>;

export type IconProps = Omit<SymbolViewProps, 'name'> & {
  /**
   * An SF Symbol name. Android draws the mapped Material Symbol
   * (`@/lib/sf-to-material`); the call site never spells out both.
   */
  name: SFSymbol;
};

const warned = new Set<string>();

/**
 * The app's one icon primitive — use this instead of `SymbolView` directly.
 *
 * `expo-symbols` already renders SF Symbols on iOS and Material Symbols from a
 * bundled variable font everywhere else, but its `name` prop wants an explicit
 * `{ ios, android }` pair off iOS. Call sites pass a single SF name (often as a
 * prop or a ternary, so it isn't a literal here), and this resolves the Android
 * half from the shared map.
 *
 * Every other prop — `size`, `tintColor`, `weight`, `style` — passes straight
 * through and behaves the same on both platforms, so migrating a call site is
 * just the import.
 */
export function Icon({ name, ...props }: IconProps) {
  const android = SF_TO_MATERIAL[name];

  if (__DEV__ && !android && !warned.has(name)) {
    warned.add(name);
    console.warn(
      `[Icon] no Android mapping for SF Symbol "${name}" — add a row to ` +
        `src/lib/sf-to-material.ts (run \`pnpm run check-icons\` to verify).`
    );
  }

  // `web` matters because Metro resolves expo-symbols' non-iOS SymbolView for
  // web too, and it reads the `web` slot rather than `android`.
  const resolved = android ?? FALLBACK_MATERIAL_ICON;
  return <SymbolView name={{ ios: name, android: resolved, web: resolved }} {...props} />;
}
