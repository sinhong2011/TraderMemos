import { t } from '@lingui/core/macro';
import { Menu, Text } from 'panelui-native';
import { Pressable, View } from 'react-native';
import { useCSSVariable } from 'uniwind';

import type { Account } from '@/api/types';
import { Icon } from '@/components/icon';

/**
 * The trade form's account scope as a single control: one capsule carrying the
 * "Account" caption, the account name, and the pull-down chevron.
 *
 * Caption and value live *inside* the button rather than beside it, so the
 * whole capsule is one tap target and one object on the screen — a loose label
 * next to a separate pill read as two unrelated things, and left the caption
 * un-tappable. Caption and value share a type size; the caption is set apart
 * by color, not by shrinking it, so the pill reads as one line of type.
 *
 * The capsule is a `fill` surface rather than the old glass material: glass is
 * an iOS-only material and this control now draws itself identically on both
 * platforms, so it takes the token the app already uses for compact tracks and
 * plain fields.
 */
export function AccountPill({
  accounts,
  value,
  onChange,
}: {
  accounts: Account[];
  value: string;
  onChange: (accountId: string) => void;
}) {
  const [mutedForeground] = useCSSVariable(['--color-muted-foreground']) as [string];
  const name = accounts.find((account) => account.id === value)?.name ?? '';

  // Nothing to switch between: a capsule here would promise a menu that isn't
  // there, so the pair degrades to plain type at the same size.
  if (accounts.length <= 1) {
    return (
      <View className="flex-row items-center gap-2">
        <Text size="sm" muted>{t`Account`}</Text>
        <Text size="sm" weight="medium">
          {name}
        </Text>
      </View>
    );
  }

  return (
    <Menu presentation="bottom-sheet">
      <Menu.Trigger>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t`Account`}
          accessibilityValue={{ text: name }}
          className="flex-row items-center gap-2 rounded-full bg-fill px-3 py-1.5 active:opacity-60"
        >
          <Text size="sm" muted>{t`Account`}</Text>
          {/* Name and chevron ride tighter than the caption gap: the glyph
              belongs to the value it opens, not to the row. */}
          <View className="flex-row items-center gap-1.5">
            <Text size="sm" weight="medium" numberOfLines={1}>
              {name}
            </Text>
            <Icon name="chevron.up.chevron.down" size={11} tintColor={mutedForeground} />
          </View>
        </Pressable>
      </Menu.Trigger>
      <Menu.Content width="full" className="shadow-none rounded-none">
        <Menu.RadioGroup value={value} onValueChange={onChange}>
          {accounts.map((account) => (
            <Menu.RadioItem key={account.id} value={account.id}>
              {account.name}
            </Menu.RadioItem>
          ))}
        </Menu.RadioGroup>
      </Menu.Content>
    </Menu>
  );
}
