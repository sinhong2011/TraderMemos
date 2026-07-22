-- Remove auto-seeded opening deposits created by the up migration.
DELETE FROM cash_transactions
WHERE type = 'deposit'
  AND note = 'Opening balance'
  AND trade_id IS NULL;
