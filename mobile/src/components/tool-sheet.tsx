import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, Text , View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { t } from '@lingui/core/macro';

/**
 * Scaffold for the calculator form sheets: title + Done over the inputs.
 * Form sheets lay non-scroll children on top of each other — the content
 * root must be a ScrollView (see manage-tags.tsx).
 */
export function ToolSheet({ title, children }: { title: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets
    >
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          style={({ pressed }) => [styles.doneButton, pressed && styles.pressed]}
        >
          <Text style={styles.doneLabel}>{t`Done`}</Text>
        </Pressable>
      </View>
      {children}
    </ScrollView>
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
  page: { flex: 1, backgroundColor: theme.colors.background },
  content: {
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.xl * 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xs,
  },
  title: { fontSize: 20, fontWeight: '700', color: theme.colors.foreground },
  doneButton: { paddingVertical: 4, paddingHorizontal: 4 },
  pressed: { opacity: 0.6 },
  doneLabel: { fontSize: 15, fontWeight: '600', color: theme.colors.foreground },
  row: { flexDirection: 'row', gap: theme.spacing.md },
  col: { flex: 1 },
}));
