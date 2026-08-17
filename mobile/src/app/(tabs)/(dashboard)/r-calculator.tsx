
import { useHeaderHeight } from 'expo-router/react-navigation';
import { Stack } from 'expo-router/stack';
import { cn } from 'panelui-native';
import { Children, Fragment, useState, type ReactNode } from 'react';
import { Keyboard, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useCSSVariable } from 'uniwind';

import { Icon } from '@/components/icon';
import { DashboardCard } from '@/components/dashboard-card';
import { GlassButton } from '@/components/glass-button';
import { NumericField } from '@/components/numeric-field';
import { Pill } from '@/components/pill';
import { Segmented } from '@/components/segmented';
import { StatBar } from '@/components/stat-bar';
import { SymbolPager } from '@/components/symbol-pager';
import { usePrompt, type PromptOptions } from '@/components/use-prompt';
import { t } from '@lingui/core/macro';
import type { Direction, Warning, WarningKey } from '@/lib/r-calculator/calc';
import { EXIT_PRESETS, matchPreset, type TrailerStop } from '@/lib/r-calculator/exit';
import { money, rLabel, shares as fmtShares } from '@/lib/r-calculator/format';
import type { EntryAt } from '@/lib/r-calculator/fvg';
import type { FvgSession } from '@/lib/r-calculator/fvgSessions';
import {
  deriveFvgSession,
  deriveSession,
  fvgActions,
  rCalcActions,
  useFvg,
  useRCalc,
} from '@/lib/r-calculator/store';
import type { Instrument, OptionType, Session } from '@/lib/r-calculator/sessions';

type Mode = 'r' | 'fvg';

/** Settings-row metrics shared by every field in the calculator. */
const FIELD_ROW = 'min-h-[48px] flex-row items-center gap-3 py-1';
const FIELD_LABEL = 'text-[15px] font-semibold text-foreground';
/** Trailing controls hug their content and sit on the label's centre line. */
const FIELD_CONTROL = 'ml-auto shrink';

// ---------------------------------------------------------------------------
// Localized copy for the engine's stable warning keys
// ---------------------------------------------------------------------------

function warningText(key: WarningKey): string {
  switch (key) {
    case 'warn_stop_below_entry_long':
      return t`Stop must be below entry for a long`;
    case 'warn_stop_above_entry_short':
      return t`Stop must be above entry for a short`;
    case 'warn_capital_too_small_stock':
      return t`Capital can't buy 1 share — pick a cheaper instrument or add capital`;
    case 'warn_risk_below_setting':
      return t`Actual risk is below your target.`;
    case 'warn_prem_stop_vs_entry':
      return t`Stop premium must be below entry premium`;
    case 'warn_capital_too_small_option':
      return t`Capital can't buy 1 contract — lower the premium or add capital`;
    case 'warn_risk_budget_too_small':
      return t`Risk budget under 1 contract — raise Risk% or tighten the stop`;
    case 'warn_tier_sum_over100':
      return t`Exit tiers exceed 100% — lower the percentages`;
    case 'warn_tier_rnon_positive':
      return t`Exit tier R must be greater than 0`;
    case 'warn_trailer_stop_too_high':
      return t`Trailing stop should sit below the first tier`;
    case 'warn_fvg_zone_invalid':
      return t`Gap top must sit above the bottom — check the edges`;
    case 'warn_fvg_oner_nonpositive':
      return t`Entry and stop collapse to no risk — move the entry or add a stop buffer`;
    default:
      return t`Account is too small to take even one share at this risk`;
  }
}

/** Text tint per warning tone — `caution` takes the section-title accent. */
const WARN_CLASS: Record<Warning['tone'], string> = {
  danger: 'text-destructive',
  caution: 'text-heading',
  ok: 'text-muted-foreground',
};

function WarningList({ warns }: { warns: Warning[] }) {
  // The glyph beside each line takes the same hue as a JS value.
  const [destructive, heading, mutedForeground] = useCSSVariable([
    '--color-destructive',
    '--color-heading',
    '--color-muted-foreground',
  ]) as [string, string, string];
  if (warns.length === 0) return null;
  const tint = (tone: Warning['tone']) =>
    tone === 'danger' ? destructive : tone === 'caution' ? heading : mutedForeground;
  return (
    <View className="gap-1">
      {warns.map((warning) => (
        <View key={warning.key} className="flex-row items-start gap-1.5">
          <Icon
            name={warning.tone === 'ok' ? 'checkmark.circle' : 'exclamationmark.triangle'}
            size={13}
            tintColor={tint(warning.tone)}
          />
          <Text className={cn('flex-1 text-xs leading-[17px]', WARN_CLASS[warning.tone])}>
            {warningText(warning.key)}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Field vocabulary — label leading, value trailing
// ---------------------------------------------------------------------------

/**
 * Hairline-separated run of rows inside a dashboard card. The card is the
 * surface (`form-rows.tsx` draws its own), so this only carries the rules
 * between rows and cancels the card's gap: a grouped list reads as one block,
 * not a stack of floating lines.
 */
function FieldGroup({ children }: { children: ReactNode }) {
  const rows = Children.toArray(children);
  return (
    // Rows sit flush against each other; the hairline is the only divider, so
    // the group needs the card's own gap cancelled.
    <View className="-my-1">
      {rows.map((row, index) => (
        <Fragment key={index}>
          {index > 0 ? <View className="h-px bg-border" /> : null}
          {row}
        </Fragment>
      ))}
    </View>
  );
}

/** Label leading, control trailing — the settings-row idiom (`form-rows.tsx`). */
function ControlField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View className={FIELD_ROW}>
      <Text className={FIELD_LABEL}>{label}</Text>
      <View className={FIELD_CONTROL}>{children}</View>
    </View>
  );
}

/**
 * Number row. Local text mirrors the store number so "1." and "" survive
 * mid-typing, and outside changes (preset, page switch) still adopt.
 */
function NumberRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const [text, setText] = useState(() => String(value));
  const [adopted, setAdopted] = useState(value);
  if (value !== adopted) {
    setAdopted(value);
    setText(String(value));
  }
  return (
    <View className={FIELD_ROW}>
      <Text className={FIELD_LABEL}>{label}</Text>
      {/* A definite box for the field: left to size itself it drifts above the
          label's centre line in some rows. */}
      <View className="h-6 flex-1 justify-center">
        <NumericField
          align="trailing"
          value={text}
          placeholder="0"
          onChangeText={(next) => {
            setText(next);
            const parsed = Number(next);
            if (Number.isFinite(parsed)) {
              setAdopted(parsed);
              onChange(parsed);
            }
          }}
        />
      </View>
    </View>
  );
}

/** The ticker that names this page — see `pageLabel`. */
function SymbolField({
  value,
  onChange,
}: {
  value: string;
  onChange: (symbol: string) => void;
}) {
  // `placeholderTextColor` is a prop, not a style — it needs the token's value.
  const [mutedForeground] = useCSSVariable(['--color-muted-foreground']) as [string];
  return (
    <View className={FIELD_ROW}>
      <Text className={FIELD_LABEL}>{t`Symbol`}</Text>
      {/* The text field takes the rest of the row and right-aligns, so its
          value lands on the same edge as the trailing controls'. */}
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="AAPL"
        placeholderTextColor={mutedForeground}
        autoCapitalize="characters"
        autoCorrect={false}
        className="flex-1 py-2 text-right text-base text-foreground"
      />
    </View>
  );
}

/**
 * One page of the pager. Owns its own scrolling — the tab strip stays pinned
 * while each position scrolls independently, so swiping between them doesn't
 * jump you to someone else's scroll offset.
 */
function CalcPage({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="grow"
      // The pinned strip above already clears the transparent nav bar; the
      // automatic behaviour would inset this page by it a second time.
      contentInsetAdjustmentBehavior="never"
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      {/* Decimal pads have no return key — tapping any empty space dismisses. */}
      {/* `pb-18` clears the tab bar — this page's scroll view opts out of the
          automatic content insets that would otherwise carry it. */}
      <Pressable onPress={Keyboard.dismiss} accessible={false} className="grow gap-4 p-4 pb-18">
        {children}
      </Pressable>
    </ScrollView>
  );
}

/** A page's tab label: its ticker, or the numbered placeholder until you type one. */
function pageLabel(symbol: string, index: number): string {
  return symbol.trim() ? symbol.trim().toUpperCase() : t`Symbol ${index + 1}`;
}

/**
 * Retitle a page from its tab — the same edit as the Symbol field, reachable
 * without scrolling back to it. Raised through `usePrompt`, the single-value
 * idiom the settings forms use: `Alert.prompt` is iOS-only, and the hook falls
 * back to a dialog everywhere else.
 */
function promptRename(
  prompt: (options: PromptOptions) => void,
  symbol: string,
  onRename: (symbol: string) => void,
) {
  prompt({
    title: t`Symbol`,
    defaultValue: symbol,
    onSubmit: (next) => onRename(next.trim()),
  });
}

// ---------------------------------------------------------------------------
// R-multiple panel
// ---------------------------------------------------------------------------

function RPanel({ session }: { session: Session }) {
  // The remove-tier glyph is tinted with a JS value, not a class.
  const [destructive] = useCSSVariable(['--color-destructive']) as [string];
  const { result, riskPerUnit, exitResult, warns, exitWarns } = deriveSession(session);
  const id = session.id;
  const isOptions = session.instrument === 'options';

  const instruments = [
    { value: 'stock' as const, label: t`Stock` },
    { value: 'options' as const, label: t`Options` },
  ];
  const directions = [
    { value: 'long' as const, label: t`Long` },
    { value: 'short' as const, label: t`Short` },
  ];
  // Buying an option is always long the premium — the engine sizes it that way
  // — so the directional call lives in the contract itself, not in Long/Short.
  const optionTypes = [
    { value: 'call' as const, label: t`Call` },
    { value: 'put' as const, label: t`Put` },
  ];
  const perUnit = isOptions ? t`per contract` : t`per share`;
  const instrumentRows = isOptions
    ? [
        <ControlField key="type" label={t`Contract`}>
          <Segmented
            options={optionTypes}
            value={session.optionType}
            onChange={(value: OptionType) => rCalcActions.setField(id, 'optionType', value)}
          />
        </ControlField>,
        <NumberRow
          key="entryPrem"
          label={t`Entry premium`}
          value={session.entryPrem}
          onChange={(v) => rCalcActions.setField(id, 'entryPrem', v)}
        />,
        <NumberRow
          key="stopPrem"
          label={t`Stop premium`}
          value={session.stopPrem}
          onChange={(v) => rCalcActions.setField(id, 'stopPrem', v)}
        />,
        <NumberRow
          key="contractSize"
          label={t`Contract size`}
          value={session.contractSize}
          onChange={(v) => rCalcActions.setField(id, 'contractSize', v)}
        />,
      ]
    : [
        <ControlField key="direction" label={t`Direction`}>
          <Segmented
            options={directions}
            value={session.direction}
            onChange={(value: Direction) => rCalcActions.setField(id, 'direction', value)}
          />
        </ControlField>,
        <NumberRow
          key="entry"
          label={t`Entry`}
          value={session.entry}
          onChange={(v) => rCalcActions.setField(id, 'entry', v)}
        />,
        <NumberRow
          key="stop"
          label={t`Stop`}
          value={session.stop}
          onChange={(v) => rCalcActions.setField(id, 'stop', v)}
        />,
      ];
  const presetId = matchPreset(session.exitPlan);
  const trailerKinds = [
    { value: 'breakeven' as const, label: t`Breakeven` },
    { value: 'original' as const, label: t`Original` },
    { value: 'custom' as const, label: t`Custom` },
  ];

  return (
    <>
      <DashboardCard
        title={t`Position`}
        control={
          <Segmented
            compact
            options={instruments}
            value={session.instrument}
            onChange={(value: Instrument) => rCalcActions.setField(id, 'instrument', value)}
          />
        }
      >
        <FieldGroup>
          <SymbolField
            value={session.symbol}
            onChange={(symbol) => rCalcActions.setSymbol(id, symbol)}
          />
          {instrumentRows}
          <NumberRow
            label={t`Capital`}
            value={session.capital}
            onChange={(v) => rCalcActions.setField(id, 'capital', v)}
          />
          <NumberRow
            label={t`Risk %`}
            value={session.riskPct}
            onChange={(v) => rCalcActions.setField(id, 'riskPct', v)}
          />
        </FieldGroup>
        <WarningList warns={warns} />
      </DashboardCard>

      <DashboardCard title={t`Size`} flush>
        <View className="flex-row flex-wrap gap-2">
          <StatBar
            label={isOptions ? t`Contracts` : t`Shares`}
            value={fmtShares(result.shares)}
            sub={
              result.limiter === 'cash'
                ? t`cash-limited`
                : result.limiter === 'risk'
                  ? t`risk-limited`
                  : undefined
            }
            tone="accent"
          />
          {/* One unit's cash risk: the premium difference alone understates an
              option, where a contract carries `contract size` of it. */}
          <StatBar label={t`1R`} value={money(riskPerUnit)} sub={perUnit} />
          <StatBar
            label={t`Risk`}
            value={money(result.realRisk)}
            sub={t`budget ${money(result.riskAmt)}`}
            tone="neg"
          />
          {/* An option buyer's position value is the debit paid — and it is
              also the whole of what can be lost, which "Position value" hides. */}
          <StatBar
            label={isOptions ? t`Premium paid` : t`Position value`}
            value={money(result.posValue)}
          />
          <StatBar label={t`Cash left`} value={money(result.remainingCash)} />
          <StatBar
            label={t`+2R target`}
            value={money(result.target2)}
            sub={`+${money(result.profit2)}`}
            tone="pos"
          />
          <StatBar
            label={t`+3R target`}
            value={money(result.target3)}
            sub={`+${money(result.profit3)}`}
            tone="pos"
          />
        </View>
      </DashboardCard>

      <DashboardCard
        title={t`Exit ladder`}
        control={
          <View className="flex-row gap-2">
            {EXIT_PRESETS.map((preset) => (
              <Pressable
                key={preset.id}
                onPress={() => rCalcActions.applyExitPreset(id, preset.plan)}
                accessibilityRole="button"
                className="active:opacity-60"
              >
                <Pill tone={presetId === preset.id ? 'accent' : 'muted'}>
                  {preset.id === 'aggressive' ? t`Aggressive` : t`Conservative`}
                </Pill>
              </Pressable>
            ))}
          </View>
        }
      >
        {/* One group per tier: the R and the size belong to each other, and a
            single run of rows would leave nothing to hang "Tier 2" off. */}
        {session.exitPlan.tiers.map((tier, index) => (
          <FieldGroup key={index}>
            <View className={FIELD_ROW}>
              <Text className="text-[13px] font-semibold tracking-wide text-muted-foreground">
                {t`Tier ${index + 1}`}
              </Text>
              <Pressable
                onPress={() => rCalcActions.removeTier(id, index)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={t`Remove tier`}
                className={cn(FIELD_CONTROL, 'active:opacity-60')}
              >
                <Icon name="minus.circle" size={18} tintColor={destructive} />
              </Pressable>
            </View>
            <NumberRow
              label={t`Target R`}
              value={tier.r}
              onChange={(v) => rCalcActions.setTier(id, index, { r: v })}
            />
            <NumberRow
              label={t`Sell %`}
              value={tier.pct}
              onChange={(v) => rCalcActions.setTier(id, index, { pct: v })}
            />
          </FieldGroup>
        ))}
        <View className="items-center">
          <GlassButton
            label={t`Add tier`}
            systemImage="plus"
            onPress={() => rCalcActions.addTier(id)}
          />
        </View>

        <FieldGroup>
          <ControlField label={t`Runner stop`}>
            <Segmented
              variant="menu"
              title={t`Runner stop`}
              options={trailerKinds}
              value={session.exitPlan.trailerStop.kind}
              onChange={(kind) =>
                rCalcActions.setTrailerStop(
                  id,
                  kind === 'custom' ? { kind, r: 0.5 } : ({ kind } as TrailerStop),
                )
              }
            />
          </ControlField>
          {session.exitPlan.trailerStop.kind === 'custom' ? (
            <NumberRow
              label={t`Stop at R`}
              value={session.exitPlan.trailerStop.r}
              onChange={(v) => rCalcActions.setTrailerStop(id, { kind: 'custom', r: v })}
            />
          ) : null}
        </FieldGroup>

        <View className="flex-row flex-wrap gap-2">
          <StatBar label={t`Locked at tiers`} value={money(exitResult.locked)} tone="pos" />
          <StatBar
            label={t`Guaranteed floor`}
            value={money(exitResult.floor)}
            sub={rLabel(exitResult.floorR)}
            tone={exitResult.floor >= 0 ? 'pos' : 'neg'}
          />
          <StatBar
            label={t`Runner`}
            value={fmtShares(exitResult.trailerShares)}
            sub={t`${money(exitResult.perR)} per +1R`}
          />
          <StatBar
            label={t`At ${rLabel(exitResult.trailerTargetR)}`}
            value={money(exitResult.totalAtTarget)}
            sub={t`blended ${rLabel(exitResult.blendedRAtTarget)}`}
            tone="pos"
          />
        </View>
        <WarningList warns={exitWarns} />
      </DashboardCard>
    </>
  );
}

/** Every saved sizing as a swipeable page, one tab per symbol (trade-form shape). */
function RPager({ topStyle }: { topStyle: { paddingTop: number } }) {
  const { prompt, element: promptElement } = usePrompt();
  const { sessions, activeId } = useRCalc();
  const active = Math.max(
    0,
    sessions.findIndex((session) => session.id === activeId),
  );

  return (
    <>
      <SymbolPager
        tabs={sessions.map((session, index) => ({
          key: session.id,
          label: pageLabel(session.symbol, index),
        }))}
        active={active}
        addLabel={t`Add symbol`}
        removeLabel={t`Remove symbol`}
        topStyle={topStyle}
        onSelect={(index) => rCalcActions.setActive(sessions[index].id)}
        onLongPressTab={(index) =>
          promptRename(prompt, sessions[index].symbol, (symbol) =>
            rCalcActions.setSymbol(sessions[index].id, symbol),
          )
        }
        onAdd={rCalcActions.addSession}
        onRemoveActive={() => rCalcActions.removeSession(activeId)}
        renderPage={(index) => (
          <CalcPage>
            <RPanel session={sessions[index]} />
          </CalcPage>
        )}
      />
      {promptElement}
    </>
  );
}

// ---------------------------------------------------------------------------
// FVG panel
// ---------------------------------------------------------------------------

function FvgPanel({ session }: { session: FvgSession }) {
  const { result, warns } = deriveFvgSession(session);
  const id = session.id;

  const directions = [
    { value: 'long' as const, label: t`Long` },
    { value: 'short' as const, label: t`Short` },
  ];
  const entryAts = [
    { value: 'top' as const, label: t`Top` },
    { value: 'mid' as const, label: t`Mid` },
    { value: 'bottom' as const, label: t`Bottom` },
    { value: 'manual' as const, label: t`Manual` },
  ];

  return (
    <>
      <DashboardCard title={t`Fair value gap`}>
        <FieldGroup>
          <SymbolField
            value={session.symbol}
            onChange={(symbol) => fvgActions.setSymbol(id, symbol)}
          />
          <ControlField label={t`Direction`}>
            <Segmented
              options={directions}
              value={session.direction}
              onChange={(value) => fvgActions.setField(id, 'direction', value)}
            />
          </ControlField>
          <NumberRow
            label={t`Gap top`}
            value={session.zoneTop}
            onChange={(v) => fvgActions.setField(id, 'zoneTop', v)}
          />
          <NumberRow
            label={t`Gap bottom`}
            value={session.zoneBottom}
            onChange={(v) => fvgActions.setField(id, 'zoneBottom', v)}
          />
          <ControlField label={t`Entry at`}>
            <Segmented
              variant="menu"
              title={t`Entry at`}
              options={entryAts}
              value={session.entryAt}
              onChange={(value: EntryAt) => fvgActions.setField(id, 'entryAt', value)}
            />
          </ControlField>
          {session.entryAt === 'manual' ? (
            <NumberRow
              label={t`Entry price`}
              value={session.entryPrice}
              onChange={(v) => fvgActions.setField(id, 'entryPrice', v)}
            />
          ) : null}
          <NumberRow
            label={t`Stop buffer`}
            value={session.stopBuffer}
            onChange={(v) => fvgActions.setField(id, 'stopBuffer', v)}
          />
          <NumberRow
            label={t`Target R`}
            value={session.rMultiple}
            onChange={(v) => fvgActions.setField(id, 'rMultiple', v)}
          />
          <NumberRow
            label={t`Capital`}
            value={session.account}
            onChange={(v) => fvgActions.setField(id, 'account', v)}
          />
          <NumberRow
            label={t`Risk %`}
            value={session.riskPct}
            onChange={(v) => fvgActions.setField(id, 'riskPct', v)}
          />
        </FieldGroup>
        <WarningList warns={warns} />
      </DashboardCard>

      <DashboardCard title={t`Plan`} flush>
        <View className="flex-row flex-wrap gap-2">
          <StatBar label={t`Shares`} value={fmtShares(result.shares)} tone="accent" />
          <StatBar label={t`Entry`} value={money(result.entryPrice)} />
          <StatBar label={t`Stop`} value={money(result.stopPrice)} tone="neg" />
          <StatBar
            label={t`Target`}
            value={money(result.targetPrice)}
            sub={rLabel(result.realRR)}
            tone="pos"
          />
          <StatBar label={t`Risk`} value={money(result.lossAtStop)} tone="neg" />
          <StatBar label={t`Profit at target`} value={money(result.profitAtTarget)} tone="pos" />
          <StatBar label={t`Position value`} value={money(result.positionValue)} />
        </View>
      </DashboardCard>
    </>
  );
}

function FvgPager({ topStyle }: { topStyle: { paddingTop: number } }) {
  const { prompt, element: promptElement } = usePrompt();
  const { sessions, activeId } = useFvg();
  const active = Math.max(
    0,
    sessions.findIndex((session) => session.id === activeId),
  );

  return (
    <>
      <SymbolPager
        tabs={sessions.map((session, index) => ({
          key: session.id,
          label: pageLabel(session.symbol, index),
        }))}
        active={active}
        addLabel={t`Add symbol`}
        removeLabel={t`Remove symbol`}
        topStyle={topStyle}
        onSelect={(index) => fvgActions.setActive(sessions[index].id)}
        onLongPressTab={(index) =>
          promptRename(prompt, sessions[index].symbol, (symbol) =>
            fvgActions.setSymbol(sessions[index].id, symbol),
          )
        }
        onAdd={fvgActions.addSession}
        onRemoveActive={() => fvgActions.removeSession(activeId)}
        renderPage={(index) => (
          <CalcPage>
            <FvgPanel session={sessions[index]} />
          </CalcPage>
        )}
      />
      {promptElement}
    </>
  );
}

/** R-multiple / FVG position calculator — pure engine ported from the web app. */
export default function RCalculatorScreen() {
  const [mode, setMode] = useState<Mode>('r');
  // The tab strip sits outside the scroll views, so it clears the transparent
  // nav bar with padding of its own instead of a content inset.
  const headerHeight = useHeaderHeight();
  const modes = [
    { value: 'r' as const, label: t`R-Multiple` },
    { value: 'fvg' as const, label: t`FVG` },
  ];

  return (
    <>
      <Stack.Screen
        options={{
          title: t`R calculator`,
          headerLargeTitle: false,
          headerTitle: () => (
            <Segmented compact options={modes} value={mode} onChange={setMode} />
          ),
        }}
      />
      <View className="flex-1 bg-background">
        {mode === 'r' ? (
          <RPager topStyle={{ paddingTop: headerHeight }} />
        ) : (
          <FvgPager topStyle={{ paddingTop: headerHeight }} />
        )}
      </View>
    </>
  );
}
