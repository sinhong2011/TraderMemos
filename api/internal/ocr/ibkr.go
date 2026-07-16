package ocr

import (
	"regexp"
	"strings"
	"time"
)

var (
	reIBKRHeaderDate = regexp.MustCompile(`(?i)\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*)\s+(\d{1,2}),?\s+(20\d{2})\b`)
	reIBKRClock      = regexp.MustCompile(`\b(\d{1,2}:\d{2}:\d{2})\b`)
	reIBKRSideQty    = regexp.MustCompile(`(?i)\b(Sold|Bought)\s+(\d+(?:[.,]\d+)?)\b`)
	reIBKRSymbolLine = regexp.MustCompile(`(?i)^\s*([A-Z]{1,6})\b.*\$\s*(\d+(?:\.\d+)?)\s+(\d{1,2}:\d{2}:\d{2})`)
	reIBKROptionDesc = regexp.MustCompile(`(?i)\b([A-Z]{3})\s+(\d{1,2})\s*'?(\d{2})\s+(\d+(?:\.\d+)?)\s+(Put|Call)\b`)
	reIBKRMoneyLoose = regexp.MustCompile(`\$?\s*(-?\d{1,3}(?:,\d{3})*(?:\.\d+)?|-?\d+(?:\.\d+)?)`)
	reIBKRLooksLike  = regexp.MustCompile(`(?i)\b(?:Sold|Bought)\s+\d+\b`)
)

// looksLikeIBKRTradeList detects IBKR mobile Orders & Trades list screenshots.
func looksLikeIBKRTradeList(text string) bool {
	if !reIBKRLooksLike.MatchString(text) {
		return false
	}
	// Option contract line or realized P&L header are strong IBKR signals.
	if reIBKROptionDesc.MatchString(text) {
		return true
	}
	upper := strings.ToUpper(text)
	return strings.Contains(upper, "REALIZED") || strings.Contains(upper, "TRADE(S)") ||
		strings.Contains(upper, "ORDERS & TRADES")
}

// parseIBKRTradeList extracts multiple fills from IBKR Trades-tab OCR text.
// Layout after tesseract (column merge) typically looks like:
//
//	INTC miax $4.2 22:16:41
//	JUL 10 '26 110 Put $420 $73.53
//	Sold 1 $1.05
//	4.2 Limit, Day
func parseIBKRTradeList(text string) TradeExtract {
	out := TradeExtract{
		RawText:        text,
		InstrumentType: "option",
		Rows:           []ExtractedFill{},
		Warnings:       []string{},
	}

	date := findIBKRScreenshotDate(text)
	lines := splitNonEmptyLines(text)

	type pending struct {
		symbol string
		price  float64
		clock  string
		option bool
	}
	var cur *pending

	flush := func(side string, qty, commission float64) {
		if cur == nil || qty <= 0 || cur.price <= 0 || side == "" {
			return
		}
		fill := ExtractedFill{
			Side:       side,
			Quantity:   qty,
			Price:      cur.price,
			Commission: commission,
			ExecutedAt: combineDateAndClock(date, cur.clock),
		}
		out.Rows = append(out.Rows, fill)
		if out.Symbol == "" && cur.symbol != "" {
			out.Symbol = cur.symbol
		}
		if cur.option {
			out.InstrumentType = "option"
		}
		cur = nil
	}

	for i := 0; i < len(lines); i++ {
		line := lines[i]

		if m := reIBKRSideQty.FindStringSubmatch(line); len(m) == 3 {
			side := mapSideToBuySell(m[1])
			qty := parseFloat(m[2])
			comm := extractTrailingCommission(line)
			// Commission often on same line after qty; OCR may garble ($1.05 → 2125).
			if comm <= 0 || comm > 50 {
				comm = 0
			}
			flush(side, qty, comm)
			continue
		}

		if m := reIBKRSymbolLine.FindStringSubmatch(line); len(m) == 4 {
			sym := strings.ToUpper(m[1])
			if _, noise := noiseTokens[sym]; !noise && lookslikeTicker(sym) {
				cur = &pending{
					symbol: sym,
					price:  parseFloat(m[2]),
					clock:  m[3],
					option: reIBKROptionDesc.MatchString(peekNext(lines, i, 2)),
				}
				continue
			}
		}

		// Alternate: symbol alone, price+time nearby on same or next lines.
		if cur == nil {
			if m := reSymbolBare.FindStringSubmatch(strings.ToUpper(line)); len(m) == 2 {
				sym := m[1]
				if _, noise := noiseTokens[sym]; !noise && lookslikeTicker(sym) && len(sym) <= 5 {
					clock := firstMatch(reIBKRClock, line)
					price := firstMoneyAfterSymbol(line, sym)
					if clock == "" || price <= 0 {
						// peek next 2 lines for price/time
						window := line + "\n" + peekNext(lines, i, 2)
						if clock == "" {
							clock = firstMatch(reIBKRClock, window)
						}
						if price <= 0 {
							price = firstFillPrice(window)
						}
					}
					if clock != "" && price > 0 {
						cur = &pending{
							symbol: sym,
							price:  price,
							clock:  clock,
							option: reIBKROptionDesc.MatchString(peekNext(lines, i, 3)),
						}
					}
				}
			}
		} else if reIBKROptionDesc.MatchString(line) {
			cur.option = true
		}
	}

	if len(out.Rows) == 0 {
		out.Warnings = append(out.Warnings, "IBKR list detected but no fills parsed")
		out.Confidence = 0.2
		return out
	}

	// Infer position side from first fill (Bought → long open, Sold → short open bias).
	if out.Rows[0].Side == "buy" {
		out.Side = "long"
	} else {
		out.Side = "short"
	}
	if out.Symbol == "" {
		out.Warnings = append(out.Warnings, "symbol not detected")
	}
	if date.IsZero() {
		out.Warnings = append(out.Warnings, "trade date not detected; times may lack calendar day")
	}
	out.Confidence = scoreConfidence(out)
	// Multi-fill lists are a strong match when ≥2 rows parse.
	if len(out.Rows) >= 2 {
		out.Confidence += 0.1
		if out.Confidence > 1 {
			out.Confidence = 1
		}
	}
	return out
}

func findIBKRScreenshotDate(text string) time.Time {
	m := reIBKRHeaderDate.FindStringSubmatch(text)
	if len(m) != 4 {
		return time.Time{}
	}
	raw := m[1] + " " + m[2] + " " + m[3]
	for _, layout := range []string{"January 2 2006", "Jan 2 2006", "January 02 2006", "Jan 02 2006"} {
		if t, err := time.Parse(layout, raw); err == nil {
			return t
		}
	}
	return time.Time{}
}

func combineDateAndClock(date time.Time, clock string) string {
	if clock == "" {
		if date.IsZero() {
			return ""
		}
		return time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, time.Local).Format(time.RFC3339)
	}
	var h, mi, s int
	parts := strings.Split(clock, ":")
	if len(parts) < 2 {
		return ""
	}
	h = int(parseFloat(parts[0]))
	mi = int(parseFloat(parts[1]))
	if len(parts) > 2 {
		s = int(parseFloat(parts[2]))
	}
	if date.IsZero() {
		// Date unknown — still return today's calendar with clock is risky;
		// prefer RFC3339 with Unix epoch day only if we must. Use local today as last resort
		// so the form's datetime-local is usable; UI can edit.
		now := time.Now()
		date = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.Local)
	}
	t := time.Date(date.Year(), date.Month(), date.Day(), h, mi, s, 0, time.Local)
	return t.Format(time.RFC3339)
}

func splitNonEmptyLines(text string) []string {
	raw := strings.Split(text, "\n")
	out := make([]string, 0, len(raw))
	for _, line := range raw {
		line = strings.TrimSpace(line)
		if line != "" {
			out = append(out, line)
		}
	}
	return out
}

func peekNext(lines []string, i, n int) string {
	var b strings.Builder
	for j := 1; j <= n && i+j < len(lines); j++ {
		if j > 1 {
			b.WriteByte('\n')
		}
		b.WriteString(lines[i+j])
	}
	return b.String()
}

func extractTrailingCommission(line string) float64 {
	// After "Sold 1" / "Bought 3", remaining money-like tokens are commission.
	idx := reIBKRSideQty.FindStringIndex(line)
	if idx == nil {
		return 0
	}
	rest := line[idx[1]:]
	ms := reIBKRMoneyLoose.FindAllStringSubmatch(rest, -1)
	var best float64
	for _, m := range ms {
		raw := m[1]
		v := cleanCommissionOCR(raw)
		if v <= 0 || v >= 20 {
			continue
		}
		// Prefer values that look like real commissions ($X.YZ), not fragments of "2125".
		if strings.Contains(raw, ".") || strings.HasPrefix(strings.TrimSpace(m[0]), "$") {
			return v
		}
		// Bare integers are usually OCR garbage for option commissions; skip > 9.
		if !strings.Contains(raw, ".") && v >= 10 {
			continue
		}
		if best == 0 {
			best = v
		}
	}
	// Only accept bare-int fallback if it's a plausible small commission.
	if best > 0 && best < 5 {
		return best
	}
	return 0
}

// cleanCommissionOCR fixes common Tesseract misreads of small "$X.YZ" amounts.
func cleanCommissionOCR(raw string) float64 {
	s := strings.TrimSpace(raw)
	s = strings.TrimPrefix(s, "$")
	s = strings.ReplaceAll(s, ",", "")
	// '$1.05' → '91.05' ( $ misread as 9 )
	if len(s) == 5 && s[0] == '9' && s[2] == '.' {
		if alt := parseFloat(s[1:]); alt > 0 && alt < 20 {
			return alt
		}
	}
	// '$0.78' → '30.78' ( $ misread as 3 )
	if len(s) >= 4 && s[1] == '0' && s[2] == '.' {
		if alt := parseFloat(s[1:]); alt > 0 && alt < 5 {
			return alt
		}
	}
	// '2125' from '$1.25' with missing decimal — too ambiguous; skip.
	v := parseFloat(s)
	if v >= 20 {
		return 0
	}
	return v
}

func firstMoneyAfterSymbol(line, sym string) float64 {
	upper := strings.ToUpper(line)
	pos := strings.Index(upper, strings.ToUpper(sym))
	if pos < 0 {
		return 0
	}
	rest := line[pos+len(sym):]
	ms := reIBKRMoneyLoose.FindAllStringSubmatch(rest, -1)
	for _, m := range ms {
		v := parseFloat(m[1])
		// Fill prices for these options are typically under a few hundred.
		if v > 0 && v < 500 {
			return v
		}
	}
	return 0
}

func firstFillPrice(window string) float64 {
	ms := reIBKRMoneyLoose.FindAllStringSubmatch(window, -1)
	for _, m := range ms {
		v := parseFloat(m[1])
		if v > 0 && v < 500 {
			return v
		}
	}
	return 0
}
