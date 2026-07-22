-- Convert legacy accounts.starting_balance into a real opening deposit cash row
-- so the ledger is cash-transaction based. Skip accounts that already have cash.
INSERT INTO cash_transactions (
    id, user_id, account_id, type, amount, currency, occurred_at, note, created_at
)
SELECT
    lower(hex(randomblob(4))) || '-' ||
    lower(hex(randomblob(2))) || '-' ||
    '4' || substr(lower(hex(randomblob(2))), 2) || '-' ||
    substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' ||
    lower(hex(randomblob(6))),
    a.user_id,
    a.id,
    'deposit',
    a.starting_balance,
    a.base_currency,
    a.created_at,
    'Opening balance',
    CURRENT_TIMESTAMP
FROM accounts a
WHERE a.starting_balance > 0
  AND NOT EXISTS (
      SELECT 1 FROM cash_transactions c WHERE c.account_id = a.id
  );
