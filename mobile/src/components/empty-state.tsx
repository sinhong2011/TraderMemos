import type { SFSymbol } from 'expo-symbols';
import { EmptyState as PanelEmptyState } from 'panelui-native';
import { useCSSVariable } from 'uniwind';

import { Icon } from '@/components/icon';

export interface EmptyStateProps {
  title: string;
  /** SF Symbol name; Android maps it through `@/lib/sf-to-material`. */
  systemImage: SFSymbol;
  description?: string;
}

/**
 * The app's "nothing here" surface — PanelUI's `EmptyState` with the app's own
 * icon layer in its media slot, so the eleven call sites (and `ErrorState`,
 * which forwards a caller's symbol) keep passing an SF Symbol name and get the
 * mapped Material Symbol off iOS.
 *
 * It fills whatever it is given — a whole screen, or a flex slot — and centres
 * the icon, title and description in it.
 */
export function EmptyState({ title, systemImage, description }: EmptyStateProps) {
  const [mutedForeground] = useCSSVariable(['--color-muted-foreground']) as [string];

  return (
    <PanelEmptyState>
      <PanelEmptyState.Header>
        <PanelEmptyState.Media variant="icon">
          <Icon name={systemImage} size={20} tintColor={mutedForeground} />
        </PanelEmptyState.Media>
        <PanelEmptyState.Title>{title}</PanelEmptyState.Title>
        {description ? (
          <PanelEmptyState.Description>{description}</PanelEmptyState.Description>
        ) : null}
      </PanelEmptyState.Header>
    </PanelEmptyState>
  );
}
