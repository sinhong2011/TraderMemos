import { Frame, Text } from 'panelui-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { Icon } from '@/components/icon';

export interface AccountRowProps {
  name: string;
  /** "IBKR · USD · 12 trades" — the formatted meta line under the name. */
  meta: string;
  /** Formatted equity (funded base + realized P&L). */
  equity: string;
  /** Formatted, signed P&L. */
  pnl: string;
  /** The profit/loss/muted color the P&L line reads in. */
  pnlColor: string;
  /** Optional status pill beside the name (broker sync health). */
  badge?: ReactNode;
  onPress: () => void;
}

/**
 * The settings hub's account row: name + meta leading, equity + P&L trailing,
 * disclosure chevron. Both figures carry tabular figures so a column of
 * accounts lines up, per DESIGN.md.
 */
export function AccountRow({ name, meta, equity, pnl, pnlColor, badge, onPress }: AccountRowProps) {
  const [mutedForeground] = useCSSVariable(['--color-muted-foreground']) as [string];

  return (
    <Frame.Row onPress={onPress}>
      <Frame.Content>
        {badge ? (
          <View className="flex-row items-center gap-2">
            <Frame.Title>{name}</Frame.Title>
            {badge}
          </View>
        ) : (
          <Frame.Title>{name}</Frame.Title>
        )}
        <Frame.Description>{meta}</Frame.Description>
      </Frame.Content>
      <Frame.Actions className="flex-col items-end gap-0.5">
        <Text size="sm" className="tabular-nums">
          {equity}
        </Text>
        <Text size="xs" className="tabular-nums" style={{ color: pnlColor }}>
          {pnl}
        </Text>
      </Frame.Actions>
      <Icon name="chevron.right" size={12} tintColor={mutedForeground} />
    </Frame.Row>
  );
}
