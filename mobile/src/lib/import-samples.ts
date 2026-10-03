/**
 * Starter files handed out by the import screen, mirroring the downloads the
 * web Import page serves from `web/public/sample-fill-import.csv` and
 * `web/public/sample-json-import.json`. The phone has no static asset host, so
 * the content is inlined here and written to the cache before sharing — keep
 * both copies in step when the import contract changes.
 */

export const SAMPLE_CSV_NAME = 'sample-fill-import.csv';
export const SAMPLE_JSON_NAME = 'sample-json-import.json';

// One trade per symbol, each showing a case the importer handles: a plain
// round trip (UTC), scaling in and out, a short, an OCC option symbol bought
// and one sold to open, times written in another zone (+08:00), and a
// position still open. Every time carries its offset, so the "Timestamps
// timezone" choice can't move them.
export const SAMPLE_CSV = `Symbol,B/S,Qty,Fill Price,Trade Date,Commission,Fees
AAPL,BUY,100,195.00,2026-01-02T15:00:00Z,1.00,0.00
AAPL,SELL,100,198.50,2026-01-02T20:30:00Z,1.00,0.03
NVDA,BUY,50,180.10,2026-01-05T09:35:00-05:00,0.50,0.00
NVDA,BUY,50,179.40,2026-01-05T09:52:00-05:00,0.50,0.00
NVDA,SELL,60,182.00,2026-01-05T11:05:00-05:00,0.60,0.02
NVDA,SELL,40,183.25,2026-01-05T14:30:00-05:00,0.40,0.01
TSLA,SELL,30,260.50,2026-01-06T10:02:00-05:00,1.00,0.02
TSLA,BUY,30,255.20,2026-01-06T13:47:00-05:00,1.00,0.00
SPY 260109C00590000,BUY,2,3.40,2026-01-07T10:15:00-05:00,1.30,0.04
SPY 260109C00590000,SELL,2,4.10,2026-01-07T15:20:00-05:00,1.30,0.05
QQQ 260109P00510000,SELL,1,2.15,2026-01-07T10:40:00-05:00,0.65,0.03
QQQ 260109P00510000,BUY,1,0.95,2026-01-08T11:10:00-05:00,0.65,0.02
MSFT,BUY,20,420.00,2026-01-08T23:31:00+08:00,1.00,0.00
MSFT,SELL,20,424.80,2026-01-09T04:15:00+08:00,1.00,0.01
AMD,BUY,40,120.00,2026-01-09T09:45:00-05:00,1.00,0.00
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
