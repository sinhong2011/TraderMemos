import {
  Button,
  Menu,
  Toggle,
} from '@expo/ui/swift-ui';
import { labelStyle, menuActionDismissBehavior, tint } from '@expo/ui/swift-ui/modifiers';
import type { SFSymbol } from 'sf-symbols-typescript';
import { useUnistyles } from 'react-native-unistyles';

import { t } from '@lingui/core/macro';
import { AppHost } from '@/components/app-host';

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
 * `Toggle` rows plus `menuActionDismissBehavior('disabled')` are what make that
 * work: a plain `Button` row closes the menu on every tap, so choosing three
 * currencies meant reopening the menu three times.
 */
export function EventFilterMenu({
  groups,
  onReset,
}: {
  groups: FilterToggleGroup[];
  /** Shown as a destructive row at the foot of the menu while anything is on. */
  onReset: () => void;
}) {
  const { theme } = useUnistyles();
  const active = groups.some((group) => group.selected.length > 0);

  return (
    <AppHost matchContents>
      <Menu
        label={t`Filter`}
        systemImage={
          active ? 'line.3.horizontal.decrease.circle.fill' : 'line.3.horizontal.decrease.circle'
        }
        // Neutral glyph — primary is fill-only, and bar icons default to accent.
        modifiers={[
          labelStyle('iconOnly'),
          tint(active ? theme.colors.primary : theme.colors.foreground),
          menuActionDismissBehavior('disabled'),
        ]}
      >
        {groups.map((group) => (
          <Menu
            key={group.key}
            label={summary(group)}
            systemImage={group.icon}
            modifiers={[menuActionDismissBehavior('disabled')]}
          >
            {group.options.map((option) => (
              <Toggle
                key={option.value}
                label={option.label}
                isOn={group.selected.includes(option.value)}
                onIsOnChange={() => group.onToggle(option.value)}
              />
            ))}
          </Menu>
        ))}
        {active ? (
          <Button
            role="destructive"
            label={t`Clear filters`}
            systemImage="arrow.counterclockwise"
            onPress={onReset}
          />
        ) : null}
      </Menu>
    </AppHost>
  );
}
