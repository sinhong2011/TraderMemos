import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { cn, Menu, Skeleton } from 'panelui-native';
import { useState, type ReactNode } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useCSSVariable } from 'uniwind';

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
import { TradeChart } from '@/components/trade-chart';
import { t } from '@lingui/core/macro';
import { errorMessage, isUnreachable } from '@/lib/errors';
import { armRollingNumbers } from '@/lib/rolling-numbers';
import { formatDuration, useFormatters } from '@/lib/format';
import { gradeFromInt, parseEmotionalStates, parseJournalNotes } from '@/lib/journal';
import { marketLabel, tradeNotional, tradeRMultiple, tradeStatus } from '@/lib/trades';
import { pnlClass } from '@/styles/pnl';

/** Label/value line — the shape every factual card on this screen is made of. */
function Row({
  label,
  value,
  tintClassName,
}: {
  label: string;
  value: string;
  /** Tints the figure — the P&L and excursion rows color themselves. */
  tintClassName?: string;
}) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text className="text-[15px] text-muted-foreground">{label}</Text>
      <Text
        selectable
        className={cn(
          'text-[15px] font-medium tabular-nums',
          tintClassName ?? 'text-foreground',
        )}
      >
        {value}
      </Text>
    </View>
  );
}

/** Labeled freeform paragraph (entry/exit reasons, review notes). */
function TextBlock({ label, value }: { label: string; value: string }) {
  if (!value.trim()) return null;
  return (
    <View className="gap-1">
      <Text className="text-xs text-muted-foreground">{label}</Text>
      <Text selectable className="text-[15px] leading-[22px] text-foreground">
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
    <View className="gap-1">
      <Text className="text-xs text-muted-foreground">{label}</Text>
      <View className="flex-row flex-wrap gap-2">{children}</View>
    </View>
  );
}

/** Grade tile — the two ratings are the card's scannable verdict, not a row pair. */
function GradeTile({ label, grade }: { label: string; grade: string }) {
  return (
    <View className="flex-1 gap-1 rounded-md bg-muted px-3 py-2">
      <Text className="text-xs text-muted-foreground">{label}</Text>
      <Text className="text-[22px] font-bold tracking-[-0.5px] tabular-nums text-foreground">
        {grade}
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
  // `expo-symbols` takes a resolved color, not a class.
  const [mutedForeground] = useCSSVariable(['--color-muted-foreground']) as [string];
  const router = useRouter();
  return (
    // Pill-shaped like its neighbours, but pressable — the icon is the affordance.
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
      className="flex-row items-center gap-1 rounded-sm bg-muted px-2 py-0.5 active:opacity-60"
    >
      <Icon name="chart.xyaxis.line" size={11} tintColor={mutedForeground} />
      <Text
        className="text-[11px] font-semibold tracking-[0.3px] text-foreground"
        numberOfLines={1}
      >
        {symbol}
      </Text>
    </Pressable>
  );
}

/** Direction/status/market, the P&L figure, and its return·R caption. */
function TradeHero({ trade }: { trade: TradeLike }) {
  const { formatPnl } = useFormatters();
  const status = tradeStatus(trade);
  const isLong = trade.direction === 'long';
  const isOpen = trade.status === 'open';
  const tintClass = pnlClass(trade.net_pnl);
  const r = trade.r_multiple ?? tradeRMultiple(trade);
  const captionParts = [
    ...(trade.return_pct != null
      ? [`${trade.return_pct >= 0 ? '+' : ''}${trade.return_pct.toFixed(2)}%`]
      : []),
    ...(r != null ? [`${r.toFixed(2)}R`] : []),
  ];

  return (
    <View className="gap-2">
      {/* Wraps: the symbol chip joined direction/status/market, and a long
          option symbol can push the set past one line. */}
      <View className="flex-row flex-wrap items-center gap-2">
        <SymbolChip symbol={trade.symbol} market={trade.instrument_type} />
        {/* Position named the way traders do — LONG CALL, SHORT PUT (same
            convention as the trade-row chips). */}
        <Pill tone="muted">
          <Text className={isLong ? 'text-profit' : 'text-loss'}>{isLong ? '↗ ' : '↘ '}</Text>
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
      <Text
        selectable
        className={cn(
          'text-4xl font-bold tracking-[-1px] tabular-nums',
          isOpen ? 'text-muted-foreground' : tintClass,
        )}
      >
        {isOpen ? t`Open` : formatPnl(trade.net_pnl, trade.pnl_currency)}
      </Text>
      {captionParts.length > 0 ? (
        <Text
          className={cn(
            'text-sm font-medium tabular-nums',
            isOpen ? 'text-muted-foreground' : tintClass,
          )}
        >
          {captionParts.join(' · ')}
        </Text>
      ) : null}
    </View>
  );
}

function PnlCard({ trade }: { trade: TradeLike }) {
  const { formatCurrency, formatPnl } = useFormatters();
  const currency = trade.pnl_currency;
  const dividends = trade.dividend_total ?? 0;

  return (
    <DashboardCard title={t`P&L`}>
      <Row
        label={t`Gross P&L`}
        value={formatPnl(trade.gross_pnl, currency)}
        tintClassName={pnlClass(trade.gross_pnl)}
      />
      <Row label={t`Fees`} value={formatCurrency(trade.fees_total, currency)} />
      {dividends !== 0 ? (
        <Row
          label={t`Dividends`}
          value={formatPnl(dividends, currency)}
          tintClassName={pnlClass(dividends)}
        />
      ) : null}
      <Row
        label={t`Net P&L`}
        value={formatPnl(trade.net_pnl, currency)}
        tintClassName={pnlClass(trade.net_pnl)}
      />
      {dividends !== 0 && trade.total_pnl != null ? (
        <Row
          label={t`Total P&L`}
          value={formatPnl(trade.total_pnl, currency)}
          tintClassName={pnlClass(trade.total_pnl)}
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
        className="bg-background"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="gap-4 p-4 pb-12"
      >
        {preview ? <TradeHero trade={preview} /> : <HeroSkeleton />}
        {preview ? <PnlCard trade={preview} /> : <CardSkeleton title={t`P&L`} rows={3} />}
        {error ? (
          // The row's own numbers are all true; only the rest of the trade is
          // missing, so the retry sits where that missing content would be.
          <DashboardCard title={t`Details`}>
            <Text className="text-sm leading-5 text-muted-foreground">
              {isUnreachable(error)
                ? t`Couldn't reach the server. The figures above are from your last sync.`
                : errorMessage(error)}
            </Text>
            <View className="items-center pt-1">
              <GlassButton
                label={retrying ? t`Retrying…` : t`Try again`}
                systemImage="arrow.clockwise"
                disabled={retrying}
                onPress={onRetry}
              />
            </View>
          </DashboardCard>
        ) : (
          // Height of the whole chart card (header, canvas, interval picker),
          // not of the canvas alone — an under-tall placeholder shoves the cards
          // below it down the moment the real chart mounts.
          <Skeleton className="h-[330px] rounded-[18px]" label={t`Loading trade`} />
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

/**
 * Placeholders mirror the loaded screen's own metrics, so nothing shifts when
 * the response lands: pills, the 36pt hero figure, then its caption.
 */
function HeroSkeleton() {
  return (
    <View className="gap-2">
      <View className="flex-row flex-wrap items-center gap-2">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-[17px] w-[58px] rounded-sm" />
        ))}
      </View>
      <Skeleton className="h-[38px] w-[196px]" />
      <Skeleton className="h-[15px] w-[104px]" />
    </View>
  );
}

/** A real card header over label/value shaped rows — the section that is coming. */
function CardSkeleton({ title, rows }: { title: string; rows: number }) {
  return (
    <DashboardCard title={title}>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} className="flex-row items-center justify-between gap-3">
          {/* Uneven label widths: a stack of identical bars looks like a table.
              The width is computed, and `Skeleton` takes no `style` — so the
              measure goes on a wrapper the placeholder stretches to fill. */}
          <View style={{ width: 72 + ((i * 31) % 48) }}>
            <Skeleton className="h-[15px]" />
          </View>
          <Skeleton className="h-[15px] w-[84px]" />
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
  // Bar glyph and menu-row icons are native props, so they take resolved
  // colors rather than classes.
  const [foreground, popoverForeground, destructive] = useCSSVariable([
    '--color-foreground',
    '--color-popover-foreground',
    '--color-destructive',
  ]) as [string, string, string];
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
  const tintClass = pnlClass(trade.net_pnl);
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
          // PanelUI `Menu`, so the same rows draw on both platforms — Android
          // has no pull-down view manager to fall back to.
          headerRight: () => (
            <Menu presentation="bottom-sheet">
              <Menu.Trigger>
                <Pressable
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={t`Trade actions`}
                  className="h-8 w-8 items-center justify-center active:opacity-60"
                >
                  <Icon name="ellipsis.circle" size={17} tintColor={foreground} />
                </Pressable>
              </Menu.Trigger>
              <Menu.Content width="full" className="shadow-none rounded-none">
                <Menu.Item
                  icon={<Icon name="pencil" size={16} tintColor={popoverForeground} />}
                  onSelect={() =>
                    router.push({ pathname: '/edit-trade', params: { id: trade.id } })
                  }
                >
                  {t`Edit trade`}
                </Menu.Item>
                <Menu.Item
                  icon={<Icon name="play.rectangle" size={16} tintColor={popoverForeground} />}
                  onSelect={() => router.push({ pathname: '/replay', params: { id: trade.id } })}
                >
                  {t`Replay trade`}
                </Menu.Item>
                <Menu.Item
                  icon={
                    <Icon name="square.and.arrow.up" size={16} tintColor={popoverForeground} />
                  }
                  onSelect={() =>
                    router.push({ pathname: '/share-trade', params: { id: trade.id } })
                  }
                >
                  {t`Share card`}
                </Menu.Item>
                {canExcursion ? (
                  <Menu.Item
                    icon={
                      <Icon name="waveform.path.ecg" size={16} tintColor={popoverForeground} />
                    }
                    onSelect={() => excursion.mutate()}
                  >
                    {t`Recompute MAE/MFE`}
                  </Menu.Item>
                ) : null}
                <Menu.Separator />
                <Menu.Item
                  variant="destructive"
                  icon={<Icon name="trash" size={16} tintColor={destructive} />}
                  onSelect={confirmDelete}
                >
                  {t`Remove trade`}
                </Menu.Item>
              </Menu.Content>
            </Menu>
          ),
        }}
      />
      <ScrollView
        className="bg-background"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="gap-4 p-4 pb-12"
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
              <Row label={t`R multiple`} value={`${r.toFixed(2)}R`} tintClassName={tintClass} />
            ) : null}
            {trade.mae != null ? (
              <Row
                label={t`MAE`}
                value={formatCurrency(trade.mae, currency)}
                tintClassName="text-loss"
              />
            ) : null}
            {trade.mfe != null ? (
              <Row
                label={t`MFE`}
                value={formatCurrency(trade.mfe, currency)}
                tintClassName="text-profit"
              />
            ) : null}
            {trade.post_exit_mfe != null ? (
              <Row
                label={t`Post-exit MFE`}
                value={formatCurrency(trade.post_exit_mfe, currency)}
                tintClassName="text-profit"
              />
            ) : null}
            {trade.post_exit_mae != null ? (
              <Row
                label={t`Post-exit MAE`}
                value={formatCurrency(trade.post_exit_mae, currency)}
                tintClassName="text-loss"
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
              <View className="flex-row gap-2">
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
            <Text className="text-sm leading-5 text-muted-foreground">
              {isOpen
                ? t`Nothing logged yet. Note the setup and why you took it while it's fresh.`
                : t`Nothing logged yet. A minute of review now is what makes this trade worth something later.`}
            </Text>
            <View className="items-center pt-1">
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
            <View className="flex-row flex-wrap gap-2">
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
            <Text selectable className="text-[15px] leading-[22px] text-foreground">
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
                <View key={fill.id} className="flex-row items-center justify-between gap-3">
                  <View className="shrink gap-px">
                    <Text
                      selectable
                      className="text-[15px] tabular-nums text-foreground"
                      numberOfLines={1}
                    >
                      <Text className={cn('font-bold', isBuy ? 'text-profit' : 'text-loss')}>
                        {isBuy ? t`BUY` : t`SELL`}
                      </Text>
                      {`  ${fill.quantity} · ${formatCurrency(fill.price, currency)}`}
                    </Text>
                    <Text className="text-xs tabular-nums text-muted-foreground">
                      {formatDate(fill.executed_at)} {formatTime(fill.executed_at)}
                    </Text>
                  </View>
                  {fees > 0 ? (
                    <Text className="text-[13px] tabular-nums text-muted-foreground">
                      -{formatCurrency(fees, currency)}
                    </Text>
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
