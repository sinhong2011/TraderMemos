import { t } from '@lingui/core/macro';
import { useRouter } from 'expo-router';
import { Menu } from 'panelui-native';
import { Pressable, Text, View } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { useAccounts } from '@/api/hooks';
import type { Account } from '@/api/types';
import { Icon } from '@/components/icon';
import { setSelectedAccountId, useSelectedAccountId } from '@/lib/account-store';

const CHART_TOKENS = [
  '--color-chart-1',
  '--color-chart-2',
  '--color-chart-3',
  '--color-chart-4',
  '--color-chart-5',
] as const;

/**
 * Stable hue pick per account — hashing the server id (not the list index)
 * keeps an account's color from shifting when another one is added.
 */
function hueIndex(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return hash % CHART_TOKENS.length;
}

/** `#RRGGBB` → translucent fill for the identity disc's ground. */
function withAlpha(hex: string, alpha: string): string {
  return hex.length === 7 ? `${hex}${alpha}` : hex;
}

/**
 * The account's identity mark: its initial on a tinted disc. The hue comes
 * from the chart ramp, so the discs stay on-palette in both schemes and the
 * same account is recognisable at a glance across visits.
 */
function AccountDisc({ account, colors }: { account: Account; colors: string[] }) {
  const hue = colors[hueIndex(account.id)];
  const initial = (account.name.trim()[0] ?? '?').toUpperCase();
  return (
    <View
      className="h-9 w-9 items-center justify-center rounded-full"
      style={{ backgroundColor: withAlpha(hue, '2E') }}
    >
      <Text className="text-[15px] font-semibold" style={{ color: hue }}>
        {initial}
      </Text>
    </View>
  );
}

/** Title + quiet metadata line every row shares. */
function RowBody({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View className="flex-1 gap-0.5">
      <Text className="text-base font-medium text-overlay-foreground">{title}</Text>
      <Text className="text-xs text-muted-foreground">{subtitle}</Text>
    </View>
  );
}

function SelectedCheck({ tint }: { tint: string }) {
  return <Icon name="checkmark.circle.fill" size={20} tintColor={tint} />;
}

/** `IBKR · USD · Paper` — only the parts an account actually carries. */
function accountSubtitle(account: Account): string {
  return [
    account.broker || null,
    account.base_currency || null,
    account.account_type === 'backtest' ? t`Paper` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * Header account scope switcher — a bottom sheet of identity-disc rows with a
 * combined "All accounts" summary on top and a quiet path to account
 * management below, so the sheet answers "who am I looking at?" and "where do
 * I change that?" in one place. The trigger glyph switches to the filled
 * variant while a single account is scoped.
 */
export function AccountMenu() {
  const router = useRouter();
  const [foreground, primary, ...chartColors] = useCSSVariable([
    '--color-foreground',
    '--color-primary',
    ...CHART_TOKENS,
  ]) as string[];
  const accounts = useAccounts();
  const selectedId = useSelectedAccountId();

  // Always render: the bar reserves the slot either way, so a null here leaves
  // a dead gap. With a lone account the menu simply shows it under "All
  // accounts".
  const list = accounts.data ?? [];

  const scoped = selectedId != null && list.some((account) => account.id === selectedId);
  const icon = scoped ? 'person.crop.circle.fill' : 'person.crop.circle';

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
      {/* width="full": a sheet centres content-fit panels, which strands short
          rows in a narrow card — rows span the sheet instead. */}
      <Menu.Content width="full">
        <Menu.Label>{t`Account`}</Menu.Label>
        <Menu.Item
          accessibilityState={{ selected: !scoped }}
          onSelect={() => setSelectedAccountId(null)}
          trailing={!scoped ? <SelectedCheck tint={primary} /> : null}
        >
          <View className="flex-row items-center gap-3">
            <View className="h-9 w-9 items-center justify-center rounded-full bg-fill">
              <Icon name="square.stack.3d.up" size={16} tintColor={foreground} />
            </View>
            <RowBody
              title={t`All accounts`}
              subtitle={t`Combined view · ${list.length} accounts`}
            />
          </View>
        </Menu.Item>
        {list.map((account) => {
          const selected = scoped && account.id === selectedId;
          return (
            <Menu.Item
              key={account.id}
              accessibilityState={{ selected }}
              onSelect={() => setSelectedAccountId(account.id)}
              trailing={selected ? <SelectedCheck tint={primary} /> : null}
            >
              <View className="flex-row items-center gap-3">
                <AccountDisc account={account} colors={chartColors} />
                <RowBody title={account.name} subtitle={accountSubtitle(account)} />
              </View>
            </Menu.Item>
          );
        })}
        <Menu.Separator />
        <Menu.Item
          icon={<Icon name="slider.horizontal.3" size={16} tintColor={foreground} />}
          onSelect={() => router.push('/(tabs)/(settings)')}
        >
          {t`Manage accounts`}
        </Menu.Item>
      </Menu.Content>
    </Menu>
  );
}
