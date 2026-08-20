package importer

import (
	"fmt"
	"math"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
)

type Generic struct {
	mapping map[string]string // canonicalField -> header
	// Zone offset-less timestamps are interpreted in. Broker exports rarely
	// carry an offset — a naive "Fri 16:30" from a US broker is Eastern wall
	// time, and reading it as UTC shifts every fill by 4-5h (late-Friday fills
	// even onto Saturday). Timestamps with their own offset are unaffected.
	loc *time.Location
	// Quantities are lots (FX/CFD platforms), not units/shares — resolve the
	// contract size per symbol instead of the conventional multiplier.
	lotSized bool
}

func NewGeneric(mapping map[string]string) *Generic {
	return &Generic{mapping: mapping, loc: time.UTC}
}

// WithSourceTZ sets the IANA zone for offset-less timestamps. Empty or
// unknown names keep the previous location (UTC by default).
func (g *Generic) WithSourceTZ(tz string) *Generic {
	if tz == "" {
		return g
	}
	if loc, err := time.LoadLocation(tz); err == nil {
		g.loc = loc
	}
	return g
}

// WithLotSizedQuantity marks quantities as lot-denominated (cTrader, DXtrade,
// Match-Trader), so fills without an explicit multiplier column resolve their
// contract size from the symbol (EURUSD → 100k) instead of defaulting to 1.
func (g *Generic) WithLotSizedQuantity(lots bool) *Generic {
	g.lotSized = lots
	return g
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
	roundTrip := g.roundTrip()
	for i, row := range rows {
		if rowHasSkipStatus(row) {
			continue
		}
		if roundTrip {
			exs, err := g.parseRoundTripRow(row)
			if err != nil {
				res.Errors = append(res.Errors, RowError{Row: i + 1, Message: err.Error()})
				continue
			}
			// One lot per row: overlapping same-symbol positions (FX hedging)
			// stay separate trades through Regroup, like journal imports.
			lot := uuid.NewString()
			for j := range exs {
				exs[j].LotKey = lot
			}
			res.Executions = append(res.Executions, exs...)
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

// roundTrip reports whether the mapping describes position-level rows —
// open/close pairs (cTrader, Match-Trader) — rather than one fill per row.
// Such rows synthesize an opening and a closing fill; the single-fill
// price/executed_at mappings are ignored.
func (g *Generic) roundTrip() bool {
	return g.mapping["open_time"] != "" && g.mapping["open_price"] != "" &&
		g.mapping["close_time"] != ""
}

// parseRoundTripRow synthesizes fills from a position-level row: an opening
// fill always, plus a closing fill with the side flipped when the row carries
// a close time and price (Match-Trader exports still-open positions without
// them). Commission and swap land on the last fill so the pair is costed once.
func (g *Generic) parseRoundTripRow(row map[string]string) ([]ParsedExecution, error) {
	var open ParsedExecution
	open.Symbol = g.col(row, "symbol")
	if open.Symbol == "" {
		return nil, fmt.Errorf("missing symbol")
	}
	open.Side = ParseSideToken(g.col(row, "side"))
	if open.Side == "" {
		return nil, fmt.Errorf("invalid side %q", g.col(row, "side"))
	}
	qty, err := strconv.ParseFloat(strings.ReplaceAll(g.col(row, "quantity"), ",", ""), 64)
	if err != nil || qty == 0 {
		return nil, fmt.Errorf("invalid quantity")
	}
	open.Quantity = math.Abs(qty)
	price, err := strconv.ParseFloat(g.col(row, "open_price"), 64)
	if err != nil {
		return nil, fmt.Errorf("invalid open price")
	}
	open.Price = price
	ts, err := parseTimeIn(g.col(row, "open_time"), g.loc)
	if err != nil {
		return nil, fmt.Errorf("invalid open time %q", g.col(row, "open_time"))
	}
	open.ExecutedAt = ts
	open.InstrumentType = ParseInstrumentType(g.col(row, "instrument_type"), open.Symbol)
	g.applyMultiplier(&open, row)

	commission := absFloat(g.col(row, "commission"))
	swap := absFloat(g.col(row, "swap")) + absFloat(g.col(row, "fees"))

	closePrice := g.col(row, "close_price")
	closeTime := g.col(row, "close_time")
	if closePrice == "" || closeTime == "" {
		open.Commission = commission
		open.Fees = swap
		return []ParsedExecution{open}, nil
	}
	cls := open
	cls.Side = flipSide(open.Side)
	if cls.Price, err = strconv.ParseFloat(closePrice, 64); err != nil {
		return nil, fmt.Errorf("invalid close price")
	}
	if cls.ExecutedAt, err = parseTimeIn(closeTime, g.loc); err != nil {
		return nil, fmt.Errorf("invalid close time %q", closeTime)
	}
	cls.Commission = commission
	cls.Fees = swap
	return []ParsedExecution{open, cls}, nil
}

func flipSide(side string) string {
	if side == "buy" {
		return "sell"
	}
	return "buy"
}

// absFloat parses a cost/size cell to a positive magnitude; empty or
// unparseable cells are 0.
func absFloat(s string) float64 {
	v, _ := strconv.ParseFloat(strings.ReplaceAll(strings.TrimSpace(s), ",", ""), 64)
	return math.Abs(v)
}

// applyMultiplier resolves the contract multiplier: an explicit column wins;
// lot-denominated presets resolve the contract size from the symbol; futures
// stay 0 so Commit can consult instrument_specs; everything else takes the
// conventional default.
func (g *Generic) applyMultiplier(p *ParsedExecution, row map[string]string) {
	if m := g.col(row, "multiplier"); m != "" {
		if v, err := strconv.ParseFloat(m, 64); err == nil && v > 0 {
			p.Multiplier = v
		}
	}
	// Quantities ≥1000 on a lot-sized platform are already units — some
	// DXtrade deployments export unit volume (10000), not lots (0.1).
	if p.Multiplier == 0 && g.lotSized && p.Quantity < 1000 {
		p.Multiplier = LotContractSize(p.Symbol)
	}
	if p.Multiplier == 0 && p.InstrumentType != "future" {
		p.Multiplier = DefaultMultiplier(p.InstrumentType)
	}
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
	ts, err := parseTimeIn(g.col(row, "executed_at"), g.loc)
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
	// Overnight financing on FX/CFD exports; a cost either way, like fees.
	p.Fees += absFloat(g.col(row, "swap"))
	p.InstrumentType = ParseInstrumentType(g.col(row, "instrument_type"), p.Symbol)
	if p.InstrumentType == "option" {
		p.OptionRight = ParseOptionRight(g.col(row, "option_right"))
		if p.OptionRight == "" {
			p.OptionRight = InferOptionRight(p.Symbol)
		}
		p.Strike = parseStrikeCell(g.col(row, "strike"))
		p.Expiry = parseExpiryCell(g.col(row, "expiry"))
		normalizeOCCOption(&p)
	}
	g.applyMultiplier(&p, row)
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
	return parseTimeIn(s, time.UTC)
}

// parseTimeIn parses a broker timestamp. Offset-less layouts are read in loc;
// a trailing US tz abbreviation (Webull "EDT") or an RFC3339 offset wins.
func parseTimeIn(s string, loc *time.Location) (time.Time, error) {
	s = strings.TrimSpace(s)
	if loc == nil {
		loc = time.UTC
	}
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
		"20060102;150405",     // IBKR Flex DateTime
		"2006.01.02 15:04:05", // MetaTrader-family dotted dates (cTrader, Match-Trader)
		"02.01.2006 15:04:05", // European day-first dotted
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
