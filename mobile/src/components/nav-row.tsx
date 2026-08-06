import { Button, HStack, Image, Spacer, Text as UIText } from '@expo/ui/swift-ui';
import { font, foregroundStyle } from '@expo/ui/swift-ui/modifiers';
import type { SFSymbol } from 'sf-symbols-typescript';
import { useUnistyles } from 'react-native-unistyles';

/**
 * A settings row that pushes another screen — the NavigationLink look: leading
 * icon, label, optional trailing value, disclosure chevron. Icon and label
 * share the neutral label color; brand blue is reserved for the values and
 * states that carry meaning, not for row furniture.
 *
 * `Button label={…} systemImage={…}` can't carry a trailing chevron (label and
 * children are mutually exclusive), so the row is composed by hand, matching
 * the account and AI rows. Use it only where a tap pushes: a chevron on a row
 * that opens a sheet, an alert, or iOS Settings promises navigation that never
 * happens — those stay plain `Button`s.
 */
export function NavRow({
  systemImage,
  label,
  value,
  accessory = 'chevron',
  onPress,
}: {
  systemImage?: SFSymbol;
  label: string;
  value?: string;
  /**
   * `external` for a row that leaves the app (iOS Settings, a browser) — the
   * chevron promises an in-app push, so those rows get the leaving glyph
   * instead. `none` for an action that stays put.
   */
  accessory?: 'chevron' | 'external' | 'none';
  onPress: () => void;
}) {
  const { theme } = useUnistyles();
  return (
    <Button onPress={onPress}>
      <HStack spacing={12}>
        {systemImage != null ? (
          <Image systemName={systemImage} size={17} color={theme.colors.foreground} />
        ) : null}
        <UIText modifiers={[foregroundStyle({ type: 'hierarchical', style: 'primary' })]}>
          {label}
        </UIText>
        <Spacer />
        {value != null ? (
          <UIText
            modifiers={[font({ size: 15 }), foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}
          >
            {value}
          </UIText>
        ) : null}
        {accessory === 'none' ? null : (
          <Image
            systemName={accessory === 'external' ? 'arrow.up.forward' : 'chevron.right'}
            size={12}
            color={theme.colors.mutedForeground}
          />
        )}
      </HStack>
    </Button>
  );
}
