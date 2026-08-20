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

// normalizeOCCOption rewrites an option execution whose symbol is a raw OCC
// string (broker imports like IBKR Flex) into the canonical shape used by
// manual entry and OCR: symbol = underlying, contract in details.
func normalizeOCCOption(p *ParsedExecution) {
	if p.InstrumentType != "option" {
		return
	}
	c, ok := ParseOCCSymbol(p.Symbol)
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
