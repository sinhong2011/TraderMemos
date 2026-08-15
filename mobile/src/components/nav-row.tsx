import type { SFSymbol } from 'expo-symbols';
import { Frame, Text } from 'panelui-native';
import { useCSSVariable } from 'uniwind';

import { Icon } from '@/components/icon';

/**
 * A settings row that pushes another screen — leading icon, label, optional
 * trailing value, disclosure chevron. Icon and label share the neutral label
 * color; brand blue is reserved for the values and states that carry meaning,
 * not for row furniture.
 *
 * Use it only where a tap pushes: a chevron on a row that opens a sheet, an
 * alert, or the system settings promises navigation that never happens — those
 * rows take `accessory` instead.
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
   * `external` for a row that leaves the app (system settings, a browser) — the
   * chevron promises an in-app push, so those rows get the leaving glyph
   * instead. `none` for an action that stays put.
   */
  accessory?: 'chevron' | 'external' | 'none';
  onPress: () => void;
}) {
  const [foreground, mutedForeground] = useCSSVariable([
    '--color-foreground',
    '--color-muted-foreground',
  ]) as [string, string];

  return (
    <Frame.Row onPress={onPress}>
      {systemImage != null ? (
        <Frame.Media>
          <Icon name={systemImage} size={17} tintColor={foreground} />
        </Frame.Media>
      ) : null}
      <Frame.Content>
        <Frame.Title>{label}</Frame.Title>
      </Frame.Content>
      <Frame.Actions>
        {value != null ? (
          <Text size="sm" muted>
            {value}
          </Text>
        ) : null}
        {/* `Frame.Row`'s own `chevron` prop draws only the pushing glyph, and
            an external row needs the leaving one — so both come from the app's
            icon layer instead. */}
        {accessory === 'none' ? null : (
          <Icon
            name={accessory === 'external' ? 'arrow.up.forward' : 'chevron.right'}
            size={12}
            tintColor={mutedForeground}
          />
        )}
      </Frame.Actions>
    </Frame.Row>
  );
}
