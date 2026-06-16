-- name: UpsertInstrumentSpec :exec
INSERT INTO instrument_specs (id, symbol_root, instrument_type, tick_size, tick_value, multiplier, currency)
VALUES (?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(symbol_root, instrument_type) DO UPDATE SET
    tick_size = excluded.tick_size, tick_value = excluded.tick_value,
    multiplier = excluded.multiplier, currency = excluded.currency;

-- name: GetInstrumentSpec :one
SELECT * FROM instrument_specs WHERE symbol_root = ? AND instrument_type = ?;
