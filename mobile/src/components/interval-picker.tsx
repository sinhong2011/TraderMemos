import { View } from 'react-native';

import { t } from '@lingui/core/macro';
import type { BarInterval } from '@/api/types';
import { Segmented } from '@/components/segmented';
import { INTERVALS_MORE, INTERVALS_QUICK } from '@/lib/trade-bars';

/**
 * The chart timeframe control: the working intervals (1m 5m 30m 1H 1D) as bare
 * text segments, with the longer/odd ones (15m 4H 1W 1M) behind a chevron so
 * five quick picks don't become nine. When the current interval is one of the
 * hidden set, the chevron trigger names it in the same selected weight the
 * segments use — the choice never disappears.
 */
export function IntervalPicker({
  value,
  onChange,
}: {
  value: BarInterval;
  onChange: (next: BarInterval) => void;
}) {
  return (
    <View className="flex-row items-center">
      <Segmented bare options={INTERVALS_QUICK} value={value} onChange={onChange} />
      <Segmented
        bare
        variant="menu"
        title={t`More intervals`}
        options={INTERVALS_MORE}
        value={value}
        onChange={onChange}
      />
    </View>
  );
}
