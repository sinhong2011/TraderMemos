package marketdata

import (
	"strings"
	"unicode"
)

// ChartableSymbol reports whether we should attempt a market data fetch.
// Test fixtures (E2E*) and obviously invalid tickers are skipped.
func ChartableSymbol(symbol string) bool {
	s := strings.TrimSpace(symbol)
	if s == "" {
		return false
	}
	upper := strings.ToUpper(s)
	if strings.HasPrefix(upper, "E2E") {
		return false
	}
	// Require at least one letter; pure numeric placeholders are not tickers.
	hasLetter := false
	for _, r := range upper {
		if unicode.IsLetter(r) {
			hasLetter = true
			break
		}
	}
	return hasLetter
}

// EmptyResponse builds a no-data payload for symbols we skip or when upstream has none.
func EmptyResponse(req Request, provider string) Response {
	return Response{
		Symbol:   req.Symbol,
		Interval: req.Interval,
		From:     FormatTimeRFC3339(req.From),
		To:       FormatTimeRFC3339(req.To),
		Provider: provider,
		Cached:   false,
		Bars:     []Bar{},
	}
}
