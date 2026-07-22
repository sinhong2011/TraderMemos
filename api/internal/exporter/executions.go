package exporter

import (
	"encoding/csv"
	"io"
	"time"

	"github.com/tradermemos/api/internal/store"
)

var executionHeaders = []string{
	"symbol", "side", "quantity", "price", "executed_at",
	"instrument_type", "fees", "commission",
}

// WriteExecutionsCSV writes raw fills for broker-style re-import.
func WriteExecutionsCSV(w io.Writer, rows []store.Execution) error {
	cw := csv.NewWriter(w)
	if err := cw.Write(executionHeaders); err != nil {
		return err
	}
	for _, e := range rows {
		if err := cw.Write([]string{
			e.Symbol,
			e.Side,
			formatNum(e.Quantity),
			formatNum(e.Price),
			e.ExecutedAt.UTC().Format(time.RFC3339),
			e.InstrumentType,
			formatNum(e.Fees),
			formatNum(e.Commission),
		}); err != nil {
			return err
		}
	}
	cw.Flush()
	return cw.Error()
}
