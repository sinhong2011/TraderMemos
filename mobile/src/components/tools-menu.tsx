import {
  Button as UIButton,
  Image as UIImage,
  Menu,
  Section,
} from '@expo/ui/swift-ui';
import { accessibilityLabel, buttonStyle, tint } from '@expo/ui/swift-ui/modifiers';
import { useRouter, type Href } from 'expo-router';
import { type SFSymbol } from 'expo-symbols';
import { Platform, Pressable } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { t } from '@lingui/core/macro';
import { Icon } from '@/components/icon';
import { AppHost } from '@/components/app-host';
import { useTradingSession } from '@/lib/live-activity';

/**
 * Home-header wrench menu — everywhere you go from Home that isn't a tab.
 *
 * Two sections: the calculators and market lookups (the phone home of the web
 * Tools popover), then the journal sections. Notes and Playbook live here as
 * well as on their dashboard cards because the cards sit below every analytics
 * block — reaching your own journal should not mean scrolling past the whole
 * dashboard. Sheets for the one-shot calculators; everything else pushes in
 * the Home stack.
 */
export function ToolsMenu() {
  const { theme } = useUnistyles();
  const router = useRouter();
  // Lock Screen / Dynamic Island trading session (lib/live-activity.ts).
  // Lives here because this menu is where the day starts, same reasoning as
  // the daily checklist below.
  const tradingSession = useTradingSession();

  const actions: { label: string; systemImage: SFSymbol; href: Href }[] = [
    // Promoted out of the tab bar (2026-08-09) when the search tab took the
    // fifth slot; first here because it was a top-level destination.
    {
      label: t`Reports`,
      systemImage: 'chart.pie',
      href: '/(tabs)/(dashboard)/reports',
    },
    {
      label: t`Position size`,
      systemImage: 'scalemass',
      href: '/tool-position-size',
    },
    { label: t`Kelly criterion`, systemImage: 'percent', href: '/tool-kelly' },
    {
      label: t`Currency converter`,
      systemImage: 'arrow.left.arrow.right',
      href: '/tool-fx',
    },
    {
      label: t`R calculator`,
      systemImage: 'plus.forwardslash.minus',
      href: '/(tabs)/(dashboard)/r-calculator',
    },
    {
      label: t`Symbol journal`,
      systemImage: 'chart.xyaxis.line',
      href: '/(tabs)/(dashboard)/symbol-journal',
    },
    {
      label: t`Backtest`,
      systemImage: 'backward.frame',
      href: '/(tabs)/(dashboard)/backtest',
    },
    {
      label: t`Economic calendar`,
      systemImage: 'newspaper',
      href: '/(tabs)/(dashboard)/economic-events',
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

  if (Platform.OS !== 'ios') {
    return (
      <Pressable
        onPress={() => router.push(actions[3].href)}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={t`Tools`}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Icon name="wrench.and.screwdriver" size={17} tintColor={theme.colors.foreground} />
      </Pressable>
    );
  }

  return (
    <AppHost matchContents>
      <Menu
        label={<UIImage systemName="wrench.and.screwdriver" size={16} />}
        modifiers={[buttonStyle('plain'), tint(theme.colors.foreground), accessibilityLabel(t`Tools`)]}
      >
        {tradingSession.supported && (
          <Section title={t`Session`}>
            {tradingSession.active ? (
              <UIButton
                label={t`End Lock Screen session`}
                systemImage="stop.circle"
                onPress={tradingSession.end}
              />
            ) : (
              <UIButton
                label={t`Show session on Lock Screen`}
                systemImage="dot.radiowaves.left.and.right"
                onPress={tradingSession.start}
              />
            )}
          </Section>
        )}
        <Section title={t`Journal`}>
          {journal.map((action) => (
            <UIButton
              key={action.label}
              label={action.label}
              systemImage={action.systemImage}
              onPress={() => router.push(action.href)}
            />
          ))}
        </Section>
        <Section title={t`Tools`}>
          {actions.map((action) => (
            <UIButton
              key={action.label}
              label={action.label}
              systemImage={action.systemImage}
              onPress={() => router.push(action.href)}
            />
          ))}
        </Section>
      </Menu>
    </AppHost>
  );
}

const styles = StyleSheet.create(() => ({
  button: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
}));
