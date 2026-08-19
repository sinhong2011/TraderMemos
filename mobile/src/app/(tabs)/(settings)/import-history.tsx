import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Frame, Text } from 'panelui-native';
import { Alert } from 'react-native';

import { useAccounts, useApiRequest, useImports } from '@/api/hooks';
import type { ImportBatch } from '@/api/types';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { Pill } from '@/components/pill';
import { SettingsForm } from '@/components/settings-form';
import { SettingsSection } from '@/components/settings-rows';
import { t } from '@lingui/core/macro';
import { errorMessage } from '@/lib/errors';
import { useFormatters } from '@/lib/format';
import { showToast } from '@/lib/toast';

/** Human name for an import batch's source key. */
function sourceLabel(source: string): string {
  if (source === 'ibkr-flex-sync') return t`IBKR Flex sync`;
  if (source === 'csv' || source === 'json' || source === 'file') return t`File import`;
  return source;
}

/**
 * Every batch of imported executions — scheduled syncs, manual syncs, and
 * file imports — with per-batch rollback (web ImportHistorySection parity).
 * Rolling a batch back deletes its executions and regroups trades.
 */
export default function ImportHistoryScreen() {
  const api = useApiRequest();
  const queryClient = useQueryClient();
  const imports = useImports();
  const { data: accounts } = useAccounts();
  const { formatDate, formatTime } = useFormatters();

  const rollback = useMutation({
    mutationFn: (batchId: string) => api<void>(`/imports/${batchId}`, { method: 'DELETE' }),
    onSuccess: () => {
      // A rollback deletes the batch's executions and regroups trades.
      void queryClient.invalidateQueries();
      showToast({ label: t`Import rolled back` });
    },
    onError: (err) => {
      Alert.alert(t`Could not roll back`, errorMessage(err));
    },
  });

  const accountName = (id: string) =>
    accounts?.find((account) => account.id === id)?.name ?? t`Deleted account`;

  const confirmRollback = (batch: ImportBatch) => {
    Alert.alert(
      t`Roll back this import?`,
      t`The ${batch.row_count} executions imported into ${accountName(batch.account_id)} will be deleted and trades regrouped. A later sync can import them again.`,
      [
        { text: t`Cancel`, style: 'cancel' },
        {
          text: t`Roll back`,
          style: 'destructive',
          onPress: () => rollback.mutate(batch.id),
        },
      ],
    );
  };

  const history = [...(imports.data ?? [])].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );

  return (
    <SettingsForm>
      {imports.isError ? (
        <ErrorState error={imports.error} onRetry={() => void imports.refetch()} />
      ) : history.length === 0 ? (
        <EmptyState
          systemImage="tray.and.arrow.down"
          title={t`Nothing imported yet`}
          description={t`Batches appear here after a sync or file import.`}
        />
      ) : (
        <SettingsSection footer={t`Rolling a batch back deletes its executions and regroups trades. A later sync can import them again.`}>
          {history.map((batch) => (
            <Frame.Row key={batch.id}>
              <Frame.Content>
                <Frame.Title>{sourceLabel(batch.source)}</Frame.Title>
                <Frame.Description>
                  {[
                    accountName(batch.account_id),
                    batch.filename,
                    t`${batch.row_count} rows`,
                    `${formatDate(batch.created_at)} ${formatTime(batch.created_at)}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Frame.Description>
              </Frame.Content>
              <Frame.Actions>
                {batch.status === 'reversed' ? (
                  <Pill tone="muted">{t`Rolled back`}</Pill>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    labelClassName="text-destructive"
                    loading={rollback.isPending && rollback.variables === batch.id}
                    onPress={() => confirmRollback(batch)}
                  >
                    {t`Roll back`}
                  </Button>
                )}
              </Frame.Actions>
            </Frame.Row>
          ))}
        </SettingsSection>
      )}
      <Text size="xs" muted className="px-4">
        {t`The sync time range comes from the Flex Query's period configured in IBKR Client Portal — duplicates are skipped either way.`}
      </Text>
    </SettingsForm>
  );
}
