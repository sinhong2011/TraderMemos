/**
 * Starter files handed out by the import screen, mirroring the downloads the
 * web Import page serves from `web/public/sample-fill-import.csv` and
 * `web/public/sample-json-import.json`. The phone has no static asset host, so
 * the content is inlined here and written to the cache before sharing — keep
 * both copies in step when the import contract changes.
 */

export const SAMPLE_CSV_NAME = 'sample-fill-import.csv';
export const SAMPLE_JSON_NAME = 'sample-json-import.json';

export const SAMPLE_CSV = `Symbol,B/S,Qty,Fill Price,Trade Date,Commission
AAPL,BUY,100,195.00,2026-01-02T10:00:00Z,1.00
AAPL,SELL,100,198.50,2026-01-02T15:30:00Z,1.00
`;

export const SAMPLE_JSON = JSON.stringify(
  {
    format_version: 1,
    exported_at: '2026-01-02T16:00:00Z',
    account: {
      name: 'Sample Account',
      broker: 'IBKR',
      account_type: 'cash',
      base_currency: 'USD',
      starting_balance: 10000,
    },
    cash_transactions: [
      {
        type: 'deposit',
        amount: 10000,
        currency: 'USD',
        occurred_at: '2026-01-01T12:00:00Z',
        note: 'Opening balance',
      },
    ],
    trade_count: 1,
    trades: [
      {
        symbol: 'AAPL',
        instrument_type: 'stock',
        direction: 'long',
        status: 'closed',
        opened_at: '2026-01-02T10:00:00Z',
        closed_at: '2026-01-02T15:30:00Z',
        qty_opened: 100,
        qty_remaining: 0,
        avg_entry_price: 195,
        avg_exit_price: 198.5,
        gross_pnl: 350,
        fees_total: 2,
        net_pnl: 348,
        pnl_currency: 'USD',
        return_pct: 1.79,
        notes: 'Sample closed round-trip',
        tags: ['sample'],
        fills: [
          {
            symbol: 'AAPL',
            side: 'buy',
            quantity: 100,
            price: 195,
            fees: 0,
            commission: 1,
            executed_at: '2026-01-02T10:00:00Z',
            instrument_type: 'stock',
            multiplier: 1,
          },
          {
            symbol: 'AAPL',
            side: 'sell',
            quantity: 100,
            price: 198.5,
            fees: 0,
            commission: 1,
            executed_at: '2026-01-02T15:30:00Z',
            instrument_type: 'stock',
            multiplier: 1,
          },
        ],
      },
    ],
  },
  null,
  2,
);
