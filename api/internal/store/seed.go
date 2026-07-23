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
	{"ES", "future", 0.25, 12.50, 50},
	{"NQ", "future", 0.25, 5.00, 20},
	{"CL", "future", 0.01, 10.00, 1000},
	{"GC", "future", 0.10, 10.00, 100},
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
