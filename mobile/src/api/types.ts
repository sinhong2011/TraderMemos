/**
 * Wire types for the TraderMemos Go API.
 *
 * Hand-written rather than generated: `api/openapi/openapi.yaml` types the analytics
 * endpoints as `additionalProperties: true` and has no Trade schema, so codegen from
 * it would produce `unknown`. These mirror the Go source instead:
 *   - Trade      -> api/internal/api/dto.go   (tradeDTO)
 *   - Summary    -> api/internal/analytics/analytics.go
 *   - EquityCurve-> api/internal/analytics/analytics.go
 * Keep them in sync when those structs change.
 */

export type TokenPair = {
  access_token: string;
  refresh_token: string;
};

export type Credentials = {
  /**
   * Wire field is `email` (api/internal/api/auth_handlers.go), but the product
   * treats it as a username — the web login labels it "Username" too.
   */
  email: string;
  /** Server enforces minLength 10. */
  password: string;
};

export type Tag = {
  id: string;
  user_id: string;
  name: string;
  color: string;
  description: string;
  kind: string;
};

export type TradeDirection = 'long' | 'short';
export type TradeStatus = 'open' | 'closed';

export type Trade = {
  id: string;
  account_id: string;
  symbol: string;
  instrument_type: string;
  direction: TradeDirection;
  status: TradeStatus;
  opened_at: string;
  closed_at: string | null;
  qty_opened: number;
  qty_remaining: number;
  avg_entry_price: number;
  avg_exit_price: number | null;
  gross_pnl: number | null;
  fees_total: number;
  net_pnl: number | null;
  pnl_currency: string;
  return_pct: number | null;
  time_in_trade_secs: number | null;
  notes: string;
  tags: Tag[];
  initial_risk?: number;
};

export type Summary = {
  total_trades: number;
  wins: number;
  losses: number;
  breakeven: number;
  win_rate: number;
  net_pnl: number;
  gross_profit: number;
  gross_loss: number;
  profit_factor: number;
  expectancy: number;
  avg_win: number;
  avg_loss: number;
  avg_trade: number;
  largest_win: number;
  largest_loss: number;
  total_fees: number;
};

export type EquityPoint = {
  at: string;
  equity: number;
};

export type EquityCurve = {
  points: EquityPoint[];
  max_drawdown: number;
};

/** One group from GET /analytics/breakdown?by=… (analytics.BreakGroup). */
export type BreakGroup = {
  key: string;
  summary: Summary;
};

/** Daily net P&L keyed "YYYY-MM-DD" (analytics.DailyPnl). */
export type DailyPnl = Record<string, number>;

/** GET /settings/annual-goal — `amount` is null when no goal is set for the year. */
export type AnnualGoal = {
  year: number;
  amount: number | null;
};

export type Account = {
  id: string;
  name: string;
  broker: string;
  account_type: string;
  base_currency: string;
  starting_balance: number;
};

/** Shared query filters accepted by the trades and analytics endpoints. */
export type Filters = {
  account_id?: string;
  /** RFC3339 */
  from?: string;
  /** RFC3339 */
  to?: string;
};
