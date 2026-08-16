import { t } from '@lingui/core/macro';
import { Menu } from 'panelui-native';
import { Pressable } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { useAccounts } from '@/api/hooks';
import { Icon } from '@/components/icon';
import { setSelectedAccountId, useSelectedAccountId } from '@/lib/account-store';

/** Sentinel for the unscoped choice — account ids are server-issued, so no id collides with it. */
const ALL_ACCOUNTS = '__all__';

/**
 * Header account scope switcher — a menu listing every account plus "All
 * accounts", with a checkmark on the active pick. The trigger glyph switches
 * from the neutral outline to the filled variant when a single account is
 * scoped, so the narrowed view is visible at a glance without a label crowding
 * the bar.
 */
export function AccountMenu() {
  const [foreground] = useCSSVariable(['--color-foreground']) as [string];
  const accounts = useAccounts();
  const selectedId = useSelectedAccountId();

  // Always render: the bar reserves the slot either way, so a null here leaves
  // a dead gap. With a lone account the menu simply shows it under "All
  // accounts".
  const list = accounts.data ?? [];

  const scoped = selectedId != null && list.some((account) => account.id === selectedId);
  const icon = scoped ? 'person.crop.circle.fill' : 'person.crop.circle';

  // Bottom sheet, not an anchored popover: the native-feeling idiom on both
  // platforms, and it needs no trigger anchoring or width floor.
  return (
    <Menu presentation="bottom-sheet">
      <Menu.Trigger>
        <Pressable
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t`Switch account`}
          className="h-8 w-8 items-center justify-center active:opacity-60"
        >
          <Icon name={icon} size={18} tintColor={foreground} />
        </Pressable>
      </Menu.Trigger>
      {/* Explicit floor: with the default content-fit width the flex-1 label
          column collapses to zero and the menu renders as an empty pillar —
          every Menu.Content in the app sets minWidth for this reason. */}
      <Menu.Content align="start" minWidth={240}>
        <Menu.RadioGroup
          value={scoped ? (selectedId as string) : ALL_ACCOUNTS}
          onValueChange={(value) =>
            setSelectedAccountId(value === ALL_ACCOUNTS ? null : value)
          }
        >
          <Menu.RadioItem value={ALL_ACCOUNTS}>{t`All accounts`}</Menu.RadioItem>
          {list.map((account) => (
            <Menu.RadioItem key={account.id} value={account.id}>
              {account.name}
            </Menu.RadioItem>
          ))}
        </Menu.RadioGroup>
      </Menu.Content>
    </Menu>
  );
}
