package importer

import (
	"regexp"
	"strconv"
	"strings"
	"time"
)

// OCCContract is an option contract decoded from an OCC-style symbol
// (e.g. IBKR Flex "MU 260821C01200000").
type OCCContract struct {
	Underlying string
	Right      string // call|put
	Strike     string // decimal string with no trailing zeros, e.g. "120" / "37.5"
	Expiry     string // YYYY-MM-DD
}

// Spaced ("MU 260821C01200000") or compact ("MU260821C01200000") OCC symbols:
// root, yymmdd expiry, C/P, strike in thousandths padded to 8 digits.
var occSymbolPattern = regexp.MustCompile(`^([A-Za-z][A-Za-z0-9.]{0,5})\s*(\d{6})([CPcp])(\d{8})$`)

// ParseOCCSymbol decodes an OCC-style option symbol into its contract fields.
// Returns ok=false when the symbol doesn't follow the OCC layout.
func ParseOCCSymbol(symbol string) (OCCContract, bool) {
	m := occSymbolPattern.FindStringSubmatch(strings.TrimSpace(symbol))
	if m == nil {
		return OCCContract{}, false
	}
	expiry, err := time.Parse("060102", m[2])
	if err != nil {
		return OCCContract{}, false
	}
	thousandths, err := strconv.ParseInt(m[4], 10, 64)
	if err != nil || thousandths <= 0 {
		return OCCContract{}, false
	}
	right := "call"
	if strings.EqualFold(m[3], "P") {
		right = "put"
	}
	return OCCContract{
		Underlying: strings.ToUpper(m[1]),
		Right:      right,
		Strike:     strconv.FormatFloat(float64(thousandths)/1000, 'f', -1, 64),
		Expiry:     expiry.Format("2006-01-02"),
	}, true
}

// normalizeOptionContract rewrites a broker option symbol into the canonical
// shape used by manual entry and OCR: symbol = underlying, contract in details.
// OCC (IBKR Flex) and Schwab Transactions ("DJT 05/30/2025 22.50 C") both land here.
func normalizeOptionContract(p *ParsedExecution) {
	if p.InstrumentType != "option" {
		return
	}
	c, ok := ParseOCCSymbol(p.Symbol)
	if !ok {
		c, ok = ParseSchwabOptionSymbol(p.Symbol)
	}
	if !ok {
		return
	}
	p.Symbol = c.Underlying
	if p.OptionRight == "" {
		p.OptionRight = c.Right
	}
	if p.Strike == "" {
		p.Strike = c.Strike
	}
	if p.Expiry == "" {
		p.Expiry = c.Expiry
	}
}

// ParseSchwabOptionSymbol decodes Charles Schwab Transactions symbols:
// "DJT 05/30/2025 22.50 C" or "DJT 05 30 2025 22.50 C" (and CALL/PUT words).
func ParseSchwabOptionSymbol(symbol string) (OCCContract, bool) {
	parts := strings.Fields(strings.TrimSpace(symbol))
	if len(parts) < 3 {
		return OCCContract{}, false
	}
	leg := parts[len(parts)-1]
	strikeTok := parts[len(parts)-2]
	right := schwabRightToken(leg, strikeTok)
	if right == "" && (strings.EqualFold(leg, "call") || strings.EqualFold(leg, "put")) {
		if v, err := strconv.ParseFloat(strings.TrimPrefix(strings.TrimSpace(strikeTok), "$"), 64); err == nil && v > 0 {
			right = "call"
			if strings.EqualFold(leg, "put") {
				right = "put"
			}
		}
	}
	if right == "" {
		return OCCContract{}, false
	}
	strike := parseStrikeCell(strikeTok)
	if strike == "" {
		return OCCContract{}, false
	}
	rest := parts[:len(parts)-2]
	if len(rest) >= 2 {
		if expiry, ok := parseSchwabExpiry(rest[len(rest)-1]); ok {
			underlying := strings.ToUpper(strings.Join(rest[:len(rest)-1], ""))
			if underlying == "" {
				return OCCContract{}, false
			}
			return OCCContract{Underlying: underlying, Right: right, Strike: strike, Expiry: expiry}, true
		}
	}
	if len(rest) >= 4 {
		joined := rest[len(rest)-3] + " " + rest[len(rest)-2] + " " + rest[len(rest)-1]
		if expiry, ok := parseSchwabExpiry(joined); ok {
			underlying := strings.ToUpper(strings.Join(rest[:len(rest)-3], ""))
			if underlying == "" {
				return OCCContract{}, false
			}
			return OCCContract{Underlying: underlying, Right: right, Strike: strike, Expiry: expiry}, true
		}
	}
	return OCCContract{}, false
}

func parseSchwabExpiry(raw string) (string, bool) {
	raw = strings.TrimSpace(raw)
	for _, layout := range []string{"01/02/2006", "1/2/2006", "01 02 2006", "1 2 2006"} {
		if t, err := time.Parse(layout, raw); err == nil {
			return t.Format("2006-01-02"), true
		}
	}
	return "", false
}

// parseStrikeCell normalizes a broker strike cell to a bare decimal string.
func parseStrikeCell(raw string) string {
	raw = strings.TrimSpace(strings.ReplaceAll(raw, ",", ""))
	if raw == "" {
		return ""
	}
	v, err := strconv.ParseFloat(raw, 64)
	if err != nil || v <= 0 {
		return ""
	}
	return strconv.FormatFloat(v, 'f', -1, 64)
}

// expiryCellLayouts covers broker expiry columns (IBKR Flex uses yyyyMMdd).
var expiryCellLayouts = []string{"20060102", "2006-01-02", "01/02/2006", "060102"}

// parseExpiryCell normalizes a broker expiry cell to YYYY-MM-DD.
func parseExpiryCell(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	for _, layout := range expiryCellLayouts {
		if t, err := time.Parse(layout, raw); err == nil {
			return t.Format("2006-01-02")
		}
	}
	return ""
}

// OptionDedupSymbol widens the dedup key with the contract for options: with
// the contract moved out of the symbol, "MU" alone could collide across
// strikes filled at the same time/price/quantity.
//
// Every write path must agree on this key. Manual entry, OCR and broker
// imports all store an option as underlying + contract details, so a fill
// logged by hand and the same fill arriving from a broker sync have to hash
// identically or they land as two rows for one trade.
func OptionDedupSymbol(symbol, instrumentType, right, strike, expiry string) string {
	if instrumentType == "option" && (strike != "" || expiry != "") {
		return symbol + "|" + right + "|" + strike + "|" + expiry
	}
	return symbol
}

// OptionDedupSymbolFromDetails is OptionDedupSymbol for a stored execution,
// whose contract lives in the decoded `details` JSON rather than in fields.
func OptionDedupSymbolFromDetails(symbol, instrumentType string, details map[string]string) string {
	return OptionDedupSymbol(
		symbol, instrumentType, details["option_right"], details["strike"], details["expiry"],
	)
}

func dedupSymbol(p ParsedExecution) string {
	return OptionDedupSymbol(p.Symbol, p.InstrumentType, p.OptionRight, p.Strike, p.Expiry)
}
