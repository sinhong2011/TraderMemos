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

/** One cash ledger entry (api dto) — amount is signed; outflows are negative. */
export type CashTransaction = {
  id: string;
  user_id: string;
  account_id: string;
  type: string;
  amount: number;
  currency: string;
  occurred_at: string;
  note: string;
  trade_id: string | null;
  import_batch_id?: string | null;
  created_at: string;
};

/** GET/PUT /settings/checklist-template — `items` are the parsed `- [ ]` lines. */
export type ChecklistTemplate = {
  items: string[];
  content?: string;
};

export type Account = {
  id: string;
  name: string;
  broker: string;
  account_type: string;
  base_currency: string;
  starting_balance: number;
};

/** GET /settings/ocr | /settings/coach (web llmApiSettings.ts). */
export type LlmApiSettings = {
  enabled: boolean;
  base_url: string;
  model: string;
  custom_prompt: string;
  default_prompt?: string;
  api_key_set: boolean;
  api_key_hint?: string;
};

/** POST /settings/{ocr,coach}/test result. */
export type LlmApiTestResult = {
  ok: boolean;
  error?: string;
};

/** GET /access-tokens row; POST additionally returns the one-time `token`. */
export type AccessToken = {
  id: string;
  name: string;
  token_prefix: string;
  created_at: string;
  expires_at: string | null;
  last_used_at: string | null;
};

export type CreatedAccessToken = AccessToken & { token: string };

/** GET /healthz (unauthenticated, at the server root — not under /api/v1). */
export type ApiHealth = {
  status: string;
  version?: string;
  commit?: string;
  go?: string;
};

/** Shared query filters accepted by the trades and analytics endpoints. */
export type Filters = {
  account_id?: string;
  /** RFC3339 */
  from?: string;
  /** RFC3339 */
  to?: string;
};

/** Per-row failure reported by import preview/commit. */
export type RowError = {
  row: number;
  message: string;
};

/** Closed-trade row synthesized from a journal CSV/JSON by POST /imports. */
export type JournalTradePreview = {
  row: number;
  symbol: string;
  market: string;
  instrument_type?: string;
  option_right?: string;
  side: string;
  status?: string;
  qty: number;
  entry: number;
  exit: number;
  return_usd: number;
  return_pct?: number;
  open_date: string;
  close_date: string;
  tags?: string;
  setup?: string;
  notes?: string;
};

/** Aggregate stats for a journal-format upload. */
export type JournalPreviewSummary = {
  row_count: number;
  trade_count: number;
  execution_count: number;
  net_pnl: number;
  stock_trades: number;
  option_trades: number;
  error_count: number;
};

/** Account metadata embedded in a JSON export — created only on confirm. */
export type PendingImportAccount = {
  name: string;
  broker?: string;
  account_type?: string;
  base_currency?: string;
  starting_balance?: number;
};

/** Response from POST /imports (parse-only preview; nothing is written). */
export type ImportPreview = {
  /** Always empty — the batch is created on confirm only. */
  import_batch_id: string;
  /** Matched/selected account, or empty when pending_account is set. */
  account_id?: string;
  /** Proposed new account from JSON metadata. */
  pending_account?: PendingImportAccount;
  headers: string[];
  sample_rows: Record<string, string>[];
  suggested_mapping: Record<string, string>;
  /** Broker preset name when the header signature matched (e.g. "Webull (Orders)"). */
  detected_broker?: string;
  /** "journal_trades" = closed-trade journal; "executions" = fill rows; "account_backup" = JSON meta only. */
  format?: 'journal_trades' | 'executions' | 'account_backup';
  source?: 'csv' | 'json';
  row_count?: number;
  journal_summary?: JournalPreviewSummary;
  sample_trades?: JournalTradePreview[];
};

/** Response from POST /imports/commit. */
export type ImportResult = {
  inserted: number;
  skipped: number;
  annotated?: number;
  /** Journal imports: closed round-trip count (fills = inserted). */
  trades?: number;
  cash_inserted?: number;
  setups_upserted?: number;
  format?: string;
  account_id?: string;
  errors: RowError[];
};

/** GET /exports formats — json/zip are the canonical backup, csv is the closed-trade journal. */
export type ExportFormat = 'json' | 'csv' | 'zip';

/** One fill row inside a POST /ocr/parse extract (web api/ocr.ts). */
export type ExtractedFill = {
  symbol?: string;
  side: string;
  quantity: number;
  price: number;
  fees: number;
  commission: number;
  /** Broker on-screen wall-clock time — the offset the model appends is fiction. */
  executed_at: string;
  option_right?: string;
  strike?: number;
  expiry?: string;
};

/** Response from POST /ocr/parse (vision scan of a broker screenshot). */
export type TradeExtract = {
  symbol: string;
  instrument_type: string;
  side: string;
  confidence: number;
  raw_text: string;
  rows: ExtractedFill[];
  warnings: string[];
  /** Present when a scan contains more than one underlying. */
  symbols?: string[];
};
