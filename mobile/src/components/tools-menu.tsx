import { useRouter, type Href } from 'expo-router';
import { type SFSymbol } from 'expo-symbols';
import { Menu } from 'panelui-native';
import { Fragment } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { t } from '@lingui/core/macro';
import { Icon } from '@/components/icon';
import { useTradingSession } from '@/lib/live-activity';

/**
 * Home-header wrench menu — everywhere you go from Home that isn't a tab.
 *
 * Presented as a bottom sheet with two shapes of content: the journal
 * destinations stay reading-order rows, while the tools are a two-column grid
 * of tiles — calculators are "grab one" objects, not a list you read top to
 * bottom, and the grid halves the sheet's height. Notes and Playbook live
 * here as well as on their dashboard cards because the cards sit below every
 * analytics block — reaching your own journal should not mean scrolling past
 * the whole dashboard.
 *
 * PanelUI `Menu`, so the same sheet draws on both platforms — Android has no
 * pull-down view manager, and the old fallback pushed one hardcoded action.
 */
export function ToolsMenu() {
  const [foreground, overlayForeground, chart1, chart2, chart3, chart4, chart5, open, profit, heading] =
    useCSSVariable([
      '--color-foreground',
      '--color-overlay-foreground',
      '--color-chart-1',
      '--color-chart-2',
      '--color-chart-3',
      '--color-chart-4',
      '--color-chart-5',
      '--color-open',
      '--color-profit',
      '--color-heading',
    ]) as string[];
  // Curated per-tool accents from the brand ramp — assigned, not hashed, so
  // neighbouring tiles never share a hue.
  const hues = { chart1, chart2, chart3, chart4, chart5, open, profit, heading };
  const router = useRouter();
  // Lock Screen / Dynamic Island trading session (lib/live-activity.ts).
  // Lives here because this menu is where the day starts, same reasoning as
  // the daily checklist below.
  const tradingSession = useTradingSession();

  const tools: { label: string; systemImage: SFSymbol; href: Href; hue: string }[] = [
    // Promoted out of the tab bar (2026-08-09) when the search tab took the
    // fifth slot; first here because it was a top-level destination.
    {
      label: t`Reports`,
      systemImage: 'chart.pie',
      href: '/(tabs)/(dashboard)/reports',
      hue: hues.chart1,
    },
    {
      label: t`Position size`,
      systemImage: 'scalemass',
      href: '/tool-position-size',
      hue: hues.chart3,
    },
    { label: t`Kelly criterion`, systemImage: 'percent', href: '/tool-kelly',
      hue: hues.chart5,
    },
    {
      label: t`Currency converter`,
      systemImage: 'arrow.left.arrow.right',
      href: '/tool-fx',
      hue: hues.open,
    },
    {
      label: t`R calculator`,
      systemImage: 'plus.forwardslash.minus',
      href: '/(tabs)/(dashboard)/r-calculator',
      hue: hues.profit,
    },
    {
      label: t`Symbol journal`,
      systemImage: 'chart.xyaxis.line',
      href: '/(tabs)/(dashboard)/symbol-journal',
      hue: hues.chart2,
    },
    {
      label: t`Backtest`,
      systemImage: 'backward.frame',
      href: '/(tabs)/(dashboard)/backtest',
      hue: hues.heading,
    },
    {
      label: t`Economic calendar`,
      systemImage: 'newspaper',
      href: '/(tabs)/(dashboard)/economic-events',
      hue: hues.chart4,
    },
  ];

  const journal: { label: string; systemImage: SFSymbol; href: Href }[] = [
    { label: t`Notes`, systemImage: 'note.text', href: '/(tabs)/(dashboard)/notes' },
    { label: t`Playbook`, systemImage: 'bookmark', href: '/(tabs)/(dashboard)/playbook' },
    // The routine is a start-of-day thing and this menu is where the day
    // starts, so the editor lives in the Home stack rather than in Settings —
    // back returns you to Home, not to a settings list you never opened.
    {
      label: t`Daily checklist`,
      systemImage: 'checklist',
      href: '/(tabs)/(dashboard)/checklist',
    },
  ];

  const rowIcon = (name: SFSymbol) => (
    <Icon name={name} size={16} tintColor={overlayForeground} />
  );

  return (
    <Menu presentation="bottom-sheet">
      <Menu.Trigger>
        <Pressable
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t`Tools`}
          className="h-8 w-8 items-center justify-center active:opacity-60"
        >
          <Icon name="wrench.and.screwdriver" size={17} tintColor={foreground} />
        </Pressable>
      </Menu.Trigger>
      {/* shadow-none: the sheet is already the surface, but Menu.Content
          always adds its popover panel chrome (shadow-lg halo + rounded
          box) which reads as a second card floating inside the sheet. */}
      <Menu.Content width="full" className="shadow-none rounded-none">
        {tradingSession.supported ? (
          <Fragment>
            <Menu.Label>{t`Session`}</Menu.Label>
            {tradingSession.active ? (
              <Menu.Item icon={rowIcon('stop.circle')} onSelect={tradingSession.end}>
                {t`End Lock Screen session`}
              </Menu.Item>
            ) : (
              <Menu.Item
                icon={rowIcon('dot.radiowaves.left.and.right')}
                onSelect={tradingSession.start}
              >
                {t`Show session on Lock Screen`}
              </Menu.Item>
            )}
            <Menu.Separator />
          </Fragment>
        ) : null}
        <Menu.Label>{t`Journal`}</Menu.Label>
        {journal.map((action) => (
          <Menu.Item
            key={action.label}
            icon={rowIcon(action.systemImage)}
            onSelect={() => router.push(action.href)}
          >
            {action.label}
          </Menu.Item>
        ))}
        <Menu.Separator />
        <Menu.Label>{t`Tools`}</Menu.Label>
        {/* Bento grid: quiet muted tiles, icon anchored top, label at the
            base. Menu.Item keeps the press fill/scale and close-on-select;
            the class overrides reshape the row into a tile. */}
        <View className="flex-row flex-wrap gap-2 pb-1 pt-1">
          {tools.map((action) => (
            <Menu.Item
              key={action.label}
              className="min-h-[86px] w-[48%] flex-col items-start justify-between gap-3 rounded-2xl bg-secondary p-3"
              onSelect={() => router.push(action.href)}
            >
              {/* Tinted well in the tool's own accent — the tile's identity,
                  like the iOS Settings glyph grid. Hues are data-resolved
                  hexes, so the wash rides `style`. */}
              <View
                className="h-8 w-8 items-center justify-center rounded-[10px]"
                style={{ backgroundColor: `${action.hue}26` }}
              >
                <Icon name={action.systemImage} size={16} tintColor={action.hue} />
              </View>
              <Text numberOfLines={2} className="text-[13px] font-medium text-overlay-foreground">
                {action.label}
              </Text>
            </Menu.Item>
          ))}
        </View>
      </Menu.Content>
    </Menu>
  );
}
