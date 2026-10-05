import { useRouter } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { useReviewInbox } from '@/api/hooks';
import { Icon } from '@/components/icon';
import { t } from '@lingui/core/macro';

/**
 * "3 trades to review" on Home — the way into the review queue. Renders
 * nothing while the inbox is empty or unknown: it is a job waiting, not a
 * standing feature (ChecklistCard's rule).
 */
export function ReviewInboxRow() {
  const router = useRouter();
  const inbox = useReviewInbox();
  const [heading, mutedForeground] = useCSSVariable([
    '--color-heading',
    '--color-muted-foreground',
  ]) as [string, string];

  const count = inbox.data?.items.length ?? 0;
  if (count === 0) return null;

  const label = count === 1 ? t`1 trade to review` : t`${count} trades to review`;
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/quick-journal', params: { queue: '1' } })}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="flex-row items-center gap-3 rounded-2xl bg-card px-4 py-3.5 active:opacity-70"
    >
      <Icon name="tray" size={18} tintColor={heading} />
      <Text className="flex-1 text-[15px] font-medium text-foreground tabular-nums">{label}</Text>
      <Icon name="chevron.right" size={12} tintColor={mutedForeground} />
    </Pressable>
  );
}
