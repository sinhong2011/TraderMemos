package store

import (
	"context"

	"github.com/google/uuid"
)

type specSeed struct {
	root, itype       string
	tickSize, tickVal float64
	mult              float64
}

var futuresSeed = []specSeed{
	// CME equity index
	{"ES", "future", 0.25, 12.50, 50},
	{"MES", "future", 0.25, 1.25, 5},
	{"NQ", "future", 0.25, 5.00, 20},
	{"MNQ", "future", 0.25, 0.50, 2},
	{"RTY", "future", 0.10, 5.00, 50},
	{"M2K", "future", 0.10, 0.50, 5},
	// CBOT equity index
	{"YM", "future", 1.00, 5.00, 5},
	{"MYM", "future", 1.00, 0.50, 0.5},
	// NYMEX energy
	{"CL", "future", 0.01, 10.00, 1000},
	{"MCL", "future", 0.01, 1.00, 100},
	{"QM", "future", 0.025, 12.50, 500},
	{"NG", "future", 0.001, 10.00, 10000},
	// COMEX metals
	{"GC", "future", 0.10, 10.00, 100},
	{"MGC", "future", 0.10, 1.00, 10},
	{"SI", "future", 0.005, 25.00, 5000},
	{"HG", "future", 0.0005, 12.50, 25000},
	// CBOT rates
	{"ZB", "future", 0.03125, 31.25, 1000},
	{"ZN", "future", 0.015625, 15.625, 1000},
	// CME FX
	{"6E", "future", 0.00005, 6.25, 125000},
	{"6B", "future", 0.0001, 6.25, 62500},
}

// SeedInstrumentSpecs upserts the common futures contract specs.
func SeedInstrumentSpecs(ctx context.Context, q Querier) error {
	for _, s := range futuresSeed {
		err := q.UpsertInstrumentSpec(ctx, UpsertInstrumentSpecParams{
			ID: uuid.NewString(), SymbolRoot: s.root, InstrumentType: s.itype,
			TickSize: s.tickSize, TickValue: s.tickVal, Multiplier: s.mult, Currency: "USD",
		})
		if err != nil {
			return err
		}
	}
	return nil
}
