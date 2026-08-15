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
  /** Second leg of sign-in, sent after the server answers `totp_required`. */
  totp_code?: string;
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
  /** call/put for option trades (from fills' contract details, OCC fallback). */
  option_right?: string | null;
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
  post_exit_mae: number | null;
  post_exit_mfe: number | null;
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
  gross_pnl: number;
  gross_profit: number;
  gross_loss: number;
  profit_factor: number;
  expectancy: number;
  avg_win: number;
  avg_loss: number;
  avg_trade: number;
  median_win: number;
  /** Positive magnitude, like avg_loss. */
  median_loss: number;
  median_trade: number;
  largest_win: number;
  largest_loss: number;
  total_fees: number;
  kelly_pct: number;
  sqn: number;
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

/** GET/PUT /settings/alerts (alertSettingsDTO) — enabled is the master switch. */
export type AlertSettings = {
  enabled: boolean;
  timezone: string;
  rule_risk: boolean;
  rule_daily_loss: boolean;
  rule_loss_streak: boolean;
  loss_streak_n: number;
  rule_prop_drawdown: boolean;
  prop_warn_pct: number;
  rule_unreviewed: boolean;
  unreviewed_days: number;
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

/** GET /access-tokens/:id/uses — newest first, capped server-side at 50. */
export type AccessTokenUse = {
  used_at: string;
  ip: string;
  /** Raw and unparsed; matching your own tooling is the point. */
  user_agent: string;
};

/** POST /me/totp/start — a candidate secret, not yet stored server-side. */
export type TotpSetup = {
  secret: string;
  otpauth_url: string;
};

/** GET /me — the signed-in account. */
export type Me = {
  id: string;
  email: string;
  is_admin: boolean;
  created_at: string;
  /** Whether an authenticator app is enrolled — see POST /me/totp/start. */
  totp_enabled: boolean;
};

/** GET /admin/users — every account on the server. Owner-only; 403 otherwise. */
export type AdminUser = Me;

/** GET /healthz (unauthenticated, at the server root — not under /api/v1). */
export type ApiHealth = {
  status: string;
  version?: string;
  commit?: string;
  go?: string;
};

/** Shared query filters accepted by the trades and analytics endpoints (parseFilters). */
export type Filters = {
  account_id?: string;
  /** RFC3339 */
  from?: string;
  /** RFC3339 */
  to?: string;
  /** Ticker, or a comma-separated list (analytics OR-match; /trades is exact). */
  symbol?: string;
  status?: TradeStatus;
  side?: TradeDirection;
  duration?: 'scalp' | 'day' | 'swing';
  /** Which timestamp attributes a trade to a day / range. Default close. */
  date_basis?: 'close' | 'open';
  /** IANA market timezone driving day/hour/weekday bucketing. */
  tz?: string;
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

// ---------------------------------------------------------------------------
// Analytics: R-summary, compliance, behavior (api/internal/analytics/*.go)
// ---------------------------------------------------------------------------

/** One bucket of the R-multiple distribution (analytics.RBucket). */
export type RBucket = {
  /** e.g. "< -2R" | "-1R to 0" | "≥ 2R" */
  label: string;
  count: number;
  from: number;
  to: number;
};

/**
 * GET /analytics/r-summary — Summary fields are promoted inline (Go embedding)
 * and are denominated in R units, not dollars.
 */
export type RSummary = Summary & {
  /** Closed trades without a knowable initial risk (no stop) — not in the stats. */
  excluded: number;
  avg_r: number;
  avg_win_r: number;
  avg_loss_r: number;
  best_r: number;
  worst_r: number;
  distribution: RBucket[];
};

/** One trading day in the compliance report (analytics.ComplianceDay). */
export type ComplianceDay = {
  /** YYYY-MM-DD in the market tz. */
  date: string;
  net_pnl: number;
  trades: number;
  risk_violations: number;
  unknown_risk: number;
  daily_loss_breach: boolean;
  compliant: boolean;
};

/** GET /analytics/compliance — rules come from /settings/risk-rules. */
export type ComplianceReport = {
  rules_configured: boolean;
  days: ComplianceDay[];
  compliant_days: number;
  breach_days: number;
  compliant_pnl: number;
  breach_pnl: number;
  risk_violations: number;
  unknown_risk: number;
  daily_loss_breaches: number;
};

/** One flagged trade in a behavior section (analytics.BehaviorEvent). */
export type BehaviorEvent = {
  /** YYYY-MM-DD in the market tz. */
  date: string;
  trade_id: string;
  symbol: string;
  trigger_trade_id?: string;
  /** "quick_reentry" | "size_escalation" */
  reason: string;
  size_ratio?: number;
  net_pnl: number;
};

/** Win/loss aggregate for flagged-vs-baseline comparison (analytics.OutcomeSplit). */
export type OutcomeSplit = {
  trades: number;
  wins: number;
  /** Fraction 0–1. */
  win_rate: number;
  net_pnl: number;
};

export type RevengeSection = {
  insufficient_data: boolean;
  events: BehaviorEvent[];
  flagged: OutcomeSplit;
  baseline: OutcomeSplit;
};

export type OverconfidenceSection = {
  insufficient_data: boolean;
  streaks: number;
  events: BehaviorEvent[];
  flagged: OutcomeSplit;
  baseline: OutcomeSplit;
};

/** A winner that peaked well above its final P&L (analytics.GiveBack). */
export type GiveBack = {
  date: string;
  trade_id: string;
  symbol: string;
  mfe: number;
  net_pnl: number;
};

export type LossAversionSection = {
  insufficient_data: boolean;
  avg_win_hold_secs: number;
  avg_loss_hold_secs: number;
  median_win_hold_secs: number;
  median_loss_hold_secs: number;
  hold_ratio: number;
  /** Max 5, sorted by MFE desc. */
  give_backs: GiveBack[];
  give_back_count: number;
  missed_profit: number;
  /** Trades without MAE/MFE, excluded from the give-back scan. */
  excluded: number;
};

/** GET /analytics/behavior (analytics.BehaviorReport). */
export type BehaviorReport = {
  trades: number;
  revenge: RevengeSection;
  overconfidence: OverconfidenceSection;
  loss_aversion: LossAversionSection;
};

// ---------------------------------------------------------------------------
// Economic events, FX (econ_handlers.go, marketdata/fx.go)
// ---------------------------------------------------------------------------

export type EconomicImpact = 'high' | 'medium' | 'low' | 'holiday';

/** GET /economic-events row (economicEventDTO). */
export type EconomicEvent = {
  id: number;
  provider: string;
  title: string;
  /** Currency code, e.g. "USD". */
  country: string;
  impact: EconomicImpact | string;
  /** RFC3339 UTC. */
  time: string;
  forecast: string;
  previous: string;
  actual: string;
};

/** GET /market/fx — 1 `from` = `rate` `to`. */
export type FxRate = {
  from: string;
  to: string;
  rate: number;
  as_of: string;
  provider: string;
  cached: boolean;
};

// ---------------------------------------------------------------------------
// Coach (coach_handlers.go, coach/generate.go)
// ---------------------------------------------------------------------------

export type CoachNoteTone = 'neg' | 'warn' | 'pos' | 'tip';

export type CoachNote = {
  id: string;
  tone: CoachNoteTone;
  headline: string;
  detail: string;
  priority: number;
};

/** POST /trades/{id}/coach (no body). */
export type CoachReview = {
  source: 'llm' | 'off' | 'error';
  notes: CoachNote[];
  /** The one concrete step to take before the next trade; absent if the model omitted it. */
  next_action?: string;
  error?: string;
  /** Set once the review is stored; absent when the write failed. */
  id?: string;
  created_at?: string;
};

/** One previously stored review, from GET /trades/:id/coach/reviews. */
export type StoredCoachReview = {
  id: string;
  notes: CoachNote[];
  next_action?: string;
  model?: string;
  created_at: string;
};

export type CoachReviewHistory = { reviews: StoredCoachReview[] };

/** POST /settings/{ocr,coach}/models result. */
export type LlmModelsResult = {
  models: string[];
  error?: string;
};

// ---------------------------------------------------------------------------
// Excursion (excursion_handlers.go)
// ---------------------------------------------------------------------------

/** POST /trades/{id}/excursion — also persists MAE/MFE into the journal. */
export type ExcursionResult = {
  mae: number;
  mfe: number;
  interval: string;
  bars_used: number;
  provider: string;
  post_exit_mae: number | null;
  post_exit_mfe: number | null;
};

// ---------------------------------------------------------------------------
// Prop mode (prop_handlers.go, prop/prop.go)
// ---------------------------------------------------------------------------

export type DrawdownMode = 'trailing' | 'eod' | 'static';

/** GET/PUT /accounts/{id}/prop-settings — null skips that rule. */
export type PropSettings = {
  profit_target: number | null;
  max_drawdown: number | null;
  drawdown_mode: DrawdownMode;
  daily_loss_limit: number | null;
  /** 0 < x <= 1. */
  consistency_pct: number | null;
};

/** Server-computed evaluation (prop.Status) — never re-derive client-side. */
export type PropStatus = {
  equity: number;
  start_balance: number;
  realized_pnl: number;
  trading_days: number;
  profit_target?: number;
  target_pct?: number;
  max_drawdown?: number;
  drawdown_mode?: DrawdownMode;
  equity_floor?: number;
  floor_distance?: number;
  drawdown_hit: boolean;
  daily_loss_hits: number;
  best_day_pnl: number;
  best_day_share?: number;
  consistency_ok?: boolean;
  target_reached: boolean;
};

/** GET /accounts/{id}/prop-status?tz=… */
export type PropStatusResponse = {
  configured: boolean;
  settings?: PropSettings;
  status?: PropStatus;
};

// ---------------------------------------------------------------------------
// IBKR Flex sync (flex_sync_handlers.go, flexsync/sync.go)
// ---------------------------------------------------------------------------

/** GET/PUT /accounts/{id}/flex-sync. Unconfigured GET = {configured:false}. */
export type FlexSyncSettings = {
  configured: boolean;
  enabled: boolean;
  query_id?: string;
  token_set: boolean;
  /** "…abcd" */
  token_hint?: string;
  /** RFC3339 */
  last_synced_at?: string;
  last_status?: string;
  last_error?: string;
};

/** PUT body — omit/empty token keeps the stored one (required on first create). */
export type FlexSyncPut = {
  query_id: string;
  enabled: boolean;
  token?: string;
};

/** POST /accounts/{id}/flex-sync/run result. */
export type FlexSyncResult = {
  inserted: number;
  skipped: number;
  trades: number;
  rows: number;
};

// ---------------------------------------------------------------------------
// Notes (notes_handlers.go)
// ---------------------------------------------------------------------------

export type NoteType = 'note' | 'daily_log';

/** Per-symbol journal block — only present on daily logs. */
export type NoteSymbol = {
  symbol: string;
  body: string;
};

/** GET /notes row (noteDTO). */
export type Note = {
  id: string;
  type: NoteType;
  /** Opaque date string as stored (not normalized by the server). */
  occurred_at: string;
  title: string;
  body: string;
  symbols: NoteSymbol[];
  created_at: string;
  updated_at: string;
};

/** POST /notes and PATCH /notes/{id} body — PATCH is a full replace. */
export type NoteBody = {
  /** Empty defaults to "note". */
  type?: NoteType;
  occurred_at: string;
  /** Empty defaults to "Untitled" / "Daily log". */
  title?: string;
  body: string;
  symbols?: NoteSymbol[];
};

// ---------------------------------------------------------------------------
// Trade patch (trade_handlers.go patchTradeReq)
// ---------------------------------------------------------------------------

/** PATCH /trades/{id} — only the provided fields change; returns TradeDetail. */
export type PatchTradeRequest = {
  notes?: string;
  setup_id?: string | null;
  setup_ids?: string[];
  initial_risk?: number | null;
  target_price?: number | null;
  stop_price?: number | null;
  emotional_state?: string;
  confidence?: number | null;
  trade_quality?: number | null;
  mae?: number | null;
  mfe?: number | null;
  tag_ids?: string[];
};

/** POST /media row (mediaDTO) — generic rich-text images, not trade attachments. */
export type MediaFile = {
  id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  created_at: string;
};

/** GET /system/info (web useSystemInfo) — feature gates ride `features`. */
export type SystemInfo = {
  version: string;
  commit?: string;
  build_time?: string;
  go: string;
  started_at: string;
  uptime_sec: number;
  db_driver?: string;
  features: Record<string, boolean>;
  /**
   * Public web-app origin for building share links (TM_PUBLIC_WEB_URL).
   * Absent when the API origin also serves the web app.
   */
  web_url?: string;
};

/** Scope snapshot baked into a public share link (share_link_handlers.go). */
export type ShareScope = {
  account_id?: string;
  from?: string;
  to?: string;
  tz?: string;
  show_amounts?: boolean;
  currency?: string;
};

/** POST/GET /share-links row — the visitor URL is `/s/{token}` on the server origin. */
export type ShareLink = {
  id: string;
  token: string;
  scope: ShareScope;
  created_at: string;
  expires_at: string | null;
  view_count: number;
};

export type CreateShareLinkBody = ShareScope & {
  /** Omit for the 90-day default; 0 = never expires. */
  expires_in_days?: number;
};
