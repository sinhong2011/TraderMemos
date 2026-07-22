package ocr

import (
	"fmt"
	"sort"
	"strings"
)

func mapSideToBuySell(word string) string {
	switch strings.ToLower(strings.TrimSpace(word)) {
	case "buy", "bought", "bot", "long", "bto":
		return "buy"
	case "sell", "sold", "sld", "short", "stc", "sto", "old":
		return "sell"
	default:
		return ""
	}
}

func scoreConfidence(out TradeExtract) float64 {
	score := 0.0
	if out.Symbol != "" {
		score += 0.35
	}
	if len(out.Rows) > 0 {
		score += 0.35
		r := out.Rows[0]
		if r.Side != "" {
			score += 0.1
		}
		if r.ExecutedAt != "" {
			score += 0.1
		}
		if r.Fees > 0 || r.Commission > 0 {
			score += 0.05
		}
	}
	if out.Side != "" {
		score += 0.05
	}
	if len(out.Rows) >= 2 {
		score += 0.1
	}
	if score > 1 {
		score = 1
	}
	return score
}

// finalizeExtract sorts fills, sets majority symbol / symbols[], and infers long/short.
func finalizeExtract(out TradeExtract) TradeExtract {
	sort.SliceStable(out.Rows, func(i, j int) bool {
		a, b := out.Rows[i].ExecutedAt, out.Rows[j].ExecutedAt
		if a == "" {
			return false
		}
		if b == "" {
			return true
		}
		return a < b
	})

	symbolVotes := map[string]int{}
	for _, r := range out.Rows {
		if r.Symbol != "" {
			symbolVotes[r.Symbol]++
		}
	}

	bestSym, bestN := "", 0
	for sym, n := range symbolVotes {
		if n > bestN || (n == bestN && (bestSym == "" || sym < bestSym)) {
			bestSym, bestN = sym, n
		}
	}
	if bestSym != "" {
		out.Symbol = bestSym
	}

	out.Symbols = nil
	if len(symbolVotes) > 1 {
		syms := make([]string, 0, len(symbolVotes))
		for sym := range symbolVotes {
			syms = append(syms, sym)
		}
		sort.Strings(syms)
		out.Symbols = syms
		out.Warnings = append(out.Warnings,
			fmt.Sprintf("multiple symbols in screenshot (%s) — each will be logged as its own trade", strings.Join(syms, ", ")))
	}

	sideRows := out.Rows
	if bestSym != "" {
		filtered := make([]ExtractedFill, 0, len(out.Rows))
		for _, r := range out.Rows {
			if r.Symbol == "" || r.Symbol == bestSym {
				filtered = append(filtered, r)
			}
		}
		if len(filtered) > 0 {
			sideRows = filtered
		}
	}
	if len(sideRows) > 0 && out.Side != "long" && out.Side != "short" {
		if sideRows[0].Side == "buy" {
			out.Side = "long"
		} else if sideRows[0].Side == "sell" {
			out.Side = "short"
		}
	}
	if out.Symbol == "" {
		out.Warnings = append(out.Warnings, "symbol not detected")
	}
	out.Confidence = scoreConfidence(out)
	return out
}
