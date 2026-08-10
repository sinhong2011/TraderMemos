import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, Switch, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { useAccounts, useApiRequest, useSystemInfo } from '@/api/hooks';
import { useSession } from '@/api/session';
import type { CreateShareLinkBody, ShareLink } from '@/api/types';
import { GlassButton } from '@/components/glass-button';
import { t } from '@lingui/core/macro';
import { useSelectedAccountId } from '@/lib/account-store';
import { errorMessage } from '@/lib/errors';
import { useGlobalFilters } from '@/lib/filters';
import { useMoneyFx } from '@/lib/money';
import { accountBaseCurrency } from '@/lib/prefs';

/** Mirrors web ShareLinkDialog's choices; `0` is the API's "never expires". */
const EXPIRY_CHOICES = [30, 90, 365, 0] as const;
type ExpiryChoice = (typeof EXPIRY_CHOICES)[number];

function expiryLabel(days: ExpiryChoice): string {
  switch (days) {
    case 30:
      return t`30 days`;
    case 90:
      return t`90 days`;
    case 365:
      return t`1 year`;
    default:
      return t`Never`;
  }
}

/**
 * Create a public read-only link to the current reports scope (#204) — the
 * mobile twin of web's ShareLinkDialog. Options first, then the URL; the
 * privacy default matches the share cards: amounts stay off until opted in.
 */
export default function ShareReportsLinkScreen() {
  const { theme } = useUnistyles();
  const router = useRouter();
  const { session } = useSession();
  const apiRequest = useApiRequest();
  const selectedAccountId = useSelectedAccountId();
  const { tz } = useGlobalFilters();
  const accounts = useAccounts();
  const fx = useMoneyFx(accountBaseCurrency(accounts.data, selectedAccountId));

  const [showAmounts, setShowAmounts] = useState(false);
  const [expiry, setExpiry] = useState<ExpiryChoice>(90);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<ShareLink | null>(null);

  // Split deployments serve the web app from its own origin; the server
  // advertises it as web_url (TM_PUBLIC_WEB_URL). Without it, the nginx
  // deployment's same-origin assumption holds and the signed-in server URL
  // also hosts the visitor page.
  const webBase = useSystemInfo().data?.web_url || session?.serverUrl;
  const url = created && webBase ? new URL(`/s/${created.token}`, webBase).toString() : null;

  async function create() {
    setCreating(true);
    try {
      const body: CreateShareLinkBody = {
        ...(selectedAccountId ? { account_id: selectedAccountId } : {}),
        ...(tz ? { tz } : {}),
        ...(showAmounts ? { currency: fx.currency } : {}),
        show_amounts: showAmounts,
        expires_in_days: expiry,
      };
      setCreated(await apiRequest<ShareLink>('/share-links', { method: 'POST', body }));
    } catch (err) {
      Alert.alert(t`Could not create link`, errorMessage(err));
    } finally {
      setCreating(false);
    }
  }

  async function shareUrl() {
    if (!url) return;
    // iOS reads `url`, Android reads `message` — pass both.
    await Share.share({ url, message: url });
  }

  async function copyUrl() {
    if (!url) return;
    await Clipboard.setStringAsync(url);
  }

  return (
    // Form sheets lay non-scroll children on top of each other — the sheet's
    // content root must be a ScrollView.
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>{t`Share link`}</Text>
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          style={({ pressed }) => [styles.doneButton, pressed && styles.pressed]}
        >
          <Text style={styles.doneLabel}>{t`Done`}</Text>
        </Pressable>
      </View>

      <Text style={styles.explainer}>
        {t`Anyone with the link sees a read-only summary of the current scope — no trades, notes or account details.`}
      </Text>

      <View style={styles.optionRow}>
        <View style={styles.optionText}>
          <Text style={styles.optionLabel}>{t`Show amounts`}</Text>
          <Text style={styles.optionHint}>
            {t`Off shares only win rate and ratios — account size stays private.`}
          </Text>
        </View>
        <Switch
          value={showAmounts}
          onValueChange={setShowAmounts}
          trackColor={{ true: theme.colors.primary }}
        />
      </View>

      <View style={styles.optionRow}>
        <View style={styles.optionText}>
          <Text style={styles.optionLabel}>{t`Expires`}</Text>
        </View>
      </View>
      <View style={styles.expiryPicker}>
        {EXPIRY_CHOICES.map((days) => {
          const selected = days === expiry;
          return (
            <Pressable
              key={days}
              onPress={() => setExpiry(days)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={({ pressed }) => [
                styles.expiryChip,
                selected && styles.expiryChipSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.expiryLabel, selected && styles.expiryLabelSelected]}>
                {expiryLabel(days)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {url ? (
        <>
          <View style={styles.urlBox}>
            <Text selectable style={styles.url}>
              {url}
            </Text>
          </View>
          <View style={styles.actions}>
            <GlassButton
              prominent
              label={t`Share`}
              systemImage="square.and.arrow.up"
              onPress={() => void shareUrl()}
            />
            <GlassButton
              label={t`Copy`}
              systemImage="doc.on.doc"
              onPress={() => void copyUrl()}
            />
          </View>
        </>
      ) : (
        <View style={styles.actions}>
          {creating ? (
            <ActivityIndicator />
          ) : (
            <GlassButton
              prominent
              label={t`Create link`}
              systemImage="link"
              onPress={() => void create()}
            />
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create((theme) => ({
  page: { flex: 1, backgroundColor: theme.colors.background },
  content: {
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    gap: theme.spacing.lg,
    paddingBottom: theme.spacing.xl * 2,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 20, fontWeight: '700', color: theme.colors.foreground },
  doneButton: { paddingVertical: 4, paddingHorizontal: 4 },
  pressed: { opacity: 0.6 },
  doneLabel: { fontSize: 15, fontWeight: '600', color: theme.colors.foreground },
  explainer: { fontSize: 13, color: theme.colors.mutedForeground, lineHeight: 18 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
  optionText: { flex: 1, gap: 2 },
  optionLabel: { fontSize: 15, fontWeight: '500', color: theme.colors.foreground },
  optionHint: { fontSize: 12, color: theme.colors.mutedForeground },
  expiryPicker: { flexDirection: 'row', gap: theme.spacing.sm },
  expiryChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.muted,
  },
  expiryChipSelected: { backgroundColor: theme.colors.primary },
  expiryLabel: { fontSize: 13, fontWeight: '600', color: theme.colors.foreground },
  expiryLabelSelected: { color: theme.colors.primaryForeground },
  urlBox: {
    padding: theme.spacing.md,
    borderRadius: theme.radius.lg,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.muted,
  },
  url: { fontSize: 13, color: theme.colors.foreground, ...theme.numeric },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
}));
