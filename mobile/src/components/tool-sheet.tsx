import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { FormSheet } from '@/components/form-sheet';
import { t } from '@lingui/core/macro';

/**
 * Scaffold for the calculator sheets. Same chrome as every other sheet in the
 * app (`FormSheet`, iOS 26 glass): a calculator has nothing to cancel — the
 * numbers are the result — so it drops the close affordance and names its one
 * action Done.
 */
export function ToolSheet({ title, children }: { title: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <FormSheet inSheet hideClose title={title} saveLabel={t`Done`} onSave={() => router.back()}>
      {children}
    </FormSheet>
  );
}

/** Two-column input row — calculators pair related fields. */
export function ToolRow({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

export function ToolCol({ children }: { children: ReactNode }) {
  return <View style={styles.col}>{children}</View>;
}

const styles = StyleSheet.create((theme) => ({
  row: { flexDirection: 'row', gap: theme.spacing.md },
  col: { flex: 1 },
}));
