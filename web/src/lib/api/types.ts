// API DTO types matching the server's snake_case JSON output exactly.

export interface Filters {
  account_id?: string;
  from?: string;
  to?: string;
  symbol?: string;
  status?: string;
}

export interface Tokens {
  access_token: string;
  refresh_token: string;
}

export interface Account {
  id: string;
  user_id: string;
  name: string;
  broker: string;
  account_type: string;
  base_currency: string;
  starting_balance: number;
  created_at: string;
}

export interface Tag {
  id: string;
  user_id: string;
  name: string;
  color: string;
  description: string;
  kind: string;
}

export interface Setup {
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
}

export interface Execution {
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
  details: string | null;
  import_batch_id: string | null;
  dedup_hash: string;
  created_at: string;
}

export interface TradeAttachment {
  id: string;
  user_id: string;
  trade_id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  storage_key: string;
  created_at: string;
}

// Trade matches tradeDTO from api/internal/api/dto.go
export interface Trade {
  id: string;
  account_id: string;
  symbol: string;
  instrument_type: string;
  direction: string;
  status: string;
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
}

// TradeDetail matches tradeDetailDTO from api/internal/api/trade_detail.go
export interface TradeDetail extends Trade {
  fills: Execution[];
  setup: Setup | null;
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
}

// Summary matches analytics.Summary from api/internal/analytics/analytics.go
export interface Summary {
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
}

export interface RBucket {
  label: string;
  count: number;
  from: number;
  to: number;
}

/** R-mode summary — dollar fields are in R units when from /analytics/r-summary. */
export interface RSummary extends Summary {
  excluded: number;
  avg_r: number;
  avg_win_r: number;
  avg_loss_r: number;
  best_r: number;
  worst_r: number;
  distribution: RBucket[];
}

// EquityPoint and EquityCurve match analytics.Equity from analytics/analytics.go
export interface EquityPoint {
  at: string;
  equity: number;
}
export interface EquityCurve {
  points: EquityPoint[];
  max_drawdown: number;
}

// BreakGroup matches analytics.BreakGroup from analytics/breakdown.go
export interface BreakGroup {
  key: string;
  summary: Summary;
}

export interface CashTransaction {
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
}

export interface JournalNote {
  id: string;
  occurred_at: string;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface ImportBatch {
  id: string;
  user_id: string;
  account_id: string;
  source: string;
  filename: string | null;
  column_mapping: string | null;
  row_count: number;
  status: string;
  created_at: string;
}

export interface RowError {
  row: number;
  message: string;
}

// ImportPreview is the response from POST /imports
export interface JournalTradePreview {
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
  entry_total?: number;
  exit_total?: number;
  return_usd: number;
  return_pct?: number;
  dividends?: number;
  open_date: string;
  close_date: string;
  tags?: string;
  setup?: string;
  confidence?: string;
  target?: string;
  stop?: string;
  notes?: string;
}

export interface JournalPreviewSummary {
  row_count: number;
  trade_count: number;
  execution_count: number;
  net_pnl: number;
  stock_trades: number;
  option_trades: number;
  error_count: number;
}

export interface ImportPreview {
  import_batch_id: string;
  headers: string[];
  sample_rows: Record<string, string>[];
  suggested_mapping: Record<string, string>;
  /** "journal_trades" for closed-trade journal CSVs; "executions" for fill CSVs */
  format?: "journal_trades" | "executions";
  row_count?: number;
  journal_summary?: JournalPreviewSummary;
  sample_trades?: JournalTradePreview[];
}

// ImportResult is the response from POST /imports/:id/commit
export interface ImportResult {
  inserted: number;
  skipped: number;
  annotated?: number;
  /** Journal imports: closed round-trip count (fills = inserted) */
  trades?: number;
  format?: string;
  errors: RowError[];
}

export interface Attachment {
  id: string;
  user_id: string;
  trade_id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  storage_key: string;
  created_at: string;
}
