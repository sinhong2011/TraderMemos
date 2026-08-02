import { Host, Menu, Picker, Text as UIText } from '@expo/ui/swift-ui';
import { labelStyle, pickerStyle, tag, tint } from '@expo/ui/swift-ui/modifiers';
import type { SFSymbol } from 'sf-symbols-typescript';
import { useUnistyles } from 'react-native-unistyles';

import { t } from '@lingui/core/macro';

export type FilterGroup = {
  key: string;
  options: readonly { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
};

/**
 * Nav-bar pull-down button (iOS Mail/Files pattern): one menu holding a
 * checkmarked group per dimension; the icon fills when anything is active.
 */
export function TradeFilterMenu({
  groups,
  active,
  label,
  systemImage = 'line.3.horizontal.decrease.circle',
  activeSystemImage = 'line.3.horizontal.decrease.circle.fill',
}: {
  groups: FilterGroup[];
  active: boolean;
  label?: string;
  systemImage?: SFSymbol;
  activeSystemImage?: SFSymbol;
}) {
  const { theme } = useUnistyles();
  return (
    <Host matchContents>
      <Menu
        label={label ?? t`Filter`}
        systemImage={active ? activeSystemImage : systemImage}
        // Neutral glyph — primary is fill-only, and bar icons default to accent.
        modifiers={[labelStyle('iconOnly'), tint(theme.colors.foreground)]}
      >
        {groups.map((group) => (
          <Picker
            key={group.key}
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
        ))}
      </Menu>
    </Host>
  );
}
