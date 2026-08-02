import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { useTrade } from '@/api/hooks';
import { useSession } from '@/api/session';
import { DashboardCard } from '@/components/dashboard-card';
import { Pill } from '@/components/pill';
import { Skeleton } from '@/components/skeleton';
import { TradeChart } from '@/components/trade-chart';
import { t } from '@lingui/core/macro';
import {
  formatCurrency,
  formatDate,
  formatDuration,
  formatPnl,
  formatTime,
} from '@/lib/format';
import { gradeFromInt, parseJournalNotes } from '@/lib/journal';
import { marketLabel, tradeNotional, tradeRMultiple, tradeStatus } from '@/lib/trades';
import { pnlColor } from '@/styles/unistyles';

function Row({ label, value, tint }: { label: string; value: string; tint?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text selectable style={[styles.rowValue, tint ? { color: tint } : null]}>
        {value}
      </Text>
    </View>
  );
}

/** Labeled freeform paragraph (entry/exit reasons, review notes). */
function TextBlock({ label, value }: { label: string; value: string }) {
  if (!value.trim()) return null;
  return (
    <View style={styles.block}>
      <Text style={styles.blockLabel}>{label}</Text>
      <Text selectable style={styles.notes}>
        {value}
      </Text>
    </View>
  );
}

function statusLabel(label: ReturnType<typeof tradeStatus>['label']): string {
  switch (label) {
    case 'WIN':
      return t`WIN`;
    case 'LOSS':
      return t`LOSS`;
    case 'OPEN':
      return t`OPEN`;
    case 'BE':
      return t`BE`;
  }
}

export default function TradeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useUnistyles();
  const { session } = useSession();
  const router = useRouter();
  const { data: trade, isLoading, error, refetch, isRefetching } = useTrade(id);

  if (isLoading) {
    // Hero figure, chart, and stat-row shaped skeletons.
    return (
      <View style={[styles.page, styles.skeletonPage]}>
        <Skeleton style={styles.skeletonHero} />
        <Skeleton style={styles.skeletonChart} />
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} style={styles.skeletonLine} />
        ))}
      </View>
    );
  }

  if (error || !trade) {
    return (
      <View style={styles.centered}>
        <Text selectable style={styles.muted}>
          {error?.message ?? t`Trade not found`}
        </Text>
      </View>
    );
  }

  const status = tradeStatus(trade);
  const isLong = trade.direction === 'long';
  const isOpen = trade.status === 'open';
  const currency = trade.pnl_currency;
  const tint = pnlColor(theme.colors, trade.net_pnl);
  const r = trade.r_multiple ?? tradeRMultiple(trade);
  const captionParts = [
    ...(trade.return_pct != null
      ? [`${trade.return_pct >= 0 ? '+' : ''}${trade.return_pct.toFixed(2)}%`]
      : []),
    ...(r != null ? [`${r.toFixed(2)}R`] : []),
  ];

  const journal = parseJournalNotes(trade.notes);
  const setupGrade = gradeFromInt(trade.confidence);
  const execGrade = gradeFromInt(trade.trade_quality);
  const hasDividends = trade.dividend_total !== 0;
  const hasPlan =
    trade.target_price != null ||
    trade.stop_price != null ||
    trade.initial_risk != null ||
    r != null ||
    trade.mae != null ||
    trade.mfe != null;
  const hasJournal = Boolean(
    trade.setup ||
      journal.session ||
      trade.emotional_state ||
      setupGrade ||
      execGrade ||
      journal.entryReason ||
      journal.exitReason ||
      journal.reviewNotes,
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: trade.symbol,
          headerRight: () => (
            <Pressable
              onPress={() => router.push({ pathname: '/edit-trade', params: { id: trade.id } })}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t`Edit trade`}
              style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}
            >
              <SymbolView name="pencil" size={15} tintColor={theme.colors.foreground} />
            </Pressable>
          ),
        }}
      />
      <ScrollView
        style={styles.page}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />
        }
      >
        <View style={styles.hero}>
          <View style={styles.pillRow}>
            <Pill tone="muted">
              <Text style={{ color: isLong ? theme.colors.profit : theme.colors.loss }}>
                {isLong ? '↗ ' : '↘ '}
              </Text>
              {isLong ? t`LONG` : t`SHORT`}
            </Pill>
            <Pill tone={status.tone}>{statusLabel(status.label)}</Pill>
            <Pill tone="muted">{marketLabel(trade.instrument_type)}</Pill>
          </View>
          <Text selectable style={[styles.heroValue, isOpen ? styles.heroOpen : { color: tint }]}>
            {isOpen ? t`Open` : formatPnl(trade.net_pnl, currency)}
          </Text>
          {captionParts.length > 0 ? (
            <Text
              style={[
                styles.heroCaption,
                { color: isOpen ? theme.colors.mutedForeground : tint },
              ]}
            >
              {captionParts.join(' · ')}
            </Text>
          ) : null}
        </View>

        <DashboardCard title={t`P&L`}>
          <Row
            label={t`Gross P&L`}
            value={formatPnl(trade.gross_pnl, currency)}
            tint={pnlColor(theme.colors, trade.gross_pnl)}
          />
          <Row label={t`Fees`} value={formatCurrency(trade.fees_total, currency)} />
          {hasDividends ? (
            <Row
              label={t`Dividends`}
              value={formatPnl(trade.dividend_total, currency)}
              tint={pnlColor(theme.colors, trade.dividend_total)}
            />
          ) : null}
          <Row label={t`Net P&L`} value={formatPnl(trade.net_pnl, currency)} tint={tint} />
          {hasDividends && trade.total_pnl != null ? (
            <Row
              label={t`Total P&L`}
              value={formatPnl(trade.total_pnl, currency)}
              tint={pnlColor(theme.colors, trade.total_pnl)}
            />
          ) : null}
        </DashboardCard>

        {hasPlan ? (
          <DashboardCard title={t`Plan & risk`}>
            {trade.target_price != null ? (
              <Row label={t`Target`} value={formatCurrency(trade.target_price, currency)} />
            ) : null}
            {trade.stop_price != null ? (
              <Row label={t`Stop`} value={formatCurrency(trade.stop_price, currency)} />
            ) : null}
            {trade.initial_risk != null ? (
              <Row label={t`Initial risk`} value={formatCurrency(trade.initial_risk, currency)} />
            ) : null}
            {r != null ? (
              <Row label={t`R multiple`} value={`${r.toFixed(2)}R`} tint={tint} />
            ) : null}
            {trade.mae != null ? (
              <Row
                label={t`MAE`}
                value={formatCurrency(trade.mae, currency)}
                tint={theme.colors.loss}
              />
            ) : null}
            {trade.mfe != null ? (
              <Row
                label={t`MFE`}
                value={formatCurrency(trade.mfe, currency)}
                tint={theme.colors.profit}
              />
            ) : null}
          </DashboardCard>
        ) : null}

        <TradeChart trade={trade} />

        <DashboardCard title={t`Timing`}>
          <Row
            label={t`Opened`}
            value={`${formatDate(trade.opened_at)} ${formatTime(trade.opened_at)}`}
          />
          <Row
            label={t`Closed`}
            value={
              trade.closed_at
                ? `${formatDate(trade.closed_at)} ${formatTime(trade.closed_at)}`
                : t`Open`
            }
          />
          <Row label={t`Time in trade`} value={formatDuration(trade.time_in_trade_secs)} />
        </DashboardCard>

        <DashboardCard title={t`Position`}>
          <Row label={t`Quantity`} value={String(trade.qty_opened)} />
          {trade.qty_remaining > 0 ? (
            <Row label={t`Remaining`} value={String(trade.qty_remaining)} />
          ) : null}
          <Row label={t`Avg entry`} value={formatCurrency(trade.avg_entry_price, currency)} />
          <Row label={t`Avg exit`} value={formatCurrency(trade.avg_exit_price, currency)} />
          <Row label={t`Notional`} value={formatCurrency(tradeNotional(trade), currency)} />
        </DashboardCard>

        {hasJournal ? (
          <DashboardCard title={t`Journal`}>
            {trade.setup ? (
              <View style={styles.block}>
                <Text style={styles.blockLabel}>{t`Setup`}</Text>
                <View style={styles.tags}>
                  <Pill tone="accent">{trade.setup.name}</Pill>
                  {trade.setup_ids.length > 1 ? (
                    <Pill tone="muted">+{trade.setup_ids.length - 1}</Pill>
                  ) : null}
                </View>
              </View>
            ) : null}
            {journal.session ? <Row label={t`Session`} value={journal.session} /> : null}
            {trade.emotional_state ? (
              <Row label={t`Emotion`} value={trade.emotional_state} />
            ) : null}
            {setupGrade ? <Row label={t`Setup rating`} value={setupGrade} /> : null}
            {execGrade ? <Row label={t`Execution rating`} value={execGrade} /> : null}
            <TextBlock label={t`Entry reason`} value={journal.entryReason} />
            <TextBlock label={t`Exit reason`} value={journal.exitReason} />
            <TextBlock label={t`Review notes`} value={journal.reviewNotes} />
          </DashboardCard>
        ) : null}

        {trade.tags.length > 0 ? (
          <DashboardCard title={t`Tags`}>
            <View style={styles.tags}>
              {trade.tags.map((tag) => (
                <Pill key={tag.id} tone={tag.kind === 'mistake' ? 'neg' : 'muted'}>
                  {tag.name}
                </Pill>
              ))}
            </View>
          </DashboardCard>
        ) : null}

        {journal.legacy ? (
          <DashboardCard title={t`Notes`}>
            <Text selectable style={styles.notes}>
              {journal.legacy}
            </Text>
          </DashboardCard>
        ) : null}

        {trade.fills.length > 0 ? (
          <DashboardCard title={t`Executions`}>
            {trade.fills.map((fill) => {
              const isBuy = fill.side === 'buy';
              const fees = fill.fees + fill.commission;
              return (
                <View key={fill.id} style={styles.fillRow}>
                  <View style={styles.fillLeft}>
                    <Text selectable style={styles.fillMain} numberOfLines={1}>
                      <Text
                        style={{
                          color: isBuy ? theme.colors.profit : theme.colors.loss,
                          fontWeight: '700',
                        }}
                      >
                        {isBuy ? t`BUY` : t`SELL`}
                      </Text>
                      {`  ${fill.quantity} · ${formatCurrency(fill.price, currency)}`}
                    </Text>
                    <Text style={styles.fillSub}>
                      {formatDate(fill.executed_at)} {formatTime(fill.executed_at)}
                    </Text>
                  </View>
                  {fees > 0 ? (
                    <Text style={styles.fillFees}>-{formatCurrency(fees, currency)}</Text>
                  ) : null}
                </View>
              );
            })}
          </DashboardCard>
        ) : null}

        {trade.attachments.length > 0 && session ? (
          <DashboardCard title={t`Screenshots`}>
            <View style={styles.shots}>
              {trade.attachments.map((att) => (
                <Image
                  key={att.id}
                  source={{
                    uri: new URL(`/api/v1/attachments/${att.id}/file`, session.serverUrl).toString(),
                    headers: { Authorization: `Bearer ${session.accessToken}` },
                  }}
                  style={styles.shot}
                  contentFit="cover"
                  transition={150}
                  accessibilityLabel={att.filename}
                />
              ))}
            </View>
          </DashboardCard>
        ) : null}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create((theme) => ({
  page: { backgroundColor: theme.colors.background },
  content: {
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
    paddingBottom: theme.spacing.xl * 2,
  },
  skeletonPage: { flex: 1, padding: theme.spacing.lg, gap: theme.spacing.lg },
  skeletonHero: { width: 180, height: 34 },
  skeletonChart: { height: 220, borderRadius: theme.radius.lg + 4 },
  skeletonLine: { height: 48, borderRadius: theme.radius.lg },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  muted: { color: theme.colors.mutedForeground, textAlign: 'center' },
  editButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.muted,
  },
  pressed: { opacity: 0.6 },
  hero: { gap: theme.spacing.sm },
  pillRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm },
  heroValue: { fontSize: 36, fontWeight: '700', letterSpacing: -1, ...theme.numeric },
  heroOpen: { color: theme.colors.mutedForeground },
  heroCaption: { fontSize: 14, fontWeight: '500', ...theme.numeric },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  rowLabel: { fontSize: 15, color: theme.colors.mutedForeground },
  rowValue: { fontSize: 15, fontWeight: '500', color: theme.colors.foreground, ...theme.numeric },
  block: { gap: theme.spacing.xs },
  blockLabel: { fontSize: 12, color: theme.colors.mutedForeground },
  notes: { fontSize: 15, lineHeight: 22, color: theme.colors.foreground },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  fillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  fillLeft: { gap: 1, flexShrink: 1 },
  fillMain: { fontSize: 15, color: theme.colors.foreground, ...theme.numeric },
  fillSub: { fontSize: 12, color: theme.colors.mutedForeground, ...theme.numeric },
  fillFees: { fontSize: 13, color: theme.colors.mutedForeground, ...theme.numeric },
  shots: { gap: theme.spacing.sm },
  shot: {
    width: '100%',
    height: 200,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.muted,
  },
}));
