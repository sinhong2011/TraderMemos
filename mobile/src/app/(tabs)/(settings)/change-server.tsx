import { Text } from 'panelui-native';
import { useState } from 'react';

import { normalizeServerUrl, useSession } from '@/api/session';
import { CenteredButton } from '@/components/centered-button';
import { FormField, FormInput, FormScreen } from '@/components/form-kit';
import { useApplyServerChange } from '@/lib/change-server';
import { t } from '@lingui/core/macro';

/**
 * Point the app at a different TraderMemos instance. An entry form (the form
 * kit), pushed from the hub's Server row.
 *
 * The commit stays disabled until the draft normalizes to a *different*
 * address — an unchanged or empty value has nothing to move to, and the old
 * "silently keep the session" rule is better shown as a dead button than
 * enforced after the tap. It is destructive like Sign out because it is one:
 * both halves of the session belong to the old server, and queued offline
 * writes go with them.
 */
export default function ChangeServerScreen() {
  const { session } = useSession();
  const applyChange = useApplyServerChange();

  const current = session?.serverUrl ?? '';
  const [draft, setDraft] = useState(current);
  // One-way: applying signs out and replaces this screen with /login, so the
  // flag only ever guards the switch's in-flight window.
  const [busy, setBusy] = useState(false);

  const next = normalizeServerUrl(draft);
  const canApply = !!next && next !== current;

  return (
    <FormScreen>
      <FormField label={t`Server address`}>
        <FormInput
          value={draft}
          onChangeText={setDraft}
          placeholder="https://trades.example.com"
          description={t`Origin only — the app adds /api/v1 itself.`}
          keyboardType="url"
          textContentType="URL"
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel={t`Server address`}
        />
      </FormField>

      <CenteredButton
        role="destructive"
        label={busy ? t`Switching…` : t`Change & sign out`}
        disabled={!canApply}
        loading={busy}
        onPress={() => {
          if (!canApply || !next) return;
          setBusy(true);
          void applyChange(next);
        }}
      />
      <Text size="xs" muted className="px-4">
        {t`Points the app at a different TraderMemos instance and signs you out. Unsynced offline changes will be discarded.`}
      </Text>
    </FormScreen>
  );
}
