import { Skeleton as PanelSkeleton, cn } from 'panelui-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { View } from 'react-native';

/**
 * Animated placeholder for data-fetch loading states (cards, list rows,
 * boards). Spinners stay reserved for action feedback (form submits, sign-in).
 *
 * PanelUI owns the pulse — including stopping it under the platform's
 * reduce-motion setting — but its `Skeleton` takes only a `className`, and the
 * ~40 call sites here size their placeholders with a `style`. So the box is
 * ours and the pulse is PanelUI's, filling it: the wrapper carries whatever
 * size and corner the caller asked for and clips the block to it.
 */
export function Skeleton({
  style,
  className,
}: {
  style?: StyleProp<ViewStyle>;
  className?: string;
}) {
  return (
    <View style={style} className={cn('overflow-hidden rounded-md', className)}>
      {/* The corner lives on the wrapper, which is the view that was given one. */}
      <PanelSkeleton className="h-full w-full rounded-none" />
    </View>
  );
}

/** Placeholder for a creation form still fetching its prefill data. */
export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <View className="gap-4 p-4">
      {Array.from({ length: fields }, (_, i) => (
        <View key={i} className="gap-2">
          <Skeleton className="h-[14px] w-[90px]" />
          <Skeleton className="h-[50px] rounded-[16px]" />
        </View>
      ))}
    </View>
  );
}
