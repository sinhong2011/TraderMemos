package importer

import (
	"context"
	"strings"

	"github.com/tradermemos/api/internal/store"
)

// CME-style delivery month codes (F=Jan … Z=Dec).
var futuresMonthCodes = map[byte]bool{
	'F': true, 'G': true, 'H': true, 'J': true, 'K': true, 'M': true,
	'N': true, 'Q': true, 'U': true, 'V': true, 'X': true, 'Z': true,
}

// FuturesRootCandidates lists possible instrument_specs roots for a broker
// futures symbol, most specific first. Handles feed prefixes ("/ES", "@ES"),
// bare roots ("ES"), and contract codes ("ESZ5", "MGCJ24", "NQH2026").
func FuturesRootCandidates(symbol string) []string {
	s := strings.ToUpper(strings.TrimSpace(symbol))
	s = strings.TrimPrefix(s, "/")
	s = strings.TrimPrefix(s, "@")
	if i := strings.IndexAny(s, " \t"); i > 0 {
		s = s[:i]
	}
	if s == "" {
		return nil
	}
	out := []string{s}
	i := len(s)
	for i > 0 && s[i-1] >= '0' && s[i-1] <= '9' {
		i--
	}
	// month code + 1-4 year digits, with at least one root char left ("M2K" stays whole)
	if digits := len(s) - i; digits >= 1 && digits <= 4 && i > 1 && futuresMonthCodes[s[i-1]] {
		out = append(out, s[:i-1])
	}
	return out
}

// ResolveMultiplier picks the contract multiplier for a fill. An explicit
// value always wins; futures fall back to instrument_specs by symbol root
// (so ES resolves to 50 even when the CSV has no multiplier column);
// everything else uses the conventional default (option 100, otherwise 1).
func ResolveMultiplier(ctx context.Context, q store.Querier, instrumentType, symbol string, explicit float64) float64 {
	if explicit > 0 {
		return explicit
	}
	if instrumentType == "future" {
		for _, root := range FuturesRootCandidates(symbol) {
			spec, err := q.GetInstrumentSpec(ctx, store.GetInstrumentSpecParams{
				SymbolRoot: root, InstrumentType: "future",
			})
			if err == nil && spec.Multiplier > 0 {
				return spec.Multiplier
			}
		}
	}
	return DefaultMultiplier(instrumentType)
}
