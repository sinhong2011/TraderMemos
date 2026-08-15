import type { SFSymbol } from 'expo-symbols';

/**
 * Shared props for `EmptyState`, so the universal and iOS implementations
 * can't drift.
 */
export interface EmptyStateProps {
  title: string;
  /** SF Symbol name; Android maps it through `@/lib/sf-to-material`. */
  systemImage: SFSymbol;
  description?: string;
}
