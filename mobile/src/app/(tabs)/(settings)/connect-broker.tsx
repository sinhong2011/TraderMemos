import { useRouter } from 'expo-router';
import { Frame, Text } from 'panelui-native';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { useAccounts } from '@/api/hooks';
import { FormInput, PickerSheet } from '@/components/form-kit';
import { Icon } from '@/components/icon';
import { SettingsForm } from '@/components/settings-form';
import { SettingsSection } from '@/components/settings-rows';
import { t } from '@lingui/core/macro';
import { BROKERS, type BrokerDef } from '@/lib/brokers';

function BrokerMark({ broker }: { broker: BrokerDef }) {
  return (
    <View
      className="size-9 items-center justify-center rounded-lg"
      style={{ backgroundColor: `${broker.brand}26` }}
    >
      <Text size="xs" className="font-bold" style={{ color: broker.brand }}>
        {broker.monogram}
      </Text>
    </View>
  );
}

/**
 * Broker-first connect flow (web /connect parity): pick where you trade,
 * then land on the surface that gets its data in — the flex-sync screen for
 * IBKR (after choosing which account it feeds), the import screen for file
 * brokers, the account form for manual journalling.
 */
export default function ConnectBrokerScreen() {
  const router = useRouter();
  const { data: accounts } = useAccounts();
  const [query, setQuery] = useState('');
  const [accountPickerFor, setAccountPickerFor] = useState<BrokerDef | null>(null);
  const [mutedForeground] = useCSSVariable(['--color-muted-foreground']) as [string];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return BROKERS;
    return BROKERS.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.accountBroker.toLowerCase().includes(q) ||
        b.key.includes(q),
    );
  }, [query]);

  const bySection: { title: string; description: string; kind: BrokerDef['kind'] }[] = [
    { title: t`Auto-sync`, description: t`Connect once — new fills arrive on their own.`, kind: 'sync' },
    { title: t`File import`, description: t`Export a file from the broker; we read the columns for you.`, kind: 'file' },
    { title: t`Manual`, description: t`No export needed.`, kind: 'manual' },
  ];

  function open(broker: BrokerDef) {
    if (broker.kind === 'sync') {
      const list = accounts ?? [];
      if (list.length === 0) {
        // Nothing to attach a sync to yet — make the account first.
        router.push('/account-form');
        return;
      }
      if (list.length === 1) {
        router.push({ pathname: '/flex-sync', params: { accountId: list[0]!.id } });
        return;
      }
      setAccountPickerFor(broker);
      return;
    }
    if (broker.kind === 'file') {
      router.push('/import-trades');
      return;
    }
    router.push('/account-form');
  }

  return (
    <SettingsForm>
      <Text size="sm" muted>
        {t`Pick where you trade. We'll route you to the fastest way to get its data in.`}
      </Text>
      <FormInput
        value={query}
        onChangeText={setQuery}
        placeholder={t`Search brokers and platforms`}
        autoCorrect={false}
        autoCapitalize="none"
        clearButtonMode="while-editing"
      />

      {bySection.map(({ title, description, kind }) => {
        const rows = filtered.filter((b) => b.kind === kind);
        if (rows.length === 0) return null;
        return (
          <SettingsSection key={kind} title={title} footer={description}>
            {rows.map((broker) => (
              <Frame.Row key={broker.key} onPress={() => open(broker)}>
                <BrokerMark broker={broker} />
                <Frame.Content className="flex-1">
                  <Frame.Title>{broker.name}</Frame.Title>
                  {broker.formats ? <Frame.Description>{broker.formats}</Frame.Description> : null}
                </Frame.Content>
                <Icon name="chevron.right" size={12} tintColor={mutedForeground} />
              </Frame.Row>
            ))}
          </SettingsSection>
        );
      })}

      <PickerSheet
        open={accountPickerFor != null}
        onOpenChange={(next) => {
          if (!next) setAccountPickerFor(null);
        }}
        title={t`Which account does it feed?`}
        items={(accounts ?? []).map((account) => ({ value: account.id, label: account.name }))}
        selectedValue={null}
        onValueChange={(accountId) => {
          setAccountPickerFor(null);
          router.push({ pathname: '/flex-sync', params: { accountId } });
        }}
      />
    </SettingsForm>
  );
}
