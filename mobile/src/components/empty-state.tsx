import { RNHostView } from '@expo/ui';
import { Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Icon } from '@/components/icon';

import type { EmptyStateProps } from './empty-state.types';

/**
 * The app's "nothing here" surface, rebuilt for platforms without SwiftUI.
 *
 * `ContentUnavailableView` has no universal or Compose counterpart, so this
 * reconstructs it — centered icon, title, muted description. iOS overrides this
 * with `empty-state.ios.tsx` and keeps the real SwiftUI view, so the eleven call
 * sites read the same on both platforms.
 *
 * It's plain React Native inside an `RNHostView` rather than universal
 * primitives, for one concrete reason: universal `Icon` takes an XML *drawable*
 * on Android, but `systemImage` arrives here as a runtime prop (eleven
 * different symbols, and `ErrorState` forwards a caller's choice), so there's
 * no literal for Metro to resolve a `require` against. `RNHostView` is
 * `@expo/ui`'s supported way to drop RN views into a hosted tree, which lets
 * this reuse `@/components/icon` — already mapped to Material Symbols — and
 * unistyles tokens, exactly like the rest of the app's RN surfaces.
 *
 * Sizes and colors follow DESIGN.md: the icon is muted and oversized, the title
 * is the only emphasized element, the description sits in `mutedForeground`.
 */
export function EmptyState({ title, systemImage, description }: EmptyStateProps) {
  const { theme } = useUnistyles();

  return (
    <RNHostView matchContents>
      <View style={styles.root}>
        <Icon name={systemImage} size={44} tintColor={theme.colors.mutedForeground} />
        <Text style={styles.title}>{title}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
    </RNHostView>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.xl,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.colors.foreground,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    color: theme.colors.mutedForeground,
    textAlign: 'center',
  },
}));
