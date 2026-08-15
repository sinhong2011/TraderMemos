import {
  Button as UIButton,
  Image as UIImage,
  Menu,
} from '@expo/ui/swift-ui';
import { accessibilityLabel, buttonStyle, tint as tintModifier } from '@expo/ui/swift-ui/modifiers';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { useState, type ReactNode } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Icon } from '@/components/icon';
import { ApiError } from '@/api/client';
import { queryKeys, useApiRequest, useCachedTradeRow, useTrade } from '@/api/hooks';
import type { ExcursionResult, Trade, TradeDetail } from '@/api/types';
import { AttachmentsCard } from '@/components/attachments-card';
import { CoachCard } from '@/components/coach-card';
import { DashboardCard } from '@/components/dashboard-card';
import { ErrorState } from '@/components/error-state';
import { GlassButton } from '@/components/glass-button';
import { Pill } from '@/components/pill';
import { Skeleton } from '@/components/skeleton';
import { TradeChart } from '@/components/trade-chart';
import { t } from '@lingui/core/macro';
import { errorMessage, isUnreachable } from '@/lib/errors';
import { armRollingNumbers } from '@/lib/rolling-numbers';
import { formatDuration, useFormatters } from '@/lib/format';
import { gradeFromInt, parseEmotionalStates, parseJournalNotes } from '@/lib/journal';
import { marketLabel, tradeNotional, tradeRMultiple, tradeStatus } from '@/lib/trades';
import { pnlColor } from '@/styles/unistyles';
import { AppHost } from '@/components/app-host';

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

/**
 * Labeled wrap of pills. Journal taxonomy is a set, not a value — read as a
 * right-aligned `Row` the emotions truncated to "Calm, Confid…" on one line.
 */
function PillBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.block}>
      <Text style={styles.blockLabel}>{label}</Text>
      <View style={styles.tags}>{children}</View>
    </View>
  );
}

/** Grade tile — the two ratings are the card's scannable verdict, not a row pair. */
function GradeTile({ label, grade }: { label: string; grade: string }) {
  return (
    <View style={styles.gradeTile}>
      <Text style={styles.blockLabel}>{label}</Text>
      <Text style={styles.gradeValue}>{grade}</Text>
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

/**
 * The trade as the list row already knows it, widened with the detail-only
 * fields when they have arrived — so the hero and the three factual cards can
 * render from either source without a second copy of their markup.
 */
type TradeLike = Trade & Partial<Pick<TradeDetail, 'r_multiple' | 'dividend_total' | 'total_pnl'>>;

/**
 * Symbol chip → the symbol journal: this symbol's chart with every one of your
 * trades on it. Lives on the hero because "where else did I trade this?" is
 * asked while looking at a trade, not while browsing a tools menu.
 */
function SymbolChip({ symbol, market }: { symbol: string; market: string }) {
  const { theme } = useUnistyles();
  const router = useRouter();
  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: '/(tabs)/(trades)/symbol-journal',
          params: { symbol, market },
        })
      }
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={t`Symbol journal for ${symbol}`}
      style={({ pressed }) => [styles.symbolChip, pressed && styles.pressed]}
    >
      <Icon name="chart.xyaxis.line" size={11} tintColor={theme.colors.mutedForeground} />
      <Text style={styles.symbolChipText} numberOfLines={1}>
        {symbol}
      </Text>
    </Pressable>
  );
}

/** Direction/status/market, the P&L figure, and its return·R caption. */
function TradeHero({ trade }: { trade: TradeLike }) {
  const { theme } = useUnistyles();
  const { formatPnl } = useFormatters();
  const status = tradeStatus(trade);
  const isLong = trade.direction === 'long';
  const isOpen = trade.status === 'open';
  const tint = pnlColor(theme.colors, trade.net_pnl);
  const r = trade.r_multiple ?? tradeRMultiple(trade);
  const captionParts = [
    ...(trade.return_pct != null
      ? [`${trade.return_pct >= 0 ? '+' : ''}${trade.return_pct.toFixed(2)}%`]
      : []),
    ...(r != null ? [`${r.toFixed(2)}R`] : []),
  ];

  return (
    <View style={styles.hero}>
      <View style={styles.pillRow}>
        <SymbolChip symbol={trade.symbol} market={trade.instrument_type} />
        {/* Position named the way traders do — LONG CALL, SHORT PUT (same
            convention as the trade-row chips). */}
        <Pill tone="muted">
          <Text style={{ color: isLong ? theme.colors.profit : theme.colors.loss }}>
            {isLong ? '↗ ' : '↘ '}
          </Text>
          {[
            isLong ? t`LONG` : t`SHORT`,
            ...(trade.option_right === 'call'
              ? [t`CALL`]
              : trade.option_right === 'put'
                ? [t`PUT`]
                : []),
          ].join(' ')}
        </Pill>
        <Pill tone={status.tone}>{statusLabel(status.label)}</Pill>
        <Pill tone="muted">{marketLabel(trade.instrument_type)}</Pill>
      </View>
      <Text selectable style={[styles.heroValue, isOpen ? styles.heroOpen : { color: tint }]}>
        {isOpen ? t`Open` : formatPnl(trade.net_pnl, trade.pnl_currency)}
      </Text>
      {captionParts.length > 0 ? (
        <Text
          style={[styles.heroCaption, { color: isOpen ? theme.colors.mutedForeground : tint }]}
        >
          {captionParts.join(' · ')}
        </Text>
      ) : null}
    </View>
  );
}

function PnlCard({ trade }: { trade: TradeLike }) {
  const { theme } = useUnistyles();
  const { formatCurrency, formatPnl } = useFormatters();
  const currency = trade.pnl_currency;
  const tint = pnlColor(theme.colors, trade.net_pnl);
  const dividends = trade.dividend_total ?? 0;

  return (
    <DashboardCard title={t`P&L`}>
      <Row
        label={t`Gross P&L`}
        value={formatPnl(trade.gross_pnl, currency)}
        tint={pnlColor(theme.colors, trade.gross_pnl)}
      />
      <Row label={t`Fees`} value={formatCurrency(trade.fees_total, currency)} />
      {dividends !== 0 ? (
        <Row
          label={t`Dividends`}
          value={formatPnl(dividends, currency)}
          tint={pnlColor(theme.colors, dividends)}
        />
      ) : null}
      <Row label={t`Net P&L`} value={formatPnl(trade.net_pnl, currency)} tint={tint} />
      {dividends !== 0 && trade.total_pnl != null ? (
        <Row
          label={t`Total P&L`}
          value={formatPnl(trade.total_pnl, currency)}
          tint={pnlColor(theme.colors, trade.total_pnl)}
        />
      ) : null}
    </DashboardCard>
  );
}

function TimingCard({ trade }: { trade: TradeLike }) {
  const { formatDate, formatTime } = useFormatters();
  return (
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
  );
}

function PositionCard({ trade }: { trade: TradeLike }) {
  const { formatCurrency } = useFormatters();
  const currency = trade.pnl_currency;
  return (
    <DashboardCard title={t`Position`}>
      <Row label={t`Quantity`} value={String(trade.qty_opened)} />
      {trade.qty_remaining > 0 ? (
        <Row label={t`Remaining`} value={String(trade.qty_remaining)} />
      ) : null}
      <Row label={t`Avg entry`} value={formatCurrency(trade.avg_entry_price, currency)} />
      <Row label={t`Avg exit`} value={formatCurrency(trade.avg_exit_price, currency)} />
      <Row label={t`Notional`} value={formatCurrency(tradeNotional(trade), currency)} />
    </DashboardCard>
  );
}

export default function TradeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // The row that was tapped, straight from the list cache — it carries the
  // whole top half of this screen, so a slow `/trades/{id}` no longer means an
  // empty page.
  const preview = useCachedTradeRow(id);
  const { data: trade, error, refetch, isFetching } = useTrade(id);

  const gone = error instanceof ApiError && error.status === 404;

  if (trade) return <TradeDetailBody trade={trade} refetch={refetch} />;
  // Nothing to show behind the failure — or the trade is genuinely gone, which
  // no amount of retrying brings back.
  if (error && (gone || !preview)) {
    return (
      <TradeDetailError
        symbol={preview?.symbol}
        error={error}
        retrying={isFetching}
        onRetry={() => void refetch()}
      />
    );
  }
  return (
    <TradeDetailPending
      preview={preview}
      error={error}
      retrying={isFetching}
      onRetry={() => void refetch()}
    />
  );
}

/**
 * Loading, and the landing pad for a failure that still has a cached row to
 * show. With that row this is the real screen minus the cards only the detail
 * response can fill; without one it is the same layout in skeletons, so nothing
 * moves when the data lands. Either way the header shows the symbol (or at
 * least "Trade") — never the route's `[id]`.
 */
function TradeDetailPending({
  preview,
  error,
  retrying,
  onRetry,
}: {
  preview?: Trade;
  error: Error | null;
  retrying: boolean;
  onRetry: () => void;
}) {
  return (
    <>
      {/* headerRight is cleared explicitly: options merge, so navigating from one
          trade straight into another would otherwise leave the previous
          trade's actions menu sitting in the bar, wired to the old id. */}
      <Stack.Screen options={{ title: preview?.symbol ?? t`Trade`, headerRight: () => null }} />
      <ScrollView
        style={styles.page}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
      >
        {preview ? <TradeHero trade={preview} /> : <HeroSkeleton />}
        {preview ? <PnlCard trade={preview} /> : <CardSkeleton title={t`P&L`} rows={3} />}
        {error ? (
          // The row's own numbers are all true; only the rest of the trade is
          // missing, so the retry sits where that missing content would be.
          <DashboardCard title={t`Details`}>
            <Text style={styles.emptyNote}>
              {isUnreachable(error)
                ? t`Couldn't reach the server. The figures above are from your last sync.`
                : errorMessage(error)}
            </Text>
            <View style={styles.emptyAction}>
              <GlassButton
                label={retrying ? t`Retrying…` : t`Try again`}
                systemImage="arrow.clockwise"
                disabled={retrying}
                onPress={onRetry}
              />
            </View>
          </DashboardCard>
        ) : (
          <Skeleton style={styles.skeletonChart} />
        )}
        {preview ? <TimingCard trade={preview} /> : <CardSkeleton title={t`Timing`} rows={3} />}
        {preview ? (
          <PositionCard trade={preview} />
        ) : (
          <CardSkeleton title={t`Position`} rows={4} />
        )}
        {error ? null : <CardSkeleton title={t`Journal`} rows={2} />}
      </ScrollView>
    </>
  );
}

function HeroSkeleton() {
  return (
    <View style={styles.hero}>
      <View style={styles.pillRow}>
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} style={styles.skeletonPill} />
        ))}
      </View>
      <Skeleton style={styles.skeletonHeroValue} />
      <Skeleton style={styles.skeletonHeroCaption} />
    </View>
  );
}

/** A real card header over label/value shaped rows — the section that is coming. */
function CardSkeleton({ title, rows }: { title: string; rows: number }) {
  return (
    <DashboardCard title={title}>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={styles.row}>
          {/* Uneven label widths: a stack of identical bars looks like a table. */}
          <Skeleton style={[styles.skeletonLabel, { width: 72 + ((i * 31) % 48) }]} />
          <Skeleton style={styles.skeletonValue} />
        </View>
      ))}
    </DashboardCard>
  );
}

/**
 * Failed to load. Delegates the wording and the icon to `describeError` so this
 * screen says the same thing about a dead server as every other one; what stays
 * local is the header title (the cached symbol, so the bar doesn't go blank)
 * and the way out for a trade that is genuinely gone.
 */
function TradeDetailError({
  symbol,
  error,
  retrying,
  onRetry,
}: {
  symbol?: string;
  error: Error;
  retrying: boolean;
  onRetry: () => void;
}) {
  const router = useRouter();
  const gone = error instanceof ApiError && error.status === 404;

  return (
    <>
      <Stack.Screen options={{ title: symbol ?? t`Trade`, headerRight: () => null }} />
      <ErrorState
        error={error}
        onRetry={onRetry}
        retrying={retrying}
        action={
          gone
            ? { label: t`Back to trades`, systemImage: 'chevron.left', onPress: router.back }
            : undefined
        }
      />
    </>
  );
}

/** Inner body — mutations and share plumbing need the loaded trade in scope. */
function TradeDetailBody({
  trade,
  refetch,
}: {
  trade: TradeDetail;
  refetch: () => Promise<unknown>;
}) {
  const { theme } = useUnistyles();
  // Bound to the display prefs so a privacy flip re-formats every amount here.
  const { formatCurrency, formatDate, formatTime } = useFormatters();
  const router = useRouter();
  const queryClient = useQueryClient();
  const api = useApiRequest();
  // Local pull state, not the query's isRefetching: any sibling observer
  // mounting on this key (the edit sheet) starts a background refetch, and
  // binding the spinner to it plays a pull the user never made.
  const [pulled, setPulled] = useState(false);

  // MAE/MFE from market bars — the server persists the result into the journal.
  const excursion = useMutation({
    mutationFn: () => api<ExcursionResult>(`/trades/${trade.id}/excursion`, { method: 'POST' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.trade(trade.id) });
    },
    onError: (err) => Alert.alert(t`Could not compute excursion`, errorMessage(err)),
  });
  const canExcursion = trade.status === 'closed' && trade.instrument_type !== 'option';

  const remove = useMutation({
    mutationFn: () => api<void>(`/trades/${trade.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      // Removing a trade moves the same figures adding one does.
      armRollingNumbers();
      void queryClient.invalidateQueries();
      router.back();
    },
    onError: (err) => Alert.alert(t`Could not delete`, errorMessage(err)),
  });

  function confirmDelete() {
    Alert.alert(
      t`Remove trade?`,
      t`Permanently deletes this trade and all of its fills. This cannot be undone.`,
      [
        { text: t`Cancel`, style: 'cancel' },
        { text: t`Remove`, style: 'destructive', onPress: () => remove.mutate() },
      ],
    );
  }

  const isOpen = trade.status === 'open';
  const currency = trade.pnl_currency;
  const tint = pnlColor(theme.colors, trade.net_pnl);
  const r = trade.r_multiple ?? tradeRMultiple(trade);

  const journal = parseJournalNotes(trade.notes);
  const emotions = parseEmotionalStates(trade.emotional_state);
  const setupGrade = gradeFromInt(trade.confidence);
  const execGrade = gradeFromInt(trade.trade_quality);
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
      emotions.length > 0 ||
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
            <AppHost matchContents>
              <Menu
                label={<UIImage systemName="ellipsis.circle" size={17} />}
                modifiers={[
                  buttonStyle('plain'),
                  tintModifier(theme.colors.foreground),
                  accessibilityLabel(t`Trade actions`),
                ]}
              >
                <UIButton
                  label={t`Edit trade`}
                  systemImage="pencil"
                  onPress={() =>
                    router.push({ pathname: '/edit-trade', params: { id: trade.id } })
                  }
                />
                <UIButton
                  label={t`Replay trade`}
                  systemImage="play.rectangle"
                  onPress={() => router.push({ pathname: '/replay', params: { id: trade.id } })}
                />
                <UIButton
                  label={t`Share card`}
                  systemImage="square.and.arrow.up"
                  onPress={() =>
                    router.push({ pathname: '/share-trade', params: { id: trade.id } })
                  }
                />
                {canExcursion ? (
                  <UIButton
                    label={t`Recompute MAE/MFE`}
                    systemImage="waveform.path.ecg"
                    onPress={() => excursion.mutate()}
                  />
                ) : null}
                <UIButton
                  role="destructive"
                  label={t`Remove trade`}
                  systemImage="trash"
                  onPress={confirmDelete}
                />
              </Menu>
            </AppHost>
          ),
        }}
      />
      <ScrollView
        style={styles.page}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={pulled}
            onRefresh={() => {
              setPulled(true);
              void refetch().finally(() => setPulled(false));
            }}
          />
        }
      >
        <TradeHero trade={trade} />

        <PnlCard trade={trade} />

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
            {trade.post_exit_mfe != null ? (
              <Row
                label={t`Post-exit MFE`}
                value={formatCurrency(trade.post_exit_mfe, currency)}
                tint={theme.colors.profit}
              />
            ) : null}
            {trade.post_exit_mae != null ? (
              <Row
                label={t`Post-exit MAE`}
                value={formatCurrency(trade.post_exit_mae, currency)}
                tint={theme.colors.loss}
              />
            ) : null}
          </DashboardCard>
        ) : null}

        <TradeChart trade={trade} />

        <TimingCard trade={trade} />

        <PositionCard trade={trade} />

        {hasJournal ? (
          <DashboardCard
            title={t`Journal`}
            action={{
              label: t`Review`,
              onPress: () =>
                router.push({ pathname: '/quick-journal', params: { id: trade.id } }),
            }}
          >
            {trade.setup ? (
              <PillBlock label={t`Setup`}>
                <Pill tone="accent">{trade.setup.name}</Pill>
                {trade.setup_ids.length > 1 ? (
                  <Pill tone="muted">+{trade.setup_ids.length - 1}</Pill>
                ) : null}
              </PillBlock>
            ) : null}
            {journal.session ? (
              <PillBlock label={t`Session`}>
                <Pill tone="muted">{journal.session}</Pill>
              </PillBlock>
            ) : null}
            {emotions.length > 0 ? (
              <PillBlock label={t`Emotion`}>
                {emotions.map((emotion) => (
                  <Pill key={emotion} tone="muted">
                    {emotion}
                  </Pill>
                ))}
              </PillBlock>
            ) : null}
            {setupGrade || execGrade ? (
              <View style={styles.grades}>
                {setupGrade ? <GradeTile label={t`Setup rating`} grade={setupGrade} /> : null}
                {execGrade ? <GradeTile label={t`Execution rating`} grade={execGrade} /> : null}
              </View>
            ) : null}
            <TextBlock label={t`Entry reason`} value={journal.entryReason} />
            <TextBlock label={t`Exit reason`} value={journal.exitReason} />
            <TextBlock label={t`Review notes`} value={journal.reviewNotes} />
          </DashboardCard>
        ) : (
          // An unjournaled closed trade is the one thing this app exists to fix,
          // so the card stays — as the prompt to write it — instead of vanishing.
          <DashboardCard title={t`Journal`}>
            <Text style={styles.emptyNote}>
              {isOpen
                ? t`Nothing logged yet. Note the setup and why you took it while it's fresh.`
                : t`Nothing logged yet. A minute of review now is what makes this trade worth something later.`}
            </Text>
            <View style={styles.emptyAction}>
              <GlassButton
                label={t`Write review`}
                systemImage="square.and.pencil"
                onPress={() =>
                  router.push({ pathname: '/quick-journal', params: { id: trade.id } })
                }
              />
            </View>
          </DashboardCard>
        )}

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

        <CoachCard trade={trade} />

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

        <AttachmentsCard trade={trade} />
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
  // Placeholders mirror the loaded screen's own metrics, so nothing shifts when
  // the response lands: pills, the 36pt hero figure, its caption, a chart card.
  skeletonPill: { width: 58, height: 17, borderRadius: theme.radius.sm },
  skeletonHeroValue: { width: 196, height: 38 },
  skeletonHeroCaption: { width: 104, height: 15 },
  // Height of the whole chart card (header, canvas, interval picker), not of
  // the canvas alone — an under-tall placeholder shoves the cards below it down
  // the moment the real chart mounts.
  skeletonChart: { height: 330, borderRadius: theme.radius.lg + 4 },
  skeletonLabel: { height: 15 },
  skeletonValue: { width: 84, height: 15 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.xl,
  },
  muted: { color: theme.colors.mutedForeground, textAlign: 'center' },
  // Bare glyph — the sizing stays for the tap target, not for a visible chip.
  editButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
  hero: { gap: theme.spacing.sm },
  // Wraps: the symbol chip joined direction/status/market, and a long option
  // symbol can push the set past one line.
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: theme.spacing.sm },
  // Pill-shaped like its neighbours, but pressable — the icon is the affordance.
  symbolChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.radius.sm,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.muted,
  },
  symbolChipText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
    color: theme.colors.foreground,
  },
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
  grades: { flexDirection: 'row', gap: theme.spacing.sm },
  gradeTile: {
    flex: 1,
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    borderCurve: 'continuous',
    backgroundColor: theme.colors.muted,
  },
  gradeValue: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
    color: theme.colors.foreground,
    ...theme.numeric,
  },
  emptyNote: { fontSize: 14, lineHeight: 20, color: theme.colors.mutedForeground },
  emptyAction: { alignItems: 'center', paddingTop: theme.spacing.xs },
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
