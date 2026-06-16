package importer

import (
	"fmt"
	"strconv"
	"strings"
	"time"
)

type Generic struct {
	mapping        map[string]string // canonicalField -> header
	instrumentType string
}

func NewGeneric(mapping map[string]string, instrumentType string) *Generic {
	return &Generic{mapping: mapping, instrumentType: instrumentType}
}

func (g *Generic) Name() string           { return "generic" }
func (g *Generic) Detect(_ []string) bool { return true } // fallback importer

func (g *Generic) ParseRows(rows []map[string]string) ParseResult {
	var res ParseResult
	for i, row := range rows {
		ex, err := g.parseRow(row)
		if err != nil {
			res.Errors = append(res.Errors, RowError{Row: i + 1, Message: err.Error()})
			continue
		}
		res.Executions = append(res.Executions, ex)
	}
	return res
}

func (g *Generic) col(row map[string]string, field string) string {
	return strings.TrimSpace(row[g.mapping[field]])
}

func (g *Generic) parseRow(row map[string]string) (ParsedExecution, error) {
	var p ParsedExecution
	p.Symbol = g.col(row, "symbol")
	if p.Symbol == "" {
		return p, fmt.Errorf("missing symbol")
	}
	switch strings.ToLower(g.col(row, "side")) {
	case "buy", "b", "bot":
		p.Side = "buy"
	case "sell", "s", "sld":
		p.Side = "sell"
	default:
		return p, fmt.Errorf("invalid side %q", g.col(row, "side"))
	}
	qty, err := strconv.ParseFloat(g.col(row, "quantity"), 64)
	if err != nil {
		return p, fmt.Errorf("invalid quantity")
	}
	p.Quantity = qty
	price, err := strconv.ParseFloat(g.col(row, "price"), 64)
	if err != nil {
		return p, fmt.Errorf("invalid price")
	}
	p.Price = price
	ts, err := parseTime(g.col(row, "executed_at"))
	if err != nil {
		return p, fmt.Errorf("invalid date %q", g.col(row, "executed_at"))
	}
	p.ExecutedAt = ts
	if c := g.col(row, "commission"); c != "" {
		p.Commission, _ = strconv.ParseFloat(c, 64)
	}
	if f := g.col(row, "fees"); f != "" {
		p.Fees, _ = strconv.ParseFloat(f, 64)
	}
	p.InstrumentType = g.instrumentType
	return p, nil
}

func parseTime(s string) (time.Time, error) {
	layouts := []string{time.RFC3339, "2006-01-02 15:04:05", "2006-01-02T15:04:05", "01/02/2006 15:04:05", "2006-01-02"}
	for _, l := range layouts {
		if t, err := time.Parse(l, s); err == nil {
			return t.UTC(), nil
		}
	}
	return time.Time{}, fmt.Errorf("unrecognized time")
}
