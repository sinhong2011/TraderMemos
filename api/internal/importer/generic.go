package importer

import (
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"
	"time"
)

type Generic struct {
	mapping map[string]string // canonicalField -> header
}

func NewGeneric(mapping map[string]string) *Generic {
	return &Generic{mapping: mapping}
}

func (g *Generic) Name() string           { return "generic" }
func (g *Generic) Detect(_ []string) bool { return true } // fallback importer

// Order-status values that mean "this row is not a fill". Broker order
// exports (Webull, Schwab) mix cancelled/working orders into the same file.
var skipStatuses = map[string]bool{
	"cancelled": true, "canceled": true, "rejected": true,
	"failed": true, "working": true, "pending": true, "expired": true,
}

func (g *Generic) ParseRows(rows []map[string]string) ParseResult {
	var res ParseResult
	for i, row := range rows {
		if rowHasSkipStatus(row) {
			continue
		}
		ex, err := g.parseRow(row)
		if err != nil {
			res.Errors = append(res.Errors, RowError{Row: i + 1, Message: err.Error()})
			continue
		}
		res.Executions = append(res.Executions, ex)
	}
	return res
}

func rowHasSkipStatus(row map[string]string) bool {
	for h, v := range row {
		if strings.EqualFold(strings.TrimSpace(h), "status") {
			return skipStatuses[strings.ToLower(strings.TrimSpace(v))]
		}
	}
	return false
}

// col resolves a canonical field. A mapping value prefixed with "=" is a
// constant (broker presets use this, e.g. instrument_type -> "=future").
func (g *Generic) col(row map[string]string, field string) string {
	h := g.mapping[field]
	if strings.HasPrefix(h, "=") {
		return strings.TrimPrefix(h, "=")
	}
	return strings.TrimSpace(row[h])
}

// ParseSideToken normalizes broker side vocabulary: BOT/SLD (IBKR/ToS),
// Buy to Open / Sell to Close (options), Short (Webull), BTO/STC etc.
func ParseSideToken(raw string) string {
	s := strings.ToLower(strings.TrimSpace(raw))
	switch s {
	case "buy", "b", "bot", "bto", "btc", "cover", "buy to open", "buy to close", "buy to cover":
		return "buy"
	case "sell", "s", "sld", "sto", "stc", "short", "sell short",
		"sell to open", "sell to close":
		return "sell"
	}
	switch {
	case strings.HasPrefix(s, "buy"), strings.HasPrefix(s, "bot"):
		return "buy"
	case strings.HasPrefix(s, "sell"), strings.HasPrefix(s, "sold"), strings.HasPrefix(s, "sld"),
		strings.HasPrefix(s, "short"):
		return "sell"
	}
	return ""
}

func (g *Generic) parseRow(row map[string]string) (ParsedExecution, error) {
	var p ParsedExecution
	p.Symbol = g.col(row, "symbol")
	if p.Symbol == "" {
		return p, fmt.Errorf("missing symbol")
	}
	p.Side = ParseSideToken(g.col(row, "side"))
	if p.Side == "" {
		return p, fmt.Errorf("invalid side %q", g.col(row, "side"))
	}
	qty, err := strconv.ParseFloat(strings.ReplaceAll(g.col(row, "quantity"), ",", ""), 64)
	if err != nil {
		return p, fmt.Errorf("invalid quantity")
	}
	// Some brokers (IBKR, ThinkOrSwim) sign the quantity instead of, or as
	// well as, the side column; the side column is authoritative here.
	p.Quantity = math.Abs(qty)
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
	// Costs are stored as positive magnitudes: brokers disagree on sign
	// (IBKR reports IBCommission negative), and the P&L engine subtracts
	// fees_total from gross either way.
	if c := g.col(row, "commission"); c != "" {
		v, _ := strconv.ParseFloat(c, 64)
		p.Commission = math.Abs(v)
	}
	if f := g.col(row, "fees"); f != "" {
		v, _ := strconv.ParseFloat(f, 64)
		p.Fees = math.Abs(v)
	}
	p.InstrumentType = ParseInstrumentType(g.col(row, "instrument_type"), p.Symbol)
	if p.InstrumentType == "option" {
		p.OptionRight = ParseOptionRight(g.col(row, "option_right"))
		if p.OptionRight == "" {
			p.OptionRight = InferOptionRight(p.Symbol)
		}
	}
	if m := g.col(row, "multiplier"); m != "" {
		if v, err := strconv.ParseFloat(m, 64); err == nil && v > 0 {
			p.Multiplier = v
		}
	}
	// Futures stay 0 so Commit can resolve the contract multiplier from
	// instrument_specs (ES → 50); other types take the conventional default.
	if p.Multiplier == 0 && p.InstrumentType != "future" {
		p.Multiplier = DefaultMultiplier(p.InstrumentType)
	}
	return p, nil
}

// US timezone abbreviations brokers stamp on export times (Webull "EDT").
// Fixed offsets keep parsing deterministic.
var usTzOffsets = map[string]int{
	"EDT": -4 * 3600, "EST": -5 * 3600,
	"CDT": -5 * 3600, "CST": -6 * 3600,
	"MDT": -6 * 3600, "MST": -7 * 3600,
	"PDT": -7 * 3600, "PST": -8 * 3600,
}

var trailingTzAbbrev = regexp.MustCompile(`\s+([A-Z]{2,4})$`)

func parseTime(s string) (time.Time, error) {
	s = strings.TrimSpace(s)
	loc := time.UTC
	if m := trailingTzAbbrev.FindStringSubmatch(s); m != nil {
		if off, ok := usTzOffsets[m[1]]; ok {
			loc = time.FixedZone(m[1], off)
			s = strings.TrimSpace(strings.TrimSuffix(s, m[0]))
		}
	}
	layouts := []string{
		time.RFC3339Nano,
		time.RFC3339,
		"2006-01-02 15:04:05",
		"2006-01-02T15:04:05",
		"2006-01-02T15:04:05.000Z",
		"01/02/2006 15:04:05",
		"1/2/2006 15:04:05",
		"1/2/06 15:04:05",
		"01/02/2006 15:04",
		"1/2/2006 15:04",
		"20060102;150405", // IBKR Flex DateTime
		"2006-01-02 15:04",
		"01/02/2006",
		"2006-01-02",
	}
	for _, l := range layouts {
		if t, err := time.ParseInLocation(l, s, loc); err == nil {
			return t.UTC(), nil
		}
	}
	return time.Time{}, fmt.Errorf("unrecognized time")
}
