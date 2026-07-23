package importer

import (
	"strconv"
	"strings"
)

// JournalPreviewSummary is a parsed overview for journal CSV preview/commit UI.
type JournalPreviewSummary struct {
	RowCount       int     `json:"row_count"`
	TradeCount     int     `json:"trade_count"`
	ExecutionCount int     `json:"execution_count"`
	NetPnl         float64 `json:"net_pnl"`
	StockTrades    int     `json:"stock_trades"`
	OptionTrades   int     `json:"option_trades"`
	ErrorCount     int     `json:"error_count"`
}

// JournalTradePreview is a human-readable trade row for import review.
type JournalTradePreview struct {
	Row            int     `json:"row"`
	Symbol         string  `json:"symbol"`
	Market         string  `json:"market"`
	InstrumentType string  `json:"instrument_type"`
	OptionRight    string  `json:"option_right,omitempty"` // call|put
	Side           string  `json:"side"`
	Status         string  `json:"status,omitempty"`
	Qty            float64 `json:"qty"`
	Entry          float64 `json:"entry"`
	Exit           float64 `json:"exit"`
	EntryTotal     float64 `json:"entry_total,omitempty"`
	ExitTotal      float64 `json:"exit_total,omitempty"`
	ReturnUsd      float64 `json:"return_usd"`
	ReturnPct      float64 `json:"return_pct,omitempty"`
	Dividends      float64 `json:"dividends,omitempty"`
	OpenDate       string  `json:"open_date"`
	CloseDate      string  `json:"close_date"`
	Tags           string  `json:"tags,omitempty"`
	Setup          string  `json:"setup,omitempty"`
	Confidence     string  `json:"confidence,omitempty"`
	Target         string  `json:"target,omitempty"`
	Stop           string  `json:"stop,omitempty"`
	Notes          string  `json:"notes,omitempty"`
}

// BuildJournalPreview parses journal rows and returns summary + all trade previews.
func BuildJournalPreview(rows []map[string]string) (JournalPreviewSummary, []JournalTradePreview) {
	parsed := NewJournal().ParseRows(rows)
	summary := JournalPreviewSummary{
		RowCount:       len(rows),
		ExecutionCount: len(parsed.Executions),
		ErrorCount:     len(parsed.Errors),
	}

	lots := map[string]string{} // lot -> market
	for _, ex := range parsed.Executions {
		if ex.LotKey == "" {
			continue
		}
		if _, ok := lots[ex.LotKey]; !ok {
			lots[ex.LotKey] = ex.InstrumentType
			switch ex.InstrumentType {
			case "option":
				summary.OptionTrades++
			default:
				summary.StockTrades++
			}
		}
	}
	summary.TradeCount = len(lots)

	for _, row := range rows {
		if v, ok := journalReturnUsd(row); ok {
			summary.NetPnl += v
		}
	}
	summary.NetPnl = round2(summary.NetPnl)

	samples := make([]JournalTradePreview, 0, len(rows))
	for i, row := range rows {
		preview, ok := journalRowPreview(row, i+1)
		if ok {
			samples = append(samples, preview)
		}
	}
	return summary, samples
}

func journalRowPreview(row map[string]string, rowNum int) (JournalTradePreview, bool) {
	get := func(keys ...string) string {
		for _, k := range keys {
			if v := lookup(row, k); v != "" {
				return v
			}
		}
		return ""
	}

	symbol := strings.ToUpper(strings.TrimSpace(get("symbol")))
	if symbol == "" {
		return JournalTradePreview{}, false
	}
	qty, err := strconv.ParseFloat(strings.TrimSpace(get("qty", "quantity")), 64)
	if err != nil || qty <= 0 {
		return JournalTradePreview{}, false
	}
	entry, err := strconv.ParseFloat(strings.TrimSpace(get("entry")), 64)
	if err != nil {
		return JournalTradePreview{}, false
	}
	exit, err := strconv.ParseFloat(strings.TrimSpace(get("exit")), 64)
	if err != nil {
		return JournalTradePreview{}, false
	}
	ret, _ := journalReturnUsd(row)
	retPct, _ := parseOptionalFloat(get("return (%)", "return(%)", "return %"))
	entryTotal, _ := parseOptionalFloat(get("entry total", "entrytotal", "entry_total"))
	exitTotal, _ := parseOptionalFloat(get("exit total", "exittotal", "exit_total"))
	dividends, _ := parseOptionalFloat(get("dividends"))

	market := strings.ToUpper(strings.TrimSpace(get("market")))
	instrument := ParseInstrumentType(market, symbol)
	side := strings.ToUpper(strings.TrimSpace(get("side")))

	target, _ := parseOptionalFloat(get("target"))
	var targetPtr *float64
	if target > 0 {
		targetPtr = &target
	}

	optionRight := resolveJournalOptionRight(resolveOptionRightParams{
		Instrument: instrument,
		Symbol:     symbol,
		Side:       side,
		Market:     market,
		Entry:      entry,
		Target:     targetPtr,
		Tags:       strings.TrimSpace(get("tags")),
		Notes:      strings.TrimSpace(get("notes")),
		Setup:      strings.TrimSpace(get("setup")),
		Explicit: []string{
			get("option right", "option_right", "call/put", "call put", "call_put", "right", "option type", "contract type", "strategy", "direction", "dir"),
			get("side"),
			get("market"),
		},
	})

	return JournalTradePreview{
		Row:            rowNum,
		Symbol:         symbol,
		Market:         market,
		InstrumentType: instrument,
		OptionRight:    optionRight,
		Side:           side,
		Status:         strings.ToUpper(strings.TrimSpace(get("status"))),
		Qty:            qty,
		Entry:          entry,
		Exit:           exit,
		EntryTotal:     entryTotal,
		ExitTotal:      exitTotal,
		ReturnUsd:      ret,
		ReturnPct:      retPct,
		Dividends:      dividends,
		OpenDate:       strings.TrimSpace(get("open date", "opendate", "open_date")),
		CloseDate:      strings.TrimSpace(get("date", "close date", "closed at")),
		Tags:           strings.TrimSpace(get("tags")),
		Setup:          strings.TrimSpace(get("setup")),
		Confidence:     strings.TrimSpace(get("confidence")),
		Target:         strings.TrimSpace(get("target")),
		Stop:           strings.TrimSpace(get("stop")),
		Notes:          strings.TrimSpace(get("notes")),
	}, true
}

func journalReturnUsd(row map[string]string) (float64, bool) {
	get := func(keys ...string) string {
		for _, k := range keys {
			if v := lookup(row, k); v != "" {
				return v
			}
		}
		return ""
	}
	return parseOptionalFloat(get("return ($)", "return($)", "return $", "pnl", "net pnl", "return"))
}

func round2(v float64) float64 {
	return float64(int64(v*100+0.5)) / 100
}

// CountJournalTrades returns distinct journal round-trips from parsed executions.
func CountJournalTrades(executions []ParsedExecution) int {
	lots := map[string]bool{}
	for _, ex := range executions {
		if ex.LotKey != "" {
			lots[ex.LotKey] = true
		}
	}
	return len(lots)
}
