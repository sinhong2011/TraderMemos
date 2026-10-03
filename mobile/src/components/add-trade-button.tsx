import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { t } from '@lingui/core/macro';

import { Icon } from '@/components/icon';
import { useCooldownLock } from '@/lib/cooldown';
import { notify } from '@/lib/haptics';

/**
 * Header-right "+" on Trades — straight to the trade form, unless a cooldown
 * is open: then it lands on the cooldown screen instead, with a warning
 * haptic, so the lock is felt at the exact moment of the impulse.
 *
 * It used to be a pull-down fanning out to notes and setups as well, which put
 * a menu in front of the action this app exists for: the tab you log trades
 * from asked which kind of thing you meant, several times a day, to serve two
 * flows you reach a handful of times a month. Both of those now have a + on
 * the screen that holds them (Notes, Playbook — quick links on Home), so the
 * one here can do the obvious thing in one tap.
 *
 * A plain tinted glyph, not custom chrome: a bar item is already wrapped in
 * the platform's own circle, so a shape of ours would render nested inside it.
 */
export function AddTradeButton() {
  const [foreground] = useCSSVariable(['--color-foreground']) as [string];
  const router = useRouter();
  const { locked } = useCooldownLock();

  return (
    <Pressable
      onPress={() => {
        if (locked) {
          notify('warning');
          router.push('/cooldown');
          return;
        }
        router.push('/new-trade');
      }}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={t`New trade`}
      className="h-8 w-8 items-center justify-center active:opacity-60"
    >
      <Icon name="plus" size={18} tintColor={foreground} weight="semibold" />
    </Pressable>
  );
}
