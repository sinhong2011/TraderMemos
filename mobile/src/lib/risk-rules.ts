/**
 * Risk-rule catalog shared with the web app (web/src/lib/settingsFormSchema.ts):
 * a fixed set of limits the compliance check understands. Only rules with a
 * value are "active"; null clears a rule on PUT /settings/risk-rules.
 */
import type { SFSymbol } from 'expo-symbols';

import { t } from '@lingui/core/macro';

import type { RiskRules } from '@/api/types';

export type RiskRuleKey = keyof RiskRules;

export type RiskRuleDef = {
  key: RiskRuleKey;
  label: () => string;
  detail: () => string;
  unit: '$' | '%' | 'count';
  placeholder: string;
  /** Leading badge glyph in the rule pickers. */
  icon: SFSymbol;
};

export const RISK_RULE_DEFS: readonly RiskRuleDef[] = [
  {
    key: 'max_risk_per_trade',
    label: () => t`Max risk / trade`,
    detail: () => t`Cap planned risk on a single trade.`,
    unit: '$',
    placeholder: 'e.g. 100',
    icon: 'exclamationmark.triangle.fill',
  },
  {
    key: 'max_daily_loss',
    label: () => t`Max daily loss`,
    detail: () => t`Stop when today's realized loss hits this amount.`,
    unit: '$',
    placeholder: 'e.g. 300',
    icon: 'chart.line.downtrend.xyaxis',
  },
  {
    key: 'max_open_risk',
    label: () => t`Max open risk`,
    detail: () => t`Limit total risk across open positions.`,
    unit: '$',
    placeholder: 'e.g. 500',
    icon: 'square.stack.3d.up',
  },
  {
    key: 'max_trades_per_day',
    label: () => t`Max trades / day`,
    detail: () => t`Cap how many trades close in a single day.`,
    unit: 'count',
    placeholder: 'e.g. 5',
    icon: 'calendar.badge.clock',
  },
  {
    key: 'max_consecutive_losses',
    label: () => t`Max consecutive losses`,
    detail: () => t`Stop after this many losing trades in a row.`,
    unit: 'count',
    placeholder: 'e.g. 3',
    icon: 'stop.circle',
  },
  {
    key: 'default_account_risk_pct',
    label: () => t`Default account risk %`,
    detail: () => t`Suggested size as a percent of account equity.`,
    unit: '%',
    placeholder: 'e.g. 1',
    icon: 'slider.horizontal.3',
  },
];

export function emptyRiskRules(): RiskRules {
  return {
    max_risk_per_trade: null,
    max_daily_loss: null,
    max_open_risk: null,
    default_account_risk_pct: null,
    max_trades_per_day: null,
    max_consecutive_losses: null,
  };
}

export function activeRiskRules(
  rules?: RiskRules | null,
): { def: RiskRuleDef; value: number }[] {
  const body = rules ?? emptyRiskRules();
  return RISK_RULE_DEFS.flatMap((def) => {
    const value = body[def.key];
    return value == null ? [] : [{ def, value }];
  });
}

export function availableRiskRules(rules?: RiskRules | null): RiskRuleDef[] {
  const body = rules ?? emptyRiskRules();
  return RISK_RULE_DEFS.filter((def) => body[def.key] == null);
}

export function setRiskRuleValue(
  rules: RiskRules | null | undefined,
  key: RiskRuleKey,
  value: number | null,
): RiskRules {
  return { ...(rules ?? emptyRiskRules()), [key]: value };
}

export function formatRiskRuleValue(def: RiskRuleDef, value: number): string {
  if (def.unit === 'count') {
    return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }
  const num = value.toLocaleString('en-US', { maximumFractionDigits: 2 });
  return def.unit === '%' ? `${num}%` : `$${num}`;
}

/** Returns an error message, or undefined when `raw` parses as a valid value. */
export function validateRiskRuleValue(def: RiskRuleDef, raw: string): string | undefined {
  const trimmed = raw.trim().replace(/,/g, '');
  if (!trimmed) return t`Enter a value.`;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0) return t`Enter a valid number.`;
  if (def.unit === '%' && value > 100) return t`Percent must be between 0 and 100.`;
  if (def.unit === 'count' && !Number.isInteger(value)) {
    return t`Enter a whole number of trades.`;
  }
  return undefined;
}

export function parseRiskRuleValue(raw: string): number {
  return Number(raw.trim().replace(/,/g, ''));
}
