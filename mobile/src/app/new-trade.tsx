import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { FormSkeleton } from '@/components/skeleton';

import { useSession } from '@/api/session';
import { useAccounts, useApiRaw, useLlmSettings, useSetups, useTags } from '@/api/hooks';
import { TradeForm } from '@/components/trade-form';
import { t } from '@lingui/core/macro';
import { errorMessage } from '@/lib/errors';
import {
  clearDroppedSources,
  extractFromSources,
  isVisionReady,
  listDroppedSources,
} from '@/lib/trade-import';
import { blocksFromExtract } from '@/lib/trade-prefill';
import { stashTradeDraft } from '@/lib/trade-draft';
import { emptyTradeForm, validateTradeForm, type TradeFormValues } from '@/lib/trade-form';

/**
 * Drains the drop folder when the form is opened with `?import=1` — the
 * hand-off an iOS Shortcut or a share-sheet "Open in TraderMemos" leaves
 * behind (see lib/trade-import). Runs once per mount, and the form waits for
 * the result rather than prefilling afterwards, because TradeForm seeds its
 * block state from `initialBlocks` on mount.
 */
function useDroppedPrefill(
  accountId: string | undefined,
  api: ReturnType<typeof useApiRaw>,
): { importing: boolean; blocks: TradeFormValues[] | null } {
  const { import: requested } = useLocalSearchParams<{ import?: string }>();
  const { session, isLoading: sessionLoading } = useSession();
  const ocrSettings = useLlmSettings('ocr');
  const wanted = requested === '1';
  const [done, setDone] = useState(false);
  const [blocks, setBlocks] = useState<TradeFormValues[] | null>(null);
  const started = useRef(false);
  // Screenshots need the vision endpoint, so the settings query has to have
  // landed before the folder is read — otherwise a cold open scans blind.
  const ocrSettled = !ocrSettings.isPending;
  // Deep-linked while signed out: the drop stays in the folder for the next
  // run rather than being spent against a session that can't upload it.
  const signedOut = !sessionLoading && !session;

  useEffect(() => {
    if (!wanted || started.current || sessionLoading || signedOut) return;
    if (!accountId || !ocrSettled) return;
    started.current = true;
    void (async () => {
      try {
        const sources = listDroppedSources();
        if (sources.length === 0) return;
        // Leave the files in place when the scan can't run — the user can set
        // the endpoint up and re-run the shortcut against the same drop.
        if (sources.some((s) => s.type.startsWith('image/')) && !isVisionReady(ocrSettings.data)) {
          Alert.alert(
            t`Set up Vision scan first`,
            t`Add an OpenAI-compatible vision endpoint and API key under Settings → AI, then open this shortcut again.`,
          );
          return;
        }
        const extract = await extractFromSources(sources, api);
        clearDroppedSources(sources);
        const prefilled = blocksFromExtract(extract, accountId);
        setBlocks(prefilled.blocks);
        if (prefilled.warnings.length > 0) {
          Alert.alert(t`Check the fills`, prefilled.warnings.join('\n\n'));
        }
      } catch (err) {
        Alert.alert(t`Could not import`, errorMessage(err));
      } finally {
        setDone(true);
      }
    })();
  }, [wanted, signedOut, sessionLoading, accountId, ocrSettled, ocrSettings.data, api]);

  return { importing: wanted && !done && !signedOut, blocks };
}

/**
 * Manual trade entry, mirroring the web NewTradeDrawer submit path for every
 * symbol block: one POST /executions per fill (the server groups executions
 * into one trade per symbol), then the journal PATCH and optional dividend
 * against each resulting trade.
 */
export default function NewTradeScreen() {
  const router = useRouter();
  const apiRaw = useApiRaw();
  const { data: accounts } = useAccounts();
  const { data: setups } = useSetups();
  const { data: tags } = useTags();
  const prefill = useDroppedPrefill(accounts?.[0]?.id, apiRaw);

  /**
   * "Preview" on the form: validate, stash the draft, and push the
   * /trade-preview page — Save (and the actual mutation) lives there.
   */
  function handlePreview(blocks: TradeFormValues[]) {
    // Nothing is written here — Save lives on the preview page — so the alerts
    // name the missing field, and the tab chip ("Symbol 2") rather than an
    // internal "block", so the user knows which page to swipe back to.
    for (const [index, values] of blocks.entries()) {
      const label = values.symbol.trim().toUpperCase() || t`Symbol ${index + 1}`;
      switch (validateTradeForm(values)) {
        case 'account':
          return Alert.alert(
            t`Trade not ready`,
            t`No account found — create one on the web app first.`,
          );
        case 'symbol':
          return Alert.alert(t`Trade not ready`, t`Enter a symbol for ${label}.`);
        case 'fills':
          return Alert.alert(
            t`Trade not ready`,
            t`Add at least one fill with quantity and price for ${label}.`,
          );
      }
    }
    if (blocks.length === 0) return;
    const account = accounts?.find((a) => a.id === blocks[0].accountId);
    stashTradeDraft({
      blocks,
      accountId: blocks[0].accountId,
      accountName: account?.name ?? '',
      currency: account?.base_currency ?? 'USD',
      setups: setups ?? [],
      tags: tags ?? [],
    });
    router.push('/trade-preview');
  }

  if (!accounts || !setups || !tags || prefill.importing) {
    return (
      <View style={styles.loading}>
        <FormSkeleton />
      </View>
    );
  }
  if (accounts.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>{t`No account found — create one on the web app first.`}</Text>
      </View>
    );
  }

  return (
    <TradeForm
      title={t`New trade`}
      initialBlocks={prefill.blocks ?? [emptyTradeForm(accounts[0].id)]}
      accounts={accounts}
      setups={setups}
      tags={tags}
      saving={false}
      pushed
      onSave={handlePreview}
    />
  );
}

const styles = StyleSheet.create((theme) => ({
  loading: { flex: 1, backgroundColor: theme.colors.background },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.background,
  },
  muted: { color: theme.colors.mutedForeground, textAlign: 'center' },
}));
