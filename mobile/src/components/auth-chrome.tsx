import { t } from '@lingui/core/macro';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet as RNStyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCSSVariable } from 'uniwind';

import { Icon } from '@/components/icon';
import type { ServerProbe } from '@/lib/server-probe';

const GRID_CELL = 44;

/** Quiet hairline grid — the native translation of the web AuthShell's grid void. */
function AuthGridPattern() {
  const { width, height } = useWindowDimensions();
  const cols = Math.ceil(width / GRID_CELL);
  const rows = Math.ceil(height / GRID_CELL);

  return (
    <View style={RNStyleSheet.absoluteFill}>
      {Array.from({ length: cols }, (_, i) => (
        <View
          key={`v${i}`}
          className="absolute bottom-0 top-0 bg-border opacity-40"
          style={{ left: (i + 1) * GRID_CELL, width: RNStyleSheet.hairlineWidth }}
        />
      ))}
      {Array.from({ length: rows }, (_, i) => (
        <View
          key={`h${i}`}
          className="absolute left-0 right-0 bg-border opacity-40"
          style={{ top: (i + 1) * GRID_CELL, height: RNStyleSheet.hairlineWidth }}
        />
      ))}
    </View>
  );
}

/**
 * Shared chrome for Sign in and Set up: grid void, brand wash, reading-measure
 * column, and the Android cutout pad. The two screens stay siblings this way.
 */
export function AuthScreen({ children }: { children: ReactNode }) {
  const { width: windowWidth } = useWindowDimensions();
  const wide = windowWidth >= 600;
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-background">
      <View pointerEvents="none" style={RNStyleSheet.absoluteFill}>
        <AuthGridPattern />
        <View
          style={[
            RNStyleSheet.absoluteFill,
            {
              experimental_backgroundImage:
                'radial-gradient(circle at 50% 18%, rgba(4, 144, 200, 0.10) 0%, rgba(4, 144, 200, 0) 45%)',
            },
          ]}
        />
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerClassName={wide ? 'p-4 grow justify-center py-6' : 'p-4'}
          contentContainerStyle={
            Platform.OS === 'android'
              ? { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }
              : undefined
          }
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >
          <View className="w-full max-w-[420px] self-center gap-4">{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

/**
 * Verdict on the typed host. Absent until something has been typed, so the
 * label row stays quiet on a first, empty run.
 *
 * `needs_setup` is not `reachable`: the process answered, but nobody can sign
 * in until the owner account exists.
 */
export function ProbeChip({ probe }: { probe: ServerProbe | null }) {
  const [mutedForeground, profit, destructive, heading] = useCSSVariable([
    '--color-muted-foreground',
    '--color-profit',
    '--color-destructive',
    '--color-heading',
  ]) as [string, string, string, string];
  if (!probe) return null;
  if (probe.state === 'checking') {
    return (
      <View className="flex-row items-center gap-1">
        <ActivityIndicator size="small" color={mutedForeground} />
        <Text className="text-[13px] text-muted-foreground">{t`Checking…`}</Text>
      </View>
    );
  }
  if (probe.state === 'needs_setup') {
    return (
      <View className="flex-row items-center gap-1">
        <Icon name="exclamationmark.circle.fill" size={13} tintColor={heading} />
        <Text className="text-[13px] font-semibold text-heading">{t`Needs setup`}</Text>
      </View>
    );
  }
  const reachable = probe.state === 'reachable';
  return (
    <View className="flex-row items-center gap-1">
      <Icon
        name={reachable ? 'checkmark.circle.fill' : 'exclamationmark.circle.fill'}
        size={13}
        tintColor={reachable ? profit : destructive}
      />
      <Text
        className={
          reachable
            ? 'text-[13px] font-semibold text-profit'
            : 'text-[13px] font-semibold text-destructive'
        }
      >
        {reachable ? t`Reachable` : t`No answer`}
      </Text>
    </View>
  );
}
