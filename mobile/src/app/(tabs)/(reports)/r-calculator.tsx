import { SymbolView } from 'expo-symbols';
import { Stack } from 'expo-router/stack';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { DashboardCard } from '@/components/dashboard-card';
import { FormField, FormInput } from '@/components/form-sheet';
import { Pill } from '@/components/pill';
import { Segmented } from '@/components/segmented';
import { StatBar } from '@/components/stat-bar';
import { t } from '@lingui/core/macro';
import type { Direction, Warning, WarningKey } from '@/lib/r-calculator/calc';
import { EXIT_PRESETS, matchPreset, type TrailerStop } from '@/lib/r-calculator/exit';
import { money, rLabel, shares as fmtShares } from '@/lib/r-calculator/format';
import type { EntryAt } from '@/lib/r-calculator/fvg';
import {
  fvgActions,
  rCalcActions,
  useFvg,
  useRCalc,
} from '@/lib/r-calculator/store';
import type { Instrument } from '@/lib/r-calculator/sessions';

type Mode = 'r' | 'fvg';

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

function WarningList({ warns }: { warns: Warning[] }) {
  const { theme } = useUnistyles();
  if (warns.length === 0) return null;
  const tint = (tone: Warning['tone']) =>
    tone === 'danger'
      ? theme.colors.destructive
      : tone === 'caution'
        ? theme.colors.accent
        : theme.colors.mutedForeground;
  return (
    <View style={styles.warnings}>
      {warns.map((warning) => (
        <View key={warning.key} style={styles.warningRow}>
          <SymbolView
            name={warning.tone === 'ok' ? 'checkmark.circle' : 'exclamationmark.triangle'}
            size={13}
            tintColor={tint(warning.tone)}
          />
          <Text style={[styles.warningText, { color: tint(warning.tone) }]}>
            {warningText(warning.key)}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Numeric field bound to a store setter — keeps typing loose, math strict. */
function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  // Local text mirrors the store number so "1." and "" survive mid-typing.
  const [text, setText] = useState(() => String(value));
  const [focusedValue, setFocusedValue] = useState(value);
  // Adopt outside changes (session switch) without fighting the keyboard.
  if (value !== focusedValue) {
    setFocusedValue(value);
    setText(String(value));
  }
  return (
    <FormField label={label}>
      <FormInput
        value={text}
        onChangeText={(next) => {
          setText(next);
          const parsed = Number(next);
          if (Number.isFinite(parsed)) {
            setFocusedValue(parsed);
            onChange(parsed);
          }
        }}
        keyboardType="decimal-pad"
        placeholder="0"
      />
    </FormField>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

function Col({ children }: { children: React.ReactNode }) {
  return <View style={styles.col}>{children}</View>;
}

// ---------------------------------------------------------------------------
// Session rail (shared shape for both calculators)
// ---------------------------------------------------------------------------

function SessionRail({
  sessions,
  activeId,
  onSelect,
  onAdd,
  onRemove,
  onRename,
}: {
  sessions: { id: string; name: string }[];
  activeId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRemove?: (id: string) => void;
  onRename?: (id: string, name: string) => void;
}) {
  const { theme } = useUnistyles();

  function longPress(session: { id: string; name: string }) {
    Alert.alert(session.name, undefined, [
      ...(onRename
        ? [
            {
              text: t`Rename`,
              onPress: () => {
                Alert.prompt(
                  t`Rename`,
                  undefined,
                  [
                    { text: t`Cancel`, style: 'cancel' as const },
                    {
                      text: t`Save`,
                      onPress: (name?: string) => {
                        if (name?.trim()) onRename(session.id, name.trim());
                      },
                    },
                  ],
                  'plain-text',
                  session.name,
                );
              },
            },
          ]
        : []),
      ...(onRemove && sessions.length > 1
        ? [
            {
              text: t`Remove`,
              style: 'destructive' as const,
              onPress: () => onRemove(session.id),
            },
          ]
        : []),
      { text: t`Cancel`, style: 'cancel' as const },
    ]);
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.rail}
      style={styles.railScroll}
    >
      {sessions.map((session) => {
        const active = session.id === activeId;
        return (
          <Pressable
            key={session.id}
            onPress={() => onSelect(session.id)}
            onLongPress={() => longPress(session)}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [
              styles.railChip,
              active && styles.railChipActive,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.railLabel, active && styles.railLabelActive]} numberOfLines={1}>
              {session.name}
            </Text>
          </Pressable>
        );
      })}
      <Pressable
        onPress={onAdd}
        accessibilityRole="button"
        accessibilityLabel={t`Add position`}
        style={({ pressed }) => [styles.railChip, pressed && styles.pressed]}
      >
        <SymbolView name="plus" size={13} tintColor={theme.colors.foreground} />
      </Pressable>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// R-multiple panel
// ---------------------------------------------------------------------------

function RPanel() {
  const { theme } = useUnistyles();
  const snap = useRCalc();
  const { active, result, exitResult, warns, exitWarns } = snap;
  const isOptions = active.instrument === 'options';

  const instruments = [
    { value: 'stock' as const, label: t`Stock` },
    { value: 'options' as const, label: t`Options` },
  ];
  const directions = [
    { value: 'long' as const, label: t`Long` },
    { value: 'short' as const, label: t`Short` },
  ];
  const presetId = matchPreset(active.exitPlan);
  const trailerKinds = [
    { value: 'breakeven' as const, label: t`Breakeven` },
    { value: 'original' as const, label: t`Original` },
    { value: 'custom' as const, label: t`Custom` },
  ];

  return (
    <>
      <SessionRail
        sessions={snap.sessions}
        activeId={snap.activeId}
        onSelect={rCalcActions.setActive}
        onAdd={rCalcActions.addSession}
        onRemove={rCalcActions.removeSession}
        onRename={rCalcActions.renameSession}
      />

      <DashboardCard
        title={t`Position`}
        control={
          <Segmented
            compact
            options={instruments}
            value={active.instrument}
            onChange={(value: Instrument) => rCalcActions.setField('instrument', value)}
          />
        }
      >
        {isOptions ? (
          <>
            <Row>
              <Col>
                <NumField
                  label={t`Entry premium`}
                  value={active.entryPrem}
                  onChange={(v) => rCalcActions.setField('entryPrem', v)}
                />
              </Col>
              <Col>
                <NumField
                  label={t`Stop premium`}
                  value={active.stopPrem}
                  onChange={(v) => rCalcActions.setField('stopPrem', v)}
                />
              </Col>
            </Row>
            <NumField
              label={t`Contract size`}
              value={active.contractSize}
              onChange={(v) => rCalcActions.setField('contractSize', v)}
            />
          </>
        ) : (
          <>
            <FormField label={t`Direction`}>
              <Segmented
                options={directions}
                value={active.direction}
                onChange={(value: Direction) => rCalcActions.setField('direction', value)}
              />
            </FormField>
            <Row>
              <Col>
                <NumField
                  label={t`Entry`}
                  value={active.entry}
                  onChange={(v) => rCalcActions.setField('entry', v)}
                />
              </Col>
              <Col>
                <NumField
                  label={t`Stop`}
                  value={active.stop}
                  onChange={(v) => rCalcActions.setField('stop', v)}
                />
              </Col>
            </Row>
          </>
        )}
        <Row>
          <Col>
            <NumField
              label={t`Capital`}
              value={active.capital}
              onChange={(v) => rCalcActions.setField('capital', v)}
            />
          </Col>
          <Col>
            <NumField
              label={t`Risk %`}
              value={active.riskPct}
              onChange={(v) => rCalcActions.setField('riskPct', v)}
            />
          </Col>
        </Row>
        <WarningList warns={warns} />
      </DashboardCard>

      <DashboardCard title={t`Size`}>
        <View style={styles.grid}>
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
          <StatBar label={t`1R`} value={money(result.r1)} sub={t`per share`} />
          <StatBar
            label={t`Risk`}
            value={money(result.realRisk)}
            sub={t`budget ${money(result.riskAmt)}`}
            tone="neg"
          />
          <StatBar label={t`Position value`} value={money(result.posValue)} />
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

      <DashboardCard title={t`Exit ladder`}>
        <View style={styles.presetRow}>
          {EXIT_PRESETS.map((preset) => (
            <Pressable
              key={preset.id}
              onPress={() => rCalcActions.applyExitPreset(preset.plan)}
              accessibilityRole="button"
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Pill tone={presetId === preset.id ? 'accent' : 'muted'}>
                {preset.id === 'aggressive' ? t`Aggressive` : t`Conservative`}
              </Pill>
            </Pressable>
          ))}
        </View>

        {active.exitPlan.tiers.map((tier, index) => (
          <View key={index} style={styles.tierRow}>
            <Col>
              <NumField
                label={t`Tier ${index + 1} — R`}
                value={tier.r}
                onChange={(v) => rCalcActions.setTier(index, { r: v })}
              />
            </Col>
            <Col>
              <NumField
                label={t`Sell %`}
                value={tier.pct}
                onChange={(v) => rCalcActions.setTier(index, { pct: v })}
              />
            </Col>
            <Pressable
              onPress={() => rCalcActions.removeTier(index)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t`Remove tier`}
              style={({ pressed }) => [styles.tierRemove, pressed && styles.pressed]}
            >
              <SymbolView name="minus.circle" size={18} tintColor={theme.colors.destructive} />
            </Pressable>
          </View>
        ))}
        <Pressable
          onPress={rCalcActions.addTier}
          accessibilityRole="button"
          style={({ pressed }) => [styles.addTier, pressed && styles.pressed]}
        >
          <SymbolView name="plus.circle" size={16} tintColor={theme.colors.foreground} />
          <Text style={styles.addTierLabel}>{t`Add tier`}</Text>
        </Pressable>

        <FormField label={t`Runner stop`}>
          <Segmented
            options={trailerKinds}
            value={active.exitPlan.trailerStop.kind}
            onChange={(kind) =>
              rCalcActions.setTrailerStop(
                kind === 'custom' ? { kind, r: 0.5 } : ({ kind } as TrailerStop),
              )
            }
          />
        </FormField>
        {active.exitPlan.trailerStop.kind === 'custom' ? (
          <NumField
            label={t`Stop at R`}
            value={active.exitPlan.trailerStop.r}
            onChange={(v) => rCalcActions.setTrailerStop({ kind: 'custom', r: v })}
          />
        ) : null}

        <View style={styles.grid}>
          <StatBar
            label={t`Locked at tiers`}
            value={money(exitResult.locked)}
            tone="pos"
          />
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

// ---------------------------------------------------------------------------
// FVG panel
// ---------------------------------------------------------------------------

function FvgPanel() {
  const snap = useFvg();
  const { active, result, warns } = snap;

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
      <SessionRail
        sessions={snap.sessions}
        activeId={snap.activeId}
        onSelect={fvgActions.setActive}
        onAdd={fvgActions.addSession}
        onRemove={fvgActions.removeSession}
      />

      <DashboardCard title={t`Fair value gap`}>
        <FormField label={t`Direction`}>
          <Segmented
            options={directions}
            value={active.direction}
            onChange={(value) => fvgActions.setField('direction', value)}
          />
        </FormField>
        <Row>
          <Col>
            <NumField
              label={t`Gap top`}
              value={active.zoneTop}
              onChange={(v) => fvgActions.setField('zoneTop', v)}
            />
          </Col>
          <Col>
            <NumField
              label={t`Gap bottom`}
              value={active.zoneBottom}
              onChange={(v) => fvgActions.setField('zoneBottom', v)}
            />
          </Col>
        </Row>
        <FormField label={t`Entry at`}>
          <Segmented
            options={entryAts}
            value={active.entryAt}
            onChange={(value: EntryAt) => fvgActions.setField('entryAt', value)}
          />
        </FormField>
        {active.entryAt === 'manual' ? (
          <NumField
            label={t`Entry price`}
            value={active.entryPrice}
            onChange={(v) => fvgActions.setField('entryPrice', v)}
          />
        ) : null}
        <Row>
          <Col>
            <NumField
              label={t`Stop buffer`}
              value={active.stopBuffer}
              onChange={(v) => fvgActions.setField('stopBuffer', v)}
            />
          </Col>
          <Col>
            <NumField
              label={t`Target R`}
              value={active.rMultiple}
              onChange={(v) => fvgActions.setField('rMultiple', v)}
            />
          </Col>
        </Row>
        <Row>
          <Col>
            <NumField
              label={t`Account`}
              value={active.account}
              onChange={(v) => fvgActions.setField('account', v)}
            />
          </Col>
          <Col>
            <NumField
              label={t`Risk %`}
              value={active.riskPct}
              onChange={(v) => fvgActions.setField('riskPct', v)}
            />
          </Col>
        </Row>
        <WarningList warns={warns} />
      </DashboardCard>

      <DashboardCard title={t`Plan`}>
        <View style={styles.grid}>
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

/** R-multiple / FVG position calculator — pure engine ported from the web app. */
export default function RCalculatorScreen() {
  const [mode, setMode] = useState<Mode>('r');
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
      <ScrollView
        style={styles.page}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
      >
        {mode === 'r' ? <RPanel /> : <FvgPanel />}
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
  row: { flexDirection: 'row', gap: theme.spacing.md },
  col: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
  railScroll: { flexGrow: 0, marginHorizontal: -theme.spacing.lg },
  rail: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    alignItems: 'center',
  },
  railChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 7,
    borderRadius: theme.radius.full,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: theme.colors.border,
    minWidth: 44,
    alignItems: 'center',
  },
  railChipActive: { backgroundColor: theme.colors.card, borderColor: theme.colors.input },
  railLabel: { fontSize: 13, fontWeight: '500', color: theme.colors.mutedForeground },
  railLabelActive: { color: theme.colors.foreground, fontWeight: '600' },
  pressed: { opacity: 0.6 },
  warnings: { gap: theme.spacing.xs },
  warningRow: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing.xs + 2 },
  warningText: { flex: 1, fontSize: 12, lineHeight: 17 },
  presetRow: { flexDirection: 'row', gap: theme.spacing.sm },
  tierRow: { flexDirection: 'row', gap: theme.spacing.md, alignItems: 'flex-end' },
  tierRemove: { paddingBottom: 14 },
  addTier: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs + 2,
    alignSelf: 'flex-start',
  },
  addTierLabel: { fontSize: 13, fontWeight: '500', color: theme.colors.foreground },
}));
