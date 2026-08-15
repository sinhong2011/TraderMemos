import { Menu } from 'panelui-native';
import { Pressable } from 'react-native';
import type { SFSymbol } from 'sf-symbols-typescript';
import { useCSSVariable } from 'uniwind';

import { t } from '@lingui/core/macro';
import { Icon } from '@/components/icon';

export type FilterToggleGroup = {
  key: string;
  /** Names the dimension on its submenu row. */
  title: string;
  /** Leading glyph on the submenu row — makes the dimensions scannable. */
  icon: SFSymbol;
  options: readonly { value: string; label: string }[];
  selected: readonly string[];
  onToggle: (value: string) => void;
};

/** Trailing summary on a submenu row, so a filter reads without opening it. */
function summary(group: FilterToggleGroup): string {
  if (group.selected.length === 0) return group.title;
  if (group.selected.length === 1) {
    const only = group.options.find((option) => option.value === group.selected[0]);
    if (only) return `${group.title} · ${only.label}`;
  }
  return `${group.title} · ${group.selected.length}`;
}

/**
 * Nav-bar pull-down for filters you pick several of at once — the multi-select
 * sibling of [TradeFilterMenu], which pickers one value per dimension.
 *
 * `Menu.CheckboxItem` is what makes that work: it keeps the panel open when a
 * row is chosen, where a plain `Menu.Item` closes on every tap and choosing
 * three currencies would mean reopening the menu three times.
 */
export function EventFilterMenu({
  groups,
  onReset,
}: {
  groups: FilterToggleGroup[];
  /** Shown as a destructive row at the foot of the menu while anything is on. */
  onReset: () => void;
}) {
  const [foreground, primary, popoverForeground, destructive] = useCSSVariable([
    '--color-foreground',
    '--color-primary',
    '--color-popover-foreground',
    '--color-destructive',
  ]) as [string, string, string, string];
  const active = groups.some((group) => group.selected.length > 0);

  return (
    <Menu>
      <Menu.Trigger>
        <Pressable
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t`Filter`}
          className="h-8 w-8 items-center justify-center active:opacity-60"
        >
          {/* Neutral glyph unless something is on — primary is a fill, not a
              default bar tint. */}
          <Icon
            name={
              active
                ? 'line.3.horizontal.decrease.circle.fill'
                : 'line.3.horizontal.decrease.circle'
            }
            size={18}
            tintColor={active ? primary : foreground}
          />
        </Pressable>
      </Menu.Trigger>
      <Menu.Content align="end" minWidth={240}>
        {groups.map((group) => (
          <Menu.Sub key={group.key}>
            <Menu.SubTrigger
              icon={<Icon name={group.icon} size={16} tintColor={popoverForeground} />}
            >
              {summary(group)}
            </Menu.SubTrigger>
            <Menu.SubContent>
              {group.options.map((option) => (
                <Menu.CheckboxItem
                  key={option.value}
                  checked={group.selected.includes(option.value)}
                  onCheckedChange={() => group.onToggle(option.value)}
                >
                  {option.label}
                </Menu.CheckboxItem>
              ))}
            </Menu.SubContent>
          </Menu.Sub>
        ))}
        {active ? (
          <Menu.Item
            variant="destructive"
            icon={<Icon name="arrow.counterclockwise" size={16} tintColor={destructive} />}
            onSelect={onReset}
          >
            {t`Clear filters`}
          </Menu.Item>
        ) : null}
      </Menu.Content>
    </Menu>
  );
}
