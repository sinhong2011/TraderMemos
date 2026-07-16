package ocr

import (
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode"
)

var (
	reSymbolLabel = regexp.MustCompile(`(?i)\b(?:symbol|ticker|instrument|contract)\s*[:#]?\s*([A-Z][A-Z0-9./\-]{0,11})\b`)
	reSymbolBare  = regexp.MustCompile(`\b([A-Z]{1,6}(?:/[A-Z]{3})?)\b`)
	// Note: omit "btc" (buy-to-close) — it collides with Bitcoin tickers.
	reSideWord = regexp.MustCompile(`(?i)\b(buy|sell|bought|sold|bot|sld|long|short|bto|stc|sto)\b`)
	reQtyPrice    = regexp.MustCompile(`(?i)(?:(?:qty|quantity|shares|size|contracts?)\s*[:#]?\s*)?(\d+(?:[.,]\d+)?)\s*(?:@|x|×|\*|at)\s*\$?\s*(\d+(?:[.,]\d+)?)`)
	rePriceLabel  = regexp.MustCompile(`(?i)\b(?:price|fill|avg(?:erage)?(?:\s+price)?|executed?\s+at)\s*[:#]?\s*\$?\s*(\d+(?:[.,]\d+)?)`)
	reQtyLabel    = regexp.MustCompile(`(?i)\b(?:qty|quantity|shares|size|contracts?)\s*[:#]?\s*(\d+(?:[.,]\d+)?)`)
	reFeeLabel    = regexp.MustCompile(`(?i)\b(?:fees?|fee)\s*[:#]?\s*\$?\s*(\d+(?:[.,]\d+)?)`)
	reCommLabel   = regexp.MustCompile(`(?i)\b(?:commission|comm)\s*[:#]?\s*\$?\s*(\d+(?:[.,]\d+)?)`)
	reISOTime     = regexp.MustCompile(`\b(20\d{2}-\d{2}-\d{2}[ T]\d{1,2}:\d{2}(?::\d{2})?)\b`)
	reSlashTime   = regexp.MustCompile(`\b(\d{1,2}/\d{1,2}/(?:20)?\d{2}\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AaPp][Mm])?)\b`)
	reCrypto      = regexp.MustCompile(`(?i)\b(BTC|ETH|SOL|XRP)(?:[-/]USDT?)?\b`)
	reFutures     = regexp.MustCompile(`(?i)\b(ES|NQ|YM|RTY|CL|GC|MES|MNQ|MYM|M2K|MGC)\b`)
	reForex       = regexp.MustCompile(`(?i)\b([A-Z]{3}/[A-Z]{3})\b`)
	reOptionHint  = regexp.MustCompile(`(?i)\b(call|put|strike|expir(?:y|ation)|\$\d+(?:\.\d+)?\s*(?:c|p)\b)`)

	noiseTokens = map[string]struct{}{
		"BUY": {}, "SELL": {}, "LONG": {}, "SHORT": {}, "FILLED": {}, "FILL": {},
		"ORDER": {}, "TRADE": {}, "SHARES": {}, "SHARE": {}, "QTY": {}, "PRICE": {},
		"USD": {}, "USDT": {}, "FEE": {}, "FEES": {}, "COMM": {}, "COMMISSION": {},
		"TIME": {}, "DATE": {}, "STATUS": {}, "SUBMITTED": {}, "EXECUTED": {},
		"MARKET": {}, "LIMIT": {}, "STOP": {}, "TOTAL": {}, "AMOUNT": {}, "AVG": {},
		"AVERAGE": {}, "OPEN": {}, "CLOSE": {}, "ENTRY": {}, "EXIT": {}, "PNL": {},
		"SYMBOL": {}, "TICKER": {}, "SIDE": {}, "ACTION": {}, "TYPE": {}, "BOT": {},
		"SLD": {}, "BTO": {}, "STC": {}, "STO": {},
	}
)

// ParseTradeText turns noisy OCR text into a TradeExtract draft.
func ParseTradeText(raw string) TradeExtract {
	text := normalizeOCRText(raw)
	out := TradeExtract{
		RawText:        raw,
		InstrumentType: "stock",
		Rows:           []ExtractedFill{},
		Warnings:       []string{},
	}
	if strings.TrimSpace(text) == "" {
		out.Confidence = 0
		out.Warnings = append(out.Warnings, "no text detected in image")
		return out
	}

	// Broker-specific multi-fill list (IBKR mobile Trades tab).
	if looksLikeIBKRTradeList(text) {
		ibkr := parseIBKRTradeList(text)
		ibkr.RawText = raw
		if len(ibkr.Rows) > 0 {
			return ibkr
		}
		// Fall through to generic parser with IBKR warnings preserved.
		out.Warnings = append(out.Warnings, ibkr.Warnings...)
	}

	upper := strings.ToUpper(text)

	out.Symbol = detectSymbol(text, upper)
	out.InstrumentType = detectInstrument(upper, out.Symbol)

	sideWord := firstMatch(reSideWord, text)
	fillSide := mapSideToBuySell(sideWord)
	out.Side = mapSideToLongShort(sideWord)

	qty, price := extractQtyPrice(text)
	fees := firstFloat(reFeeLabel, text)
	comm := firstFloat(reCommLabel, text)
	executedAt := extractTime(text)

	if qty > 0 && price > 0 && fillSide != "" {
		out.Rows = append(out.Rows, ExtractedFill{
			Side:       fillSide,
			Quantity:   qty,
			Price:      price,
			Fees:       fees,
			Commission: comm,
			ExecutedAt: executedAt,
		})
	} else if qty > 0 && price > 0 {
		// Default open side to buy when action word missing.
		out.Rows = append(out.Rows, ExtractedFill{
			Side:       "buy",
			Quantity:   qty,
			Price:      price,
			Fees:       fees,
			Commission: comm,
			ExecutedAt: executedAt,
		})
		out.Warnings = append(out.Warnings, "side not detected; defaulted first fill to buy")
		if out.Side == "" {
			out.Side = "long"
		}
	} else {
		if qty <= 0 {
			out.Warnings = append(out.Warnings, "quantity not detected")
		}
		if price <= 0 {
			out.Warnings = append(out.Warnings, "price not detected")
		}
		if fillSide == "" {
			out.Warnings = append(out.Warnings, "side not detected")
		}
	}

	if out.Symbol == "" {
		out.Warnings = append(out.Warnings, "symbol not detected")
	}

	out.Confidence = scoreConfidence(out)
	return out
}

func normalizeOCRText(s string) string {
	s = strings.ReplaceAll(s, "\r\n", "\n")
	s = strings.ReplaceAll(s, "\r", "\n")
	// Common OCR money glitches
	s = strings.ReplaceAll(s, "USO", "USD")
	var b strings.Builder
	b.Grow(len(s))
	for _, r := range s {
		switch r {
		case '–', '—', '−':
			b.WriteByte('-')
		case '×', '✕':
			b.WriteByte('x')
		case '’', '‘', '`':
			b.WriteByte('\'')
		default:
			b.WriteRune(r)
		}
	}
	return b.String()
}

func detectSymbol(text, upper string) string {
	if m := reSymbolLabel.FindStringSubmatch(text); len(m) == 2 {
		return strings.ToUpper(m[1])
	}
	if m := reForex.FindStringSubmatch(upper); len(m) == 2 {
		return strings.ToUpper(m[1])
	}
	if m := reCrypto.FindStringSubmatch(upper); len(m) == 2 {
		return strings.ToUpper(m[1])
	}
	if m := reFutures.FindStringSubmatch(upper); len(m) == 2 {
		return strings.ToUpper(m[1])
	}
	// Prefer short ticker-like tokens that are not noise.
	for _, m := range reSymbolBare.FindAllStringSubmatch(upper, -1) {
		tok := m[1]
		if _, skip := noiseTokens[tok]; skip {
			continue
		}
		if lookslikeTicker(tok) {
			return tok
		}
	}
	return ""
}

func lookslikeTicker(tok string) bool {
	if len(tok) < 1 || len(tok) > 6 {
		return false
	}
	letters := 0
	for _, r := range tok {
		if unicode.IsLetter(r) {
			letters++
		}
	}
	return letters >= 1
}

func detectInstrument(upper, symbol string) string {
	if reOptionHint.MatchString(upper) {
		return "option"
	}
	if reForex.MatchString(upper) || strings.Contains(symbol, "/") && len(symbol) == 7 {
		return "forex"
	}
	if reCrypto.MatchString(upper) {
		return "crypto"
	}
	if reFutures.MatchString(upper) {
		return "future"
	}
	return "stock"
}

func mapSideToBuySell(word string) string {
	switch strings.ToLower(word) {
	case "buy", "bought", "bot", "long", "bto":
		return "buy"
	case "sell", "sold", "sld", "short", "stc", "sto":
		return "sell"
	default:
		return ""
	}
}

func mapSideToLongShort(word string) string {
	switch strings.ToLower(word) {
	case "buy", "bought", "bot", "long", "bto":
		return "long"
	case "sell", "sold", "sld", "short", "stc", "sto":
		return "short"
	default:
		return ""
	}
}

func extractQtyPrice(text string) (qty, price float64) {
	if m := reQtyPrice.FindStringSubmatch(text); len(m) == 3 {
		return parseFloat(m[1]), parseFloat(m[2])
	}
	qty = firstFloat(reQtyLabel, text)
	price = firstFloat(rePriceLabel, text)
	return qty, price
}

func firstMatch(re *regexp.Regexp, text string) string {
	m := re.FindStringSubmatch(text)
	if len(m) >= 2 {
		return m[1]
	}
	return ""
}

func firstFloat(re *regexp.Regexp, text string) float64 {
	return parseFloat(firstMatch(re, text))
}

func parseFloat(s string) float64 {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0
	}
	// EU style 1.234,56 → 1234.56 ; US 1,234.56 → 1234.56
	if strings.Contains(s, ",") && strings.Contains(s, ".") {
		if strings.LastIndex(s, ",") > strings.LastIndex(s, ".") {
			s = strings.ReplaceAll(s, ".", "")
			s = strings.ReplaceAll(s, ",", ".")
		} else {
			s = strings.ReplaceAll(s, ",", "")
		}
	} else if strings.Contains(s, ",") {
		parts := strings.Split(s, ",")
		if len(parts) == 2 && len(parts[1]) <= 2 {
			s = strings.ReplaceAll(s, ",", ".")
		} else {
			s = strings.ReplaceAll(s, ",", "")
		}
	}
	n, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return 0
	}
	return n
}

func extractTime(text string) string {
	if m := reISOTime.FindStringSubmatch(text); len(m) == 2 {
		raw := strings.Replace(m[1], " ", "T", 1)
		layouts := []string{
			time.RFC3339,
			"2006-01-02T15:04:05",
			"2006-01-02T15:04",
			"2006-01-02 15:04:05",
			"2006-01-02 15:04",
		}
		for _, layout := range layouts {
			if t, err := time.ParseInLocation(layout, raw, time.Local); err == nil {
				return t.Format(time.RFC3339)
			}
			if t, err := time.Parse(layout, raw); err == nil {
				return t.Format(time.RFC3339)
			}
		}
	}
	if m := reSlashTime.FindStringSubmatch(text); len(m) == 2 {
		raw := strings.TrimSpace(m[1])
		layouts := []string{
			"1/2/2006 15:04:05",
			"1/2/2006 15:04",
			"1/2/06 15:04:05",
			"1/2/06 15:04",
			"1/2/2006 3:04:05 PM",
			"1/2/2006 3:04 PM",
			"1/2/06 3:04 PM",
			"02/01/2006 15:04:05",
			"02/01/2006 15:04",
		}
		for _, layout := range layouts {
			if t, err := time.ParseInLocation(layout, raw, time.Local); err == nil {
				return t.Format(time.RFC3339)
			}
		}
	}
	return ""
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
	if score > 1 {
		score = 1
	}
	return score
}
