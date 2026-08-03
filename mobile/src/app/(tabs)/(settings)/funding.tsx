import {
  Button,
  Host,
  HStack,
  Section,
  Spacer,
  Text as UIText,
  VStack,
} from '@expo/ui/swift-ui';
import { font, foregroundStyle } from '@expo/ui/swift-ui/modifiers';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { useUnistyles } from 'react-native-unistyles';

import { useAccounts, useCash } from '@/api/hooks';
import { t } from '@lingui/core/macro';
import { SettingsForm } from '@/components/settings-form';
import { cashTypeLabel } from '@/lib/cash';
import { formatCurrency, formatDate } from '@/lib/format';

/**
 * Deposits & withdrawals (web "Deposits & withdrawals" section): the cash
 * ledger across all accounts, newest first. Rows push the edit form; the
 * header button pushes a blank one.
 */
export default function FundingScreen() {
  const router = useRouter();
  const { theme } = useUnistyles();
  const { data: accounts } = useAccounts();
  const cash = useCash();

  const transactions = useMemo(
    () =>
      [...(cash.data ?? [])].sort(
        (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
      ),
    [cash.data],
  );

  return (
    <Host style={{ flex: 1 }}>
      <SettingsForm>
        <Section>
          <Button
            systemImage="plus.circle.fill"
            label={t`Add transaction`}
            onPress={() => router.push('/cash-form')}
          />
        </Section>

        <Section
          title={t`History`}
          footer={
            <UIText>{t`Deposits, withdrawals, and fees drive the equity curve alongside trade P&L.`}</UIText>
          }
        >
          {transactions.map((tx) => {
            const account = accounts?.find((candidate) => candidate.id === tx.account_id);
            const isOutflow = tx.amount < 0 || tx.type === 'withdrawal' || tx.type === 'fee';
            const signed = isOutflow ? -Math.abs(tx.amount) : tx.amount;
            return (
              <Button
                key={tx.id}
                onPress={() => router.push({ pathname: '/cash-form', params: { id: tx.id } })}
              >
                <HStack>
                  <VStack alignment="leading" spacing={2}>
                    <UIText modifiers={[foregroundStyle({ type: 'hierarchical', style: 'primary' })]}>
                      {account ? `${cashTypeLabel(tx.type)} · ${account.name}` : cashTypeLabel(tx.type)}
                    </UIText>
                    <UIText
                      modifiers={[
                        font({ size: 13 }),
                        foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
                      ]}
                    >
                      {tx.note ? `${formatDate(tx.occurred_at)} · ${tx.note}` : formatDate(tx.occurred_at)}
                    </UIText>
                  </VStack>
                  <Spacer />
                  <UIText
                    modifiers={[
                      foregroundStyle(isOutflow ? theme.colors.loss : theme.colors.profit),
                    ]}
                  >
                    {formatCurrency(signed, tx.currency || 'USD')}
                  </UIText>
                </HStack>
              </Button>
            );
          })}
          {transactions.length === 0 ? (
            <UIText modifiers={[foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
              {cash.isLoading ? t`Loading…` : t`No transactions yet`}
            </UIText>
          ) : null}
        </Section>
      </SettingsForm>
    </Host>
  );
}
