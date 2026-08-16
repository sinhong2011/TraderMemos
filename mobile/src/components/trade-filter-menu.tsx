import { Menu } from 'panelui-native';
import { Fragment } from 'react';
import type { SFSymbol } from 'sf-symbols-typescript';
import { Pressable } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { t } from '@lingui/core/macro';
import { Icon } from '@/components/icon';

export type FilterGroup = {
  key: string;
  /**
   * Names the dimension. With one group the options are listed straight into
   * the menu; with several, each becomes a submenu under this name — three
   * runs of checkmarks separated by bare dividers gave no clue which run was
   * dates and which was markets, and ran fifteen rows deep with a scrollbar.
   */
  title?: string;
  /** Leading glyph on the submenu row — makes the dimensions scannable. */
  icon?: SFSymbol;
  options: readonly { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
};

/** Trailing summary on a submenu row, so a filter shows without opening it. */
function groupSummary(group: FilterGroup): string {
  const isDefault = group.value === group.options[0]?.value;
  const selected = group.options.find((option) => option.value === group.value);
  return !isDefault && selected ? `${group.title} · ${selected.label}` : (group.title ?? '');
}

/**
 * Nav-bar pull-down button (iOS Mail/Files pattern): a checkmarked group per
 * dimension; the icon fills when anything is active, and an active menu offers
 * a single reset instead of making you walk every group back to its "All".
 */
export function TradeFilterMenu({
  groups,
  active,
  label,
  systemImage = 'line.3.horizontal.decrease.circle',
  activeSystemImage = 'line.3.horizontal.decrease.circle.fill',
  onReset,
}: {
  groups: FilterGroup[];
  active: boolean;
  label?: string;
  systemImage?: SFSymbol;
  activeSystemImage?: SFSymbol;
  /** Shown as a destructive row at the foot of the menu while `active`. */
  onReset?: () => void;
}) {
  const [foreground, destructive] = useCSSVariable([
    '--color-foreground',
    '--color-destructive',
  ]) as [string, string];
  // One group's options are listed straight into the panel; several become
  // submenus, which is what keeps the dimensions named and the panel short.
  const nested = groups.length > 1;

  const options = (group: FilterGroup) => (
    <Menu.RadioGroup value={group.value} onValueChange={group.onChange}>
      {group.options.map((option) => (
        <Menu.RadioItem key={option.value} value={option.value}>
          {option.label}
        </Menu.RadioItem>
      ))}
    </Menu.RadioGroup>
  );

  return (
    <Menu presentation="bottom-sheet">
      <Menu.Trigger>
        <Pressable
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={label ?? t`Filter`}
          className="h-8 w-8 items-center justify-center active:opacity-60"
        >
          {/* Neutral glyph — bar icons default to the accent tint. */}
          <Icon
            name={active ? activeSystemImage : systemImage}
            size={18}
            tintColor={foreground}
          />
        </Pressable>
      </Menu.Trigger>
      <Menu.Content width="full" className="shadow-none rounded-none">
        {groups.map((group) =>
          nested ? (
            <Menu.Sub key={group.key}>
              <Menu.SubTrigger
                icon={
                  group.icon ? <Icon name={group.icon} size={16} tintColor={foreground} /> : null
                }
              >
                {groupSummary(group)}
              </Menu.SubTrigger>
              <Menu.SubContent>{options(group)}</Menu.SubContent>
            </Menu.Sub>
          ) : (
            <Fragment key={group.key}>{options(group)}</Fragment>
          ),
        )}
        {onReset && active ? (
          <>
            <Menu.Separator />
            <Menu.Item
              variant="destructive"
              icon={<Icon name="arrow.counterclockwise" size={16} tintColor={destructive} />}
              onSelect={onReset}
            >
              {t`Clear filters`}
            </Menu.Item>
          </>
        ) : null}
      </Menu.Content>
    </Menu>
  );
}
