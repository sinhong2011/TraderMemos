import { useRouter } from 'expo-router';
import { Menu } from 'panelui-native';
import { Pressable } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { t } from '@lingui/core/macro';
import { Icon } from '@/components/icon';

/**
 * Header-right "+" — a pull-down fanning out to the creation flows.
 *
 * PanelUI `Menu` rather than a SwiftUI one: the panel is JS-drawn, so iOS and
 * Android get the same rows in the same order (Android has no `Menu` view
 * manager at all, and used to fall back to pushing the first action blind).
 * The trigger stays a plain tinted glyph — a bar item is already wrapped in
 * the platform's own circle, so custom chrome would nest a shape inside it.
 */
export function AddMenu() {
  const [foreground, popoverForeground] = useCSSVariable([
    '--color-foreground',
    '--color-popover-foreground',
  ]) as [string, string];
  const router = useRouter();

  const actions = [
    { label: t`New trade`, systemImage: 'chart.line.uptrend.xyaxis', href: '/new-trade' },
    { label: t`New note`, systemImage: 'note.text', href: '/new-note' },
    { label: t`New setup`, systemImage: 'checklist', href: '/new-setup' },
  ] as const;

  return (
    <Menu>
      <Menu.Trigger>
        <Pressable
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={t`Add`}
          className="h-8 w-8 items-center justify-center active:opacity-60"
        >
          <Icon name="plus" size={18} tintColor={foreground} weight="semibold" />
        </Pressable>
      </Menu.Trigger>
      <Menu.Content align="end" minWidth={220}>
        {actions.map((action) => (
          <Menu.Item
            key={action.href}
            icon={<Icon name={action.systemImage} size={16} tintColor={popoverForeground} />}
            onSelect={() => router.push(action.href)}
          >
            {action.label}
          </Menu.Item>
        ))}
      </Menu.Content>
    </Menu>
  );
}
