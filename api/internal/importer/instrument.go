package importer

import (
	"regexp"
	"strings"
	"unicode"
)

var optionLegPattern = regexp.MustCompile(`(?i)^\d{6}[CP]\d+$`)

// InferOptionRight detects call vs put from broker symbol formats (OCC, labels).
// Returns "call", "put", or "" when unknown.
func InferOptionRight(symbol string) string {
	s := strings.TrimSpace(symbol)
	if s == "" {
		return ""
	}
	for _, part := range strings.Fields(s) {
		switch strings.ToLower(strings.TrimSpace(part)) {
		case "call":
			return "call"
		case "put":
			return "put"
		}
	}
	compact := strings.ToUpper(strings.ReplaceAll(s, " ", ""))
	if right := optionRightFromOCC(compact); right != "" {
		return right
	}
	parts := strings.Fields(s)
	if len(parts) >= 2 {
		if right := optionRightFromOCC(strings.ToUpper(parts[len(parts)-1])); right != "" {
			return right
		}
	}
	return ""
}

func optionRightFromOCC(s string) string {
	upper := strings.ToUpper(s)
	for i := 1; i < len(upper)-1; i++ {
		if upper[i] == 'C' && unicode.IsDigit(rune(upper[i-1])) && unicode.IsDigit(rune(upper[i+1])) {
			return "call"
		}
		if upper[i] == 'P' && unicode.IsDigit(rune(upper[i-1])) && unicode.IsDigit(rune(upper[i+1])) {
			return "put"
		}
	}
	return ""
}

// ParseOptionRight resolves call/put from explicit CSV cells first, then symbol.
func ParseOptionRight(candidates ...string) string {
	for _, raw := range candidates {
		if right := parseOptionRightToken(raw); right != "" {
			return right
		}
	}
	return ""
}

// ParseInstrumentType resolves stock/option/future/etc from a CSV cell and/or symbol.
// When raw is empty, InferInstrumentFromSymbol is used.
func ParseInstrumentType(raw, symbol string) string {
	raw = strings.TrimSpace(strings.ToUpper(raw))
	switch raw {
	case "OPTION", "OPTIONS", "OPT", "OPTION CONTRACT", "OPTN":
		return "option"
	case "FUTURE", "FUTURES", "FUT":
		return "future"
	case "FOREX", "FX":
		return "forex"
	case "CRYPTO":
		return "crypto"
	case "STOCK", "EQUITY", "SHARES", "STK", "CS":
		return "stock"
	case "":
		return InferInstrumentFromSymbol(symbol)
	default:
		return strings.ToLower(raw)
	}
}

// InferInstrumentFromSymbol heuristically detects options from common broker symbol formats.
func InferInstrumentFromSymbol(symbol string) string {
	s := strings.TrimSpace(symbol)
	if s == "" {
		return "stock"
	}
	parts := strings.Fields(s)
	if len(parts) >= 2 {
		leg := parts[len(parts)-1]
		if optionLegPattern.MatchString(leg) {
			return "option"
		}
		prev := parts[len(parts)-2]
		if strings.EqualFold(leg, "call") || strings.EqualFold(leg, "put") {
			return "option"
		}
		if strings.EqualFold(prev, "call") || strings.EqualFold(prev, "put") {
			return "option"
		}
	}
	upper := strings.ToUpper(s)
	for i := 1; i < len(upper)-1; i++ {
		c := upper[i]
		if (c == 'C' || c == 'P') && unicode.IsDigit(rune(upper[i-1])) && unicode.IsDigit(rune(upper[i+1])) {
			return "option"
		}
	}
	return "stock"
}
