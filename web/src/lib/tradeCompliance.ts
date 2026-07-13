export interface ComplianceInput {
  side: "long" | "short";
  entryPrice: number | null;
  qty: number | null;
  targetPrice: number | null;
  stopPrice: number | null;
  initialRisk: number | null;
  /** Optional risk rules from Settings. */
  rules?: RiskRulesLimits;
  /** Realized net P&L for the current calendar day (negative = loss). */
  todayNetPnl?: number | null;
  /** Sum of planned risk across other open positions. */
  openRiskTotal?: number | null;
}

export interface RiskRulesLimits {
  max_risk_per_trade?: number | null;
  max_daily_loss?: number | null;
  max_open_risk?: number | null;
}

export interface ComplianceResult {
  passed: boolean;
  issues: string[];
  warnings: string[];
}

export function checkTradeCompliance(input: ComplianceInput): ComplianceResult {
  const issues: string[] = [];
  const warnings: string[] = [];

  if (!input.entryPrice || input.entryPrice <= 0) {
    issues.push("Add at least one execution with a valid entry price.");
  }
  if (!input.qty || input.qty <= 0) {
    issues.push("Quantity must be greater than zero.");
  }

  if (input.stopPrice != null && input.entryPrice != null) {
    if (input.side === "long" && input.stopPrice >= input.entryPrice) {
      issues.push("For a long trade, stop must be below entry.");
    }
    if (input.side === "short" && input.stopPrice <= input.entryPrice) {
      issues.push("For a short trade, stop must be above entry.");
    }
  } else {
    warnings.push("No stop set — risk per trade cannot be verified.");
  }

  if (input.targetPrice != null && input.entryPrice != null) {
    if (input.side === "long" && input.targetPrice <= input.entryPrice) {
      issues.push("For a long trade, target must be above entry.");
    }
    if (input.side === "short" && input.targetPrice >= input.entryPrice) {
      issues.push("For a short trade, target must be below entry.");
    }
  }

  if (input.initialRisk != null && input.initialRisk <= 0) {
    issues.push("Initial risk must be positive when a stop is set.");
  }

  const rules = input.rules;
  const planned = input.initialRisk;

  if (rules?.max_risk_per_trade != null && planned != null) {
    if (planned > rules.max_risk_per_trade) {
      issues.push(
        `Planned risk $${planned.toFixed(2)} exceeds max risk/trade $${rules.max_risk_per_trade.toFixed(2)}.`,
      );
    }
  } else if (rules?.max_risk_per_trade != null && planned == null) {
    warnings.push("Max risk/trade is set but this trade has no planned risk (set a stop).");
  }

  if (rules?.max_daily_loss != null && input.todayNetPnl != null) {
    const lossSoFar = Math.max(0, -input.todayNetPnl);
    const projected = lossSoFar + (planned != null && planned > 0 ? planned : 0);
    if (lossSoFar >= rules.max_daily_loss) {
      issues.push(
        `Daily loss limit hit ($${lossSoFar.toFixed(2)} / $${rules.max_daily_loss.toFixed(2)}).`,
      );
    } else if (projected > rules.max_daily_loss) {
      issues.push(
        `This trade's risk would breach max daily loss ($${projected.toFixed(2)} > $${rules.max_daily_loss.toFixed(2)}).`,
      );
    }
  }

  if (rules?.max_open_risk != null && planned != null) {
    const openOther = input.openRiskTotal ?? 0;
    const total = openOther + planned;
    if (total > rules.max_open_risk) {
      issues.push(
        `Open risk $${total.toFixed(2)} would exceed max open risk $${rules.max_open_risk.toFixed(2)}.`,
      );
    }
  }

  return {
    passed: issues.length === 0,
    issues,
    warnings,
  };
}
