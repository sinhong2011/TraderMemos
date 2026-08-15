import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Spinner, Switch } from 'panelui-native';
import { Alert, Pressable, ScrollView, Share, Text, View } from 'react-native';

import { useAccounts, useApiRequest, useSystemInfo } from '@/api/hooks';
import type { CreateShareLinkBody, ShareLink } from '@/api/types';
import { GlassButton } from '@/components/glass-button';
import { Segmented } from '@/components/segmented';
import { t } from '@lingui/core/macro';
import { useSelectedAccountId } from '@/lib/account-store';
import { errorMessage } from '@/lib/errors';
import { useGlobalFilters } from '@/lib/filters';
import { useMoneyFx } from '@/lib/money';
import { accountBaseCurrency } from '@/lib/prefs';
import { useWebBaseUrl } from '@/lib/share-prefs';

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
  const router = useRouter();
  const apiRequest = useApiRequest();
  const selectedAccountId = useSelectedAccountId();
  const { tz } = useGlobalFilters();
  const accounts = useAccounts();
  const fx = useMoneyFx(accountBaseCurrency(accounts.data, selectedAccountId));

  const [showAmounts, setShowAmounts] = useState(false);
  const [expiry, setExpiry] = useState<ExpiryChoice>(90);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<ShareLink | null>(null);

  // The device override (Settings → Integrations) wins over the server's
  // advertised web_url (TM_PUBLIC_WEB_URL). Deliberately no fall back to the
  // API origin: it serves the visitor page only in the bundled nginx
  // deployment, so guessing it hands out a dead link everywhere else — and a
  // share link that 404s is worse than being told to set the address.
  // Both hooks run unconditionally — `??` between two calls would skip the
  // second whenever the override is set.
  const overrideBase = useWebBaseUrl();
  const advertisedBase = useSystemInfo().data?.web_url;
  const webBase = overrideBase ?? advertisedBase ?? null;
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
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="gap-4 p-4 pb-12 pt-6"
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-[20px] font-bold text-foreground">{t`Share link`}</Text>
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          className="p-1 active:opacity-60"
        >
          <Text className="text-[15px] font-semibold text-foreground">{t`Done`}</Text>
        </Pressable>
      </View>

      <Text className={EXPLAINER}>
        {t`Anyone with the link sees a read-only summary of the current scope — no trades, notes or account details.`}
      </Text>

      <View className="flex-row items-center gap-3">
        <View className="flex-1 gap-[2px]">
          <Text className={OPTION_LABEL}>{t`Show amounts`}</Text>
          <Text className="text-xs text-muted-foreground">
            {t`Off shares only win rate and ratios — account size stays private.`}
          </Text>
        </View>
        <Switch value={showAmounts} onValueChange={setShowAmounts} label={t`Show amounts`} />
      </View>

      {/* Four equal-width, mutually exclusive choices — the segmented control
          this row of stretched chips was always drawing by hand. */}
      <View className="gap-2">
        <Text className={OPTION_LABEL}>{t`Expires`}</Text>
        <Segmented
          fill
          options={EXPIRY_CHOICES.map((days) => ({
            value: String(days),
            label: expiryLabel(days),
          }))}
          value={String(expiry)}
          onChange={(next) => setExpiry(Number(next) as ExpiryChoice)}
        />
      </View>

      {url ? (
        <>
          <View className="rounded-lg bg-muted p-3" style={{ borderCurve: 'continuous' }}>
            <Text selectable className="text-[13px] text-foreground tabular-nums">
              {url}
            </Text>
          </View>
          <View className={ACTIONS}>
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
      ) : webBase == null ? (
        // Gated before creating, not after: a link minted with nowhere to point
        // is a live public token the sharer can't even see.
        <>
          <Text className={EXPLAINER}>
            {t`Set the web app address first — links open there, and this server doesn't advertise one.`}
          </Text>
          <View className={ACTIONS}>
            <GlassButton
              prominent
              label={t`Open settings`}
              systemImage="gearshape"
              onPress={() => {
                router.back();
                router.push('/web-address');
              }}
            />
          </View>
        </>
      ) : (
        <View className={ACTIONS}>
          {creating ? (
            <Spinner />
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

const EXPLAINER = 'text-[13px] leading-[18px] text-muted-foreground';
const OPTION_LABEL = 'text-[15px] font-medium text-foreground';
const ACTIONS = 'flex-row justify-center gap-2';
