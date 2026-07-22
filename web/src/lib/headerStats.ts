import type { Account, CashTransaction, Summary, Trade } from "./api/types";

export interface HeaderStats {
  netPnl: number;
  cash: number;
  active: number;
}

// Header account block: net P&L for the current filter scope, an estimated
// cash balance (cash ledger + realized P&L), and the entry value of open
// positions ("Active"). Opening balance is seeded as the first deposit.
export function computeHeaderStats(opts: {
  accounts: Account[];
  accountId?: string;
  cashTx: CashTransaction[];
  summary?: Summary;
  trades: Trade[];
}): HeaderStats {
  const accounts = opts.accountId
    ? opts.accounts.filter((a) => a.id === opts.accountId)
    : opts.accounts;
  const accountIds = new Set(accounts.map((a) => a.id));
  const cashFlow = opts.cashTx
    .filter((c) => accountIds.has(c.account_id))
    .reduce((s, c) => s + c.amount, 0);
  const netPnl = opts.summary?.net_pnl ?? 0;
  const active = opts.trades
    .filter((t) => t.status === "open")
    .reduce((s, t) => {
      const qty = t.qty_remaining > 0 ? t.qty_remaining : t.qty_opened;
      return s + qty * t.avg_entry_price;
    }, 0);
  return { netPnl, cash: cashFlow + netPnl, active };
}
