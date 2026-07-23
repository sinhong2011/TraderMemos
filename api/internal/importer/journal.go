package importer

import (
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
)

// Journal trade CSV (e.g. Stonk Journal export) columns we recognize.
// Date,Symbol,Status,Market,Side,Qty,Entry,Exit,Entry Total,Exit Total,Position,
// Return ($),Return (%),Dividends,Open Date,Tags,Setup,Confidence,Target,Stop,Notes

// IsJournalTradeCSV reports whether headers look like a closed-trade journal export
// (entry+exit on one row) rather than raw executions.
func IsJournalTradeCSV(headers []string) bool {
	norm := map[string]bool{}
	for _, h := range headers {
		norm[normalizeHeader(h)] = true
	}
	has := func(keys ...string) bool {
		for _, k := range keys {
			if norm[k] {
				return true
			}
		}
		return false
	}
	return has("symbol") && has("entry") && has("exit") && has("open date", "opendate", "open_date")
}

// DetectFormat returns "journal_trades" or "executions".
func DetectFormat(headers []string) string {
	if IsJournalTradeCSV(headers) {
		return "journal_trades"
	}
	return "executions"
}

type Journal struct{}

type JournalParseOptions struct {
	OptionRightByRow map[int]string // 1-based CSV row → call|put
}

func NewJournal() *Journal { return &Journal{} }

func (j *Journal) Name() string { return "journal_trades" }

func (j *Journal) Detect(headers []string) bool { return IsJournalTradeCSV(headers) }

func (j *Journal) ParseRows(rows []map[string]string) ParseResult {
	return j.ParseRowsWithOptions(rows, nil)
}

func (j *Journal) ParseRowsWithOptions(rows []map[string]string, opts *JournalParseOptions) ParseResult {
	res := ParseResult{Format: "journal_trades"}
	for i, row := range rows {
		override := ""
		if opts != nil && opts.OptionRightByRow != nil {
			override = opts.OptionRightByRow[i+1]
		}
		exs, ann, err := parseJournalRow(row, override)
		if err != nil {
			res.Errors = append(res.Errors, RowError{Row: i + 1, Message: err.Error()})
			continue
		}
		if len(exs) == 0 {
			continue
		}
		lot := uuid.NewString()
		for i := range exs {
			exs[i].LotKey = lot
		}
		exs[0].Annotation = ann
		res.Executions = append(res.Executions, exs...)
	}
	return res
}

func parseJournalRow(row map[string]string, optionRightOverride string) ([]ParsedExecution, *TradeAnnotation, error) {
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
		return nil, nil, fmt.Errorf("missing symbol")
	}

	market := strings.ToUpper(strings.TrimSpace(get("market")))
	instrument := ParseInstrumentType(market, symbol)

	sideRaw := strings.ToUpper(strings.TrimSpace(get("side")))
	direction := "long"
	switch sideRaw {
	case "LONG", "BUY":
		direction = "long"
	case "SHORT", "SELL":
		direction = "short"
	default:
		if sideRaw != "" {
			return nil, nil, fmt.Errorf("invalid side %q (want LONG/SHORT)", sideRaw)
		}
	}

	qty, err := strconv.ParseFloat(strings.TrimSpace(get("qty", "quantity")), 64)
	if err != nil || qty <= 0 {
		return nil, nil, fmt.Errorf("invalid qty")
	}

	entry, err := strconv.ParseFloat(strings.TrimSpace(get("entry")), 64)
	if err != nil {
		return nil, nil, fmt.Errorf("invalid entry")
	}

	target, _ := parseOptionalFloat(get("target"))
	var targetPtr *float64
	if target > 0 {
		targetPtr = &target
	}

	optionRight := resolveJournalOptionRight(resolveOptionRightParams{
		Instrument: instrument,
		Symbol:     symbol,
		Side:       sideRaw,
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
		Override: optionRightOverride,
	})

	openAt, err := parseTime(get("open date", "opendate", "open_date"))
	if err != nil {
		return nil, nil, fmt.Errorf("invalid open date")
	}

	entryTotal, _ := parseOptionalFloat(get("entry total", "entrytotal", "entry_total"))
	exitTotal, _ := parseOptionalFloat(get("exit total", "exittotal", "exit_total"))
	retDollars, hasReturn := parseOptionalFloat(get("return ($)", "return($)", "return $", "pnl", "net pnl", "return"))

	mult := DefaultMultiplier(instrument)
	if entryTotal > 0 && entry > 0 && qty > 0 {
		derived := entryTotal / (qty * entry)
		if derived > 0.5 {
			// Round to nearest sensible multiplier (1 or 100).
			if math.Abs(derived-100) < math.Abs(derived-1) {
				mult = 100
			} else {
				mult = 1
			}
		}
	}

	exitStr := strings.TrimSpace(get("exit"))
	posStr := strings.TrimSpace(get("position"))
	position, _ := parseOptionalFloat(posStr)
	closed := exitStr != "" && (posStr == "" || math.Abs(position) < 1e-9)

	var exit float64
	var closeAt time.Time
	if closed {
		exit, err = strconv.ParseFloat(exitStr, 64)
		if err != nil {
			return nil, nil, fmt.Errorf("invalid exit")
		}
		closeAt, err = parseTime(get("date", "close date", "closed at"))
		if err != nil {
			return nil, nil, fmt.Errorf("invalid close date")
		}
	}

	// Infer total fees from notional vs reported return when both sides present.
	var feesTotal float64
	if closed && hasReturn {
		gross := exitTotal - entryTotal
		if direction == "short" {
			gross = entryTotal - exitTotal
		}
		// If totals missing, fall back to price*qty*mult.
		if entryTotal == 0 {
			entryTotal = entry * qty * mult
		}
		if exitTotal == 0 {
			exitTotal = exit * qty * mult
			gross = exitTotal - entryTotal
			if direction == "short" {
				gross = entryTotal - exitTotal
			}
		}
		feesTotal = gross - retDollars
		if feesTotal < 0 && feesTotal > -0.01 {
			feesTotal = 0
		}
		if feesTotal < 0 {
			// Keep absolute fees; sign quirks from rounding shouldn't invent credits.
			feesTotal = math.Abs(feesTotal)
		}
	}

	entrySide, exitSide := "buy", "sell"
	if direction == "short" {
		entrySide, exitSide = "sell", "buy"
	}

	entryComm := 0.0
	exitComm := 0.0
	if feesTotal > 0 {
		entryComm = feesTotal / 2
		exitComm = feesTotal - entryComm
	}

	entryFill := ParsedExecution{
		Symbol:         symbol,
		InstrumentType: instrument,
		OptionRight:    optionRight,
		Side:           entrySide,
		Quantity:       qty,
		Price:          entry,
		Commission:     entryComm,
		ExecutedAt:     openAt,
		Multiplier:     mult,
	}

	fills := []ParsedExecution{entryFill}
	if closed {
		fills = append(fills, ParsedExecution{
			Symbol:         symbol,
			InstrumentType: instrument,
			OptionRight:    optionRight,
			Side:           exitSide,
			Quantity:       qty,
			Price:          exit,
			Commission:     exitComm,
			ExecutedAt:     closeAt,
			Multiplier:     mult,
		})
	}

	ann := &TradeAnnotation{
		Notes:     strings.TrimSpace(get("notes")),
		SetupName: strings.TrimSpace(get("setup")),
		Emotion:   "",
		Tags:      nil,
	}
	if c := strings.TrimSpace(get("confidence")); c != "" {
		if v, err := strconv.ParseInt(c, 10, 64); err == nil {
			ann.Confidence = &v
		}
	}
	if t, ok := parseOptionalFloat(get("target")); ok {
		ann.Target = &t
	}
	if s, ok := parseOptionalFloat(get("stop")); ok {
		ann.Stop = &s
	}
	if d, ok := parseOptionalFloat(get("dividends")); ok {
		ann.Dividends = d
	}

	ann.Tags, ann.Emotion = parseJournalTags(get("tags"))
	// Setup column wins; also accept setup: from tags if Setup empty.
	if ann.SetupName == "" {
		for _, t := range ann.Tags {
			if strings.EqualFold(t.Kind, "setup") {
				ann.SetupName = t.Name
				break
			}
		}
		// Filter setup-kind out of attachable tags (setups are a separate entity).
		filtered := ann.Tags[:0]
		for _, t := range ann.Tags {
			if !strings.EqualFold(t.Kind, "setup") {
				filtered = append(filtered, t)
			}
		}
		ann.Tags = filtered
	} else {
		filtered := ann.Tags[:0]
		for _, t := range ann.Tags {
			if !strings.EqualFold(t.Kind, "setup") {
				filtered = append(filtered, t)
			}
		}
		ann.Tags = filtered
	}

	return fills, ann, nil
}

// parseJournalTags parses "mistake:Early exit; emotion:Anxious; foo" into tags + emotion.
func parseJournalTags(raw string) ([]TagRef, string) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, ""
	}
	var tags []TagRef
	emotion := ""
	for _, part := range strings.Split(raw, ";") {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		kind, name, ok := strings.Cut(part, ":")
		if !ok {
			tags = append(tags, TagRef{Name: part, Kind: "custom"})
			continue
		}
		kind = strings.ToLower(strings.TrimSpace(kind))
		name = strings.TrimSpace(name)
		if name == "" {
			continue
		}
		switch kind {
		case "emotion":
			emotion = name
		case "mistake":
			tags = append(tags, TagRef{Name: name, Kind: "mistake"})
		case "setup":
			tags = append(tags, TagRef{Name: name, Kind: "setup"})
		default:
			tags = append(tags, TagRef{Name: name, Kind: "custom"})
		}
	}
	return tags, emotion
}

func normalizeHeader(h string) string {
	h = strings.TrimSpace(h)
	h = strings.TrimPrefix(h, "\ufeff")
	return strings.ToLower(h)
}

func lookup(row map[string]string, want string) string {
	want = normalizeHeader(want)
	for k, v := range row {
		if normalizeHeader(k) == want {
			return strings.TrimSpace(v)
		}
	}
	// Substring fallback for "Return ($)" vs "return"
	if want == "return ($)" || want == "return$" {
		for k, v := range row {
			nk := normalizeHeader(k)
			if strings.Contains(nk, "return") && (strings.Contains(nk, "$") || strings.Contains(nk, "pnl") || nk == "return") {
				return strings.TrimSpace(v)
			}
		}
	}
	return ""
}

func parseOptionalFloat(s string) (float64, bool) {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0, false
	}
	v, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return 0, false
	}
	return v, true
}
