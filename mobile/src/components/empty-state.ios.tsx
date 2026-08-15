import { ContentUnavailableView } from '@expo/ui/swift-ui';

import type { EmptyStateProps } from './empty-state.types';

/**
 * iOS empty state — SwiftUI's own `ContentUnavailableView`, exactly as the
 * screens used it before the Android port. See `empty-state.tsx` for the
 * cross-platform rebuild and why the split exists.
 */
export function EmptyState({ title, systemImage, description }: EmptyStateProps) {
  return (
    <ContentUnavailableView
      title={title}
      systemImage={systemImage}
      description={description}
    />
  );
}
