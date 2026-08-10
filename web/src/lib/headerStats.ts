import type { Account, CashTransaction, Summary, Trade } from "./api/types";

export interface HeaderStats {
  netPnl: number;
  /** Net P&L as a ratio of deposited capital; `null` when nothing is funded. */
  netPnlPct: number | null;
  cash: number;
  active: number;
}

/** Accounts in the portfolio scope: a single id, several ids, or all when unset. */
function scopeAccounts(accounts: Account[], ids?: string | readonly string[]): Account[] {
  const list = typeof ids === "string" ? [ids] : ids;
  return list?.length ? accounts.filter((a) => list.includes(a.id)) : accounts;
}

// Capital put into the scoped accounts: the cash ledger is the single source of
// truth for funding. `accounts.starting_balance` is metadata only — it is seeded
// into the ledger as the "Opening balance" deposit when an account is created,
// so summing it here as well would count that money twice.
export function netDeposits(opts: {
  accounts: Account[];
  accountIds?: string | readonly string[];
  cashTx: CashTransaction[];
}): number {
  const accountIds = new Set(scopeAccounts(opts.accounts, opts.accountIds).map((a) => a.id));
  return opts.cashTx
    .filter((c) => accountIds.has(c.account_id))
    .reduce((sum, c) => sum + c.amount, 0);
}

// Header account block: net P&L for the current filter scope, an estimated
// cash balance (cash ledger + realized P&L), and the entry value of open
// positions ("Active"). Opening balance is seeded as the first deposit.
export function computeHeaderStats(opts: {
  accounts: Account[];
  accountIds?: string | readonly string[];
  cashTx: CashTransaction[];
  summary?: Summary;
  trades: Trade[];
}): HeaderStats {
  const accountIds = new Set(scopeAccounts(opts.accounts, opts.accountIds).map((a) => a.id));
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
  // Return is measured against the capital put in (net cash flow), so it stays
  // stable as P&L moves the balance around.
  const netPnlPct = cashFlow > 0 ? netPnl / cashFlow : null;
  return { netPnl, netPnlPct, cash: cashFlow + netPnl, active };
}
