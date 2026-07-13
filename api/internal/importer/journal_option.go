package importer

import "strings"

type resolveOptionRightParams struct {
	Instrument string
	Symbol     string
	Side       string
	Market     string
	Entry      float64
	Target     *float64
	Tags       string
	Notes      string
	Setup      string
	Explicit   []string
	Override   string
}

func resolveJournalOptionRight(p resolveOptionRightParams) string {
	if p.Instrument != "option" {
		return ""
	}
	if p.Override != "" {
		if right := parseOptionRightToken(p.Override); right != "" {
			return right
		}
	}
	right := ParseOptionRight(p.Explicit...)
	if right == "" {
		right = InferOptionRight(p.Symbol)
	}
	if right == "" {
		right = InferOptionRightFromText(p.Tags, p.Notes, p.Setup, p.Side, p.Market)
	}
	if right == "" {
		right = inferOptionRightFromTarget(p.Side, p.Entry, p.Target)
	}
	return right
}

// InferOptionRightFromText scans journal metadata for call/put hints.
func InferOptionRightFromText(parts ...string) string {
	for _, part := range parts {
		if right := parseOptionRightToken(part); right != "" {
			return right
		}
	}
	return ""
}

func parseOptionRightToken(raw string) string {
	s := strings.ToUpper(strings.TrimSpace(raw))
	if s == "" {
		return ""
	}
	switch s {
	case "CALL", "C", "LC", "LONG CALL", "LONG_CALL", "LONG-CALL", "CALLS", "CE":
		return "call"
	case "PUT", "P", "LP", "LONG PUT", "LONG_PUT", "LONG-PUT", "PUTS", "PE":
		return "put"
	case "SC", "SHORT CALL", "SHORT_CALL", "SHORT-CALL":
		return "call"
	case "SP", "SHORT PUT", "SHORT_PUT", "SHORT-PUT":
		return "put"
	}
	if strings.Contains(s, "LONG CALL") || strings.Contains(s, "LONG-CALL") {
		return "call"
	}
	if strings.Contains(s, "LONG PUT") || strings.Contains(s, "LONG-PUT") {
		return "put"
	}
	if strings.Contains(s, "CALL") && !strings.Contains(s, "RECALL") {
		return "call"
	}
	if strings.Contains(s, "PUT") {
		return "put"
	}
	return ""
}

func inferOptionRightFromTarget(side string, entry float64, target *float64) string {
	if target == nil || entry <= 0 {
		return ""
	}
	t := *target
	switch strings.ToUpper(strings.TrimSpace(side)) {
	case "LONG", "BUY":
		if t > entry*1.01 {
			return "call"
		}
		if t < entry*0.99 {
			return "put"
		}
	case "SHORT", "SELL":
		if t < entry*0.99 {
			return "call"
		}
		if t > entry*1.01 {
			return "put"
		}
	}
	return ""
}
