package importer

import "strings"

// BrokerPreset recognizes a broker's export by its header signature and maps
// its columns onto the canonical execution fields, so the import wizard is
// pre-filled instead of guessed. Mapping values are matched case-insensitively
// against the file's headers; several candidates may back one field (first
// present wins). A candidate prefixed with "=" is a constant, not a header.
type BrokerPreset struct {
	Key  string
	Name string
	// IANA zone the broker's offset-less export times are written in.
	// Equity brokers export US Eastern; futures platforms exchange (Chicago)
	// time. Timestamps that carry their own offset/abbreviation ignore this.
	TZ string
	// All of these (lowercased) must be present for the preset to match.
	// Chosen to be distinctive enough that generic CSVs never collide.
	signature []string
	fields    map[string][]string
}

var brokerPresets = []BrokerPreset{
	{
		Key:       "ibkr",
		Name:      "Interactive Brokers (Flex/Activity)",
		TZ:        "America/New_York",
		signature: []string{"buy/sell", "tradeprice"},
		fields: map[string][]string{
			"symbol":          {"symbol"},
			"side":            {"buy/sell"},
			"quantity":        {"quantity"},
			"price":           {"tradeprice"},
			"executed_at":     {"datetime", "tradedate"},
			"commission":      {"ibcommission", "commission"},
			"instrument_type": {"assetclass", "assetcategory"},
			"option_right":    {"put/call"},
			"multiplier":      {"multiplier"},
		},
	},
	{
		Key:       "thinkorswim",
		Name:      "ThinkOrSwim (Account Trade History)",
		TZ:        "America/New_York",
		signature: []string{"exec time", "pos effect"},
		fields: map[string][]string{
			"symbol":          {"symbol"},
			"side":            {"side"},
			"quantity":        {"qty"},
			"price":           {"price"},
			"executed_at":     {"exec time"},
			"instrument_type": {"type"},
			"option_right":    {"type"},
		},
	},
	{
		Key:       "webull",
		Name:      "Webull (Orders)",
		TZ:        "America/New_York",
		signature: []string{"avg price", "placed time"},
		fields: map[string][]string{
			"symbol":      {"symbol"},
			"side":        {"side"},
			"quantity":    {"filled", "filled qty", "total qty"},
			"price":       {"avg price", "price"},
			"executed_at": {"filled time", "placed time"},
		},
	},
	{
		Key:       "schwab",
		Name:      "Charles Schwab (Transactions)",
		TZ:        "America/New_York",
		signature: []string{"fees & comm", "action"},
		fields: map[string][]string{
			"symbol":      {"symbol"},
			"side":        {"action"},
			"quantity":    {"quantity"},
			"price":       {"price"},
			"executed_at": {"date"},
			"fees":        {"fees & comm"},
		},
	},
	{
		Key:       "tradovate",
		Name:      "Tradovate (Fills)",
		TZ:        "America/Chicago",
		signature: []string{"b/s", "avgprice"},
		fields: map[string][]string{
			"symbol":          {"contract"},
			"side":            {"b/s"},
			"quantity":        {"filledqty", "qty"},
			"price":           {"avgprice"},
			"executed_at":     {"fill time", "timestamp"},
			"instrument_type": {"=future"},
		},
	},
	{
		Key:       "ninjatrader",
		Name:      "NinjaTrader (Executions)",
		TZ:        "America/New_York",
		signature: []string{"instrument", "e/x"},
		fields: map[string][]string{
			"symbol":          {"instrument"},
			"side":            {"action"},
			"quantity":        {"quantity"},
			"price":           {"price"},
			"executed_at":     {"time"},
			"commission":      {"commission"},
			"instrument_type": {"=future"},
		},
	},
}

// MatchBroker returns the first preset whose full signature appears in the
// headers, with its field map resolved to the file's original header strings
// and the IANA zone its offset-less timestamps should be interpreted in.
func MatchBroker(headers []string) (name string, mapping map[string]string, tz string, ok bool) {
	byLower := make(map[string]string, len(headers))
	for _, h := range headers {
		byLower[strings.ToLower(strings.TrimSpace(h))] = h
	}
	for _, p := range brokerPresets {
		matched := true
		for _, sig := range p.signature {
			if _, present := byLower[sig]; !present {
				matched = false
				break
			}
		}
		if !matched {
			continue
		}
		m := map[string]string{}
		for field, candidates := range p.fields {
			for _, cand := range candidates {
				if strings.HasPrefix(cand, "=") {
					m[field] = cand
					break
				}
				if orig, present := byLower[cand]; present {
					m[field] = orig
					break
				}
			}
		}
		return p.Name, m, p.TZ, true
	}
	return "", nil, "", false
}
