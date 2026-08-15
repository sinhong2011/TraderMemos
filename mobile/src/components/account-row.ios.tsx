import { Button, HStack, Image, Spacer, Text as UIText, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle } from '@expo/ui/swift-ui/modifiers';
import { useUnistyles } from 'react-native-unistyles';

import type { AccountRowProps } from './account-row.types';

/**
 * The settings hub's account row — the SwiftUI original: name + meta leading,
 * equity + P&L trailing, disclosure chevron. Extracted verbatim from the hub
 * so the Android split (`account-row.tsx`) could exist; nothing about the
 * shipping iOS row moves.
 */
export function AccountRow({ name, meta, equity, pnl, pnlColor, onPress }: AccountRowProps) {
  const { theme } = useUnistyles();
  return (
    <Button onPress={onPress}>
      <HStack spacing={8}>
        <VStack alignment="leading" spacing={2}>
          <UIText modifiers={[foregroundStyle({ type: 'hierarchical', style: 'primary' })]}>
            {name}
          </UIText>
          {/* Single string child — the SwiftUI Text bridge can't mount an
              array of interpolations (RawText crash). */}
          <UIText
            modifiers={[
              font({ size: 13 }),
              foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
            ]}
          >
            {meta}
          </UIText>
        </VStack>
        <Spacer />
        <VStack alignment="trailing" spacing={2}>
          <UIText modifiers={[foregroundStyle({ type: 'hierarchical', style: 'primary' })]}>
            {equity}
          </UIText>
          <UIText modifiers={[font({ size: 13 }), foregroundStyle(pnlColor)]}>{pnl}</UIText>
        </VStack>
        <Image systemName="chevron.right" size={12} color={theme.colors.mutedForeground} />
      </HStack>
    </Button>
  );
}
