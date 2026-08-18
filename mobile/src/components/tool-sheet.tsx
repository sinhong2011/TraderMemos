import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { FormSheet } from '@/components/form-sheet';
import { t } from '@lingui/core/macro';

/**
 * Scaffold for the calculator sheets. Same chrome as every other sheet in the
 * app (`FormSheet`): a calculator has nothing to cancel or commit — the
 * numbers are the result — so its one control is the close circle (a labelled
 * "Done" capsule read as an action still waiting to happen).
 */
export function ToolSheet({ title, children }: { title: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <FormSheet
      inSheet
      hideClose
      title={title}
      saveIcon="xmark"
      saveLabel={t`Close`}
      onSave={() => router.back()}
    >
      {children}
    </FormSheet>
  );
}

/** Two-column input row — calculators pair related fields. */
export function ToolRow({ children }: { children: ReactNode }) {
  return <View className="flex-row gap-3">{children}</View>;
}

export function ToolCol({ children }: { children: ReactNode }) {
  return <View className="flex-1">{children}</View>;
}
