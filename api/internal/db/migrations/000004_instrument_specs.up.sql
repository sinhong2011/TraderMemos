CREATE TABLE instrument_specs (
    id              TEXT PRIMARY KEY,
    symbol_root     TEXT NOT NULL,
    instrument_type TEXT NOT NULL,    -- stock|option|future|forex|crypto
    tick_size       REAL NOT NULL DEFAULT 0.01,
    tick_value      REAL NOT NULL DEFAULT 0.01,
    multiplier      REAL NOT NULL DEFAULT 1,
    currency        TEXT NOT NULL DEFAULT 'USD',
    UNIQUE(symbol_root, instrument_type)
);
