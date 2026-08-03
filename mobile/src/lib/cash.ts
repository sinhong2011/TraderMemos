/**
 * Cash-ledger helpers shared by the funding screens.
 *
 * Mirrors web/src/lib/cashAmount.ts: the ledger stores signed amounts
 * (withdrawals/fees negative), the forms collect absolute values.
 */
import { t } from '@lingui/core/macro';

/** Wire values accepted by POST/PUT /cash-transactions, with localized labels. */
export const CASH_TYPES = [
  { value: 'deposit', label: () => t`Deposit` },
  { value: 'withdrawal', label: () => t`Withdrawal` },
  { value: 'fee', label: () => t`Fee` },
  { value: 'dividend', label: () => t`Dividend` },
  { value: 'interest', label: () => t`Interest` },
  { value: 'adjustment', label: () => t`Adjustment` },
] as const;

export function cashTypeLabel(type: string): string {
  return CASH_TYPES.find((option) => option.value === type)?.label() ?? type;
}

/** Signed cash amount for ledger storage (withdrawals/fees negative). */
export function signedCashAmount(type: string, amount: number): number {
  const abs = Math.abs(amount);
  switch (type) {
    case 'withdrawal':
    case 'fee':
      return -abs;
    case 'adjustment':
      return amount;
    default:
      return abs;
  }
}

/** Ledger sum for one account — the funded equity base (web ledgerBalance). */
export function ledgerBalance(
  accountId: string,
  transactions: { account_id: string; amount: number }[],
): number {
  return transactions
    .filter((tx) => tx.account_id === accountId)
    .reduce((sum, tx) => sum + tx.amount, 0);
}
