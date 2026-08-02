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
  initial_risk?: number | null;
  /** Journal quick-filter fields on list rows (absent until the API is current). */
  setup_id?: string | null;
  emotional_state?: string;
  confidence?: number | null;
  trade_quality?: number | null;
};

/** One fill (api/internal/api/dto.go executionDTO). */
export type Execution = {
  id: string;
  user_id: string;
  account_id: string;
  external_id: string | null;
  symbol: string;
  instrument_type: string;
  side: string;
  quantity: number;
  price: number;
  fees: number;
  commission: number;
  executed_at: string;
  multiplier: number;
  /** Option contract fields: option_right, strike, expiry (and optional lot). */
  details: Record<string, string> | null;
  import_batch_id: string | null;
  dedup_hash: string;
  created_at: string;
};

export type Setup = {
  id: string;
  user_id: string;
  name: string;
  description: string;
  created_at: string;
  thesis: string;
  symbol: string;
  direction: string;
  target_price: number | null;
  stop_price: number | null;
  checklist: string[];
};

export type TradeAttachment = {
  id: string;
  user_id: string;
  trade_id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  storage_key: string;
  created_at: string;
};

/**
 * GET /trades/{id} — the enriched payload (tradeDetailDTO in
 * api/internal/api/trade_detail.go): trade plus fills, journal, and attachments.
 */
export type TradeDetail = Omit<Trade, 'initial_risk'> & {
  fills: Execution[];
  /** Main setup; additional linked setup ids are in setup_ids (first = main). */
  setup: Setup | null;
  setup_ids: string[];
  initial_risk: number | null;
  target_price: number | null;
  stop_price: number | null;
  r_multiple: number | null;
  emotional_state: string;
  confidence: number | null;
  trade_quality: number | null;
  mae: number | null;
  mfe: number | null;
  dividend_total: number;
  total_pnl: number | null;
  attachments: TradeAttachment[];
};

/** GET /market/bars (api/internal/marketdata/types.go). Wire intervals: 1|5|15|60|240|D. */
export type BarInterval = '1' | '5' | '15' | '60' | '240' | 'D';

export type MarketBar = {
  /** Unix seconds, UTC. */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type MarketBarsResponse = {
  symbol: string;
  interval: BarInterval;
  from: string;
  to: string;
  /** "yahoo" | "finnhub" | "skipped" | "unavailable" — empty bars degrade gracefully. */
  provider: string;
  cached: boolean;
  bars: MarketBar[];
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

/** GET/PUT /settings/risk-rules (riskRulesDTO) — null clears a rule. */
export type RiskRules = {
  max_risk_per_trade: number | null;
  max_daily_loss: number | null;
  max_open_risk: number | null;
  default_account_risk_pct: number | null;
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
