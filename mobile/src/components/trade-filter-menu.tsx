import {
  Button,
  Menu,
  Picker,
  Text as UIText,
} from '@expo/ui/swift-ui';
import { labelStyle, pickerStyle, tag, tint } from '@expo/ui/swift-ui/modifiers';
import { Fragment } from 'react';
import type { SFSymbol } from 'sf-symbols-typescript';
import { Alert, Platform, Pressable } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { t } from '@lingui/core/macro';
import { AppHost } from '@/components/app-host';
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
  const { theme } = useUnistyles();
  // A `Section` title is dropped when the menu flattens it inline, so grouping
  // has to come from real submenus — those keep their label.
  const nested = groups.length > 1;

  // Android has no `Menu` view manager, and nothing in Compose nests a
  // checkmarked picker inside a pull-down the way UIMenu does. Same fallback as
  // `AccountMenu`: the glyph opens the platform's own chooser. Two steps rather
  // than one when there are several dimensions — an Alert cannot nest, so the
  // first sheet picks the dimension and the second its value, which is also how
  // the submenus read on iOS.
  if (Platform.OS !== 'ios') {
    const chooseValue = (group: FilterGroup) =>
      Alert.alert(group.title ?? (label ?? t`Filter`), undefined, [
        ...group.options.map((option) => ({
          text: option.value === group.value ? `✓ ${option.label}` : option.label,
          onPress: () => group.onChange(option.value),
        })),
        { text: t`Cancel`, style: 'cancel' as const },
      ]);

    return (
      <Pressable
        onPress={() => {
          if (!nested) {
            chooseValue(groups[0]);
            return;
          }
          Alert.alert(label ?? t`Filter`, undefined, [
            ...groups.map((group) => ({
              text: groupSummary(group),
              onPress: () => chooseValue(group),
            })),
            ...(onReset && active
              ? [{ text: t`Clear filters`, style: 'destructive' as const, onPress: onReset }]
              : []),
            { text: t`Cancel`, style: 'cancel' as const },
          ]);
        }}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={label ?? t`Filter`}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Icon
          name={active ? activeSystemImage : systemImage}
          size={18}
          tintColor={theme.colors.foreground}
        />
      </Pressable>
    );
  }

  const picker = (group: FilterGroup) => (
    <Picker
      selection={group.value}
      onSelectionChange={(selection) => {
        if (selection != null) group.onChange(selection);
      }}
      modifiers={[pickerStyle('inline')]}
    >
      {group.options.map((option) => (
        <UIText key={option.value} modifiers={[tag(option.value)]}>
          {option.label}
        </UIText>
      ))}
    </Picker>
  );

  return (
    <AppHost matchContents>
      <Menu
        label={label ?? t`Filter`}
        systemImage={active ? activeSystemImage : systemImage}
        // Neutral glyph — primary is fill-only, and bar icons default to accent.
        modifiers={[labelStyle('iconOnly'), tint(theme.colors.foreground)]}
      >
        {groups.map((group) =>
          nested ? (
            <Menu key={group.key} label={groupSummary(group)} systemImage={group.icon}>
              {picker(group)}
            </Menu>
          ) : (
            <Fragment key={group.key}>{picker(group)}</Fragment>
          ),
        )}
        {onReset && active ? (
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

const styles = StyleSheet.create(() => ({
  button: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
}));
