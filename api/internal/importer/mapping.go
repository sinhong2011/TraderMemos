package importer

import "strings"

// canonical field -> candidate header substrings (lowercased)
var fieldHints = map[string][]string{
	"symbol":      {"symbol", "ticker", "instrument"},
	"side":        {"side", "b/s", "action", "buy/sell"},
	"quantity":    {"qty", "quantity", "shares", "contracts"},
	"price":       {"fill price", "price", "avg price", "exec price"},
	"executed_at": {"trade date", "date/time", "datetime", "time", "date"},
	"fees":        {"fee", "fees"},
	"commission":      {"commission", "comm"},
	"instrument_type": {"market", "instrument type", "asset type", "sec type", "product type", "asset class"},
	"option_right":    {"call/put", "option right", "option type", "right", "cp"},
	"multiplier":      {"multiplier", "contract size", "point value"},
	// Position-level (round-trip) exports: one row carries both fills.
	"open_time":   {"open time", "opening time"},
	"open_price":  {"open price", "entry price", "opening price"},
	"close_time":  {"close time", "closing time"},
	"close_price": {"close price", "closing price", "exit price"},
	"swap":        {"swap"},
}

// SuggestMapping returns canonicalField -> originalHeader best guesses.
func SuggestMapping(headers []string) map[string]string {
	out := map[string]string{}
	for field, hints := range fieldHints {
		best := ""
		bestLen := 1 << 30
		for _, h := range headers {
			lh := strings.ToLower(strings.TrimSpace(h))
			for _, hint := range hints {
				if strings.Contains(lh, hint) && len(lh) < bestLen {
					best = h
					bestLen = len(lh)
				}
			}
		}
		if best != "" {
			out[field] = best
		}
	}
	return out
}
