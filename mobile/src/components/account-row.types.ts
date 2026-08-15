/** Props shared by `account-row.tsx` and `account-row.ios.tsx`. */
export interface AccountRowProps {
  name: string;
  /** "IBKR · USD · 12 trades" — the formatted meta line under the name. */
  meta: string;
  /** Formatted equity (funded base + realized P&L). */
  equity: string;
  /** Formatted, signed P&L. */
  pnl: string;
  /** The profit/loss/muted color the P&L line reads in. */
  pnlColor: string;
  onPress: () => void;
}
