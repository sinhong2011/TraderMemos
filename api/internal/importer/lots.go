package importer

import "strings"

// ISO codes accepted as halves of a 6-letter FX pair symbol (EURUSD, GBPJPY).
var fxCurrencyCodes = map[string]bool{
	"USD": true, "EUR": true, "GBP": true, "JPY": true, "CHF": true,
	"AUD": true, "NZD": true, "CAD": true, "SEK": true, "NOK": true,
	"DKK": true, "PLN": true, "CZK": true, "HUF": true, "TRY": true,
	"ZAR": true, "MXN": true, "SGD": true, "HKD": true, "CNH": true,
	"CNY": true, "THB": true, "ILS": true,
}

// LotContractSize returns the units behind 1.0 lot on lot-denominated FX/CFD
// platforms (cTrader, DXtrade, Match-Trader): the standard 100k for currency
// pairs, exchange convention for spot metals, 1 for index/crypto CFDs whose
// price already is the contract value. The MT4/MT5 statement parsers (roadmap
// wave 2) share this.
func LotContractSize(symbol string) float64 {
	s := strings.ToUpper(strings.TrimSpace(symbol))
	s = strings.NewReplacer("/", "", "-", "", "_", "", " ", "").Replace(s)
	// Broker suffixes: EURUSD.r, XAUUSDm — trim anything after a dot.
	if i := strings.IndexByte(s, '.'); i > 0 {
		s = s[:i]
	}
	switch {
	case strings.HasPrefix(s, "XAU"), strings.HasPrefix(s, "XPT"), strings.HasPrefix(s, "XPD"):
		return 100
	case strings.HasPrefix(s, "XAG"):
		return 5000
	}
	if len(s) == 6 && fxCurrencyCodes[s[:3]] && fxCurrencyCodes[s[3:]] {
		return 100_000
	}
	return 1
}
