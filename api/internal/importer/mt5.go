package importer

import (
	"bytes"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"
	"unicode/utf16"

	"golang.org/x/net/html"
)

// MetaTrader terminal reports — the MT5 "Trade History Report" (.xlsx or
// .html) and the MT4 "Statement" / detailed "Account History" (.html) — are
// table documents, not CSVs, so they bypass the header-mapping pipeline:
// DetectMTStatement sniffs the raw upload and reduces it to the one table
// that holds fills (MT5 Deals, MT4 Closed Transactions).
//
// Times in these reports are the broker server's wall clock — conventionally
// EET/EEST (so that daily candles close with the New York session), never
// UTC. MTServerTZ is the preview default; the user can override it before
// commit (source_tz), which matters for brokers on UTC or local-time servers.
const MTServerTZ = "Europe/Athens"

// MTStatement is a sniffed MetaTrader report reduced to its trade table.
type MTStatement struct {
	Platform string   // "mt4" | "mt5"
	Headers  []string // trade-table headers (MT4's duplicate Price pair renamed)
	rows     [][]string
}

// DetectMTStatement sniffs upload content (never the filename) for a
// MetaTrader statement. It returns false for anything else — including
// well-formed XLSX/HTML files without a recognizable trade table.
func DetectMTStatement(data []byte) (*MTStatement, bool) {
	var grid [][]string
	switch SniffStatementContainer(data) {
	case "xlsx":
		g, err := readXLSXSheet(data)
		if err != nil {
			return nil, false
		}
		grid = g
	case "html":
		g, err := htmlTableRows(data)
		if err != nil {
			return nil, false
		}
		grid = g
	default:
		return nil, false
	}
	return mtFromGrid(grid)
}

// SniffStatementContainer classifies raw upload bytes as "xlsx", "html", or ""
// so the upload handler can distinguish "not a statement" from "spreadsheet we
// can't read" when producing error messages.
func SniffStatementContainer(data []byte) string {
	if bytes.HasPrefix(data, []byte("PK\x03\x04")) {
		return "xlsx"
	}
	head := decodeUTF16IfBOM(data)
	if len(head) > 2048 {
		head = head[:2048]
	}
	head = bytes.TrimLeft(head, "\xef\xbb\xbf \t\r\n")
	lower := bytes.ToLower(head)
	if bytes.HasPrefix(lower, []byte("<!doctype")) || bytes.HasPrefix(lower, []byte("<html")) ||
		bytes.Contains(lower, []byte("<table")) {
		return "html"
	}
	return ""
}

func (st *MTStatement) Name() string { return "metatrader" }

func (st *MTStatement) BrokerName() string {
	if st.Platform == "mt4" {
		return "MetaTrader 4 (Statement)"
	}
	return "MetaTrader 5 (Trade History Report)"
}

func (st *MTStatement) RowCount() int { return len(st.rows) }

// SampleRows exposes the raw trade-table rows keyed by header for preview.
func (st *MTStatement) SampleRows(limit int) []map[string]string {
	if limit > len(st.rows) {
		limit = len(st.rows)
	}
	out := make([]map[string]string, 0, limit)
	for _, row := range st.rows[:limit] {
		m := map[string]string{}
		for i, h := range st.Headers {
			if i < len(row) {
				m[h] = row[i]
			}
		}
		out = append(out, m)
	}
	return out
}

// Parse maps the trade table onto executions. sourceTZ is the IANA zone the
// report's offset-less timestamps were written in; empty falls back to the
// MetaTrader server-time convention (MTServerTZ), never UTC.
func (st *MTStatement) Parse(sourceTZ string) ParseResult {
	tz := sourceTZ
	if strings.TrimSpace(tz) == "" {
		tz = MTServerTZ
	}
	loc, err := time.LoadLocation(tz)
	if err != nil {
		loc, _ = time.LoadLocation(MTServerTZ)
	}
	var res ParseResult
	res.Format = "executions"
	if st.Platform == "mt4" {
		st.parseMT4(loc, &res)
	} else {
		st.parseMT5(loc, &res)
	}
	return res
}

// --- table location ---------------------------------------------------------

func mtFromGrid(grid [][]string) (*MTStatement, bool) {
	for i, row := range grid {
		norm := make([]string, len(row))
		for j, c := range row {
			norm[j] = strings.ToLower(strings.Join(strings.Fields(c), " "))
		}
		has := func(name string) bool {
			for _, c := range norm {
				if c == name {
					return true
				}
			}
			return false
		}
		switch {
		// MT5 Deals header: "Deal" only appears in the deals section
		// (Positions has "Position", Orders has "Order").
		case has("deal") && has("time") && has("symbol") && has("volume"):
			st := &MTStatement{Platform: "mt5", Headers: headerRow(row, false)}
			st.rows = collectMTRows(grid[i+1:], len(st.Headers), isMTDateTime)
			return st, len(st.rows) > 0
		// MT4 Closed Transactions header carries both Open Time and Close Time.
		case has("ticket") && has("open time") && has("close time"):
			st := &MTStatement{Platform: "mt4", Headers: headerRow(row, true)}
			st.rows = collectMTRows(grid[i+1:], len(st.Headers), isAllDigits)
			return st, len(st.rows) > 0
		}
	}
	return nil, false
}

// headerRow trims cells; renamePricePair renames MT4's duplicate "Price"
// columns so rows can be keyed by header (open price first, close second).
// MT5's Deals table has a single "Price" column that must keep its name.
func headerRow(row []string, renamePricePair bool) []string {
	out := make([]string, 0, len(row))
	seenPrice := false
	for _, c := range row {
		h := strings.Join(strings.Fields(c), " ")
		if renamePricePair && strings.EqualFold(h, "price") {
			if seenPrice {
				h = "Close Price"
			} else {
				h = "Open Price"
				seenPrice = true
			}
		}
		out = append(out, h)
	}
	return out
}

// collectMTRows takes data rows until the first row whose leading cell fails
// isData — the summary/next-section boundary in both report layouts.
func collectMTRows(rows [][]string, width int, isData func(string) bool) [][]string {
	var out [][]string
	for _, row := range rows {
		if len(row) == 0 || !isData(strings.TrimSpace(row[0])) {
			break
		}
		padded := make([]string, width)
		for i := 0; i < width && i < len(row); i++ {
			padded[i] = strings.TrimSpace(row[i])
		}
		out = append(out, padded)
	}
	return out
}

func isAllDigits(s string) bool {
	if s == "" {
		return false
	}
	for i := 0; i < len(s); i++ {
		if s[i] < '0' || s[i] > '9' {
			return false
		}
	}
	return true
}

func isMTDateTime(s string) bool {
	_, err := parseMTTime(s, time.UTC)
	return err == nil
}

// --- MT5 deals --------------------------------------------------------------

// parseMT5 maps each buy/sell deal to one fill. Balance operations (deposit,
// credit, correction…) are not fills and are skipped without error; rows with
// a broken time/volume/price fail soft into RowError.
func (st *MTStatement) parseMT5(loc *time.Location, res *ParseResult) {
	col := mtColumnIndex(st.Headers)
	for i, row := range st.rows {
		cell := func(name string) string { return mtCell(row, col, name) }
		side := ParseSideToken(cell("type"))
		if side == "" || strings.Contains(strings.ToLower(cell("type")), " ") {
			continue // balance / credit / correction / cancelled order types
		}
		symbol := strings.ToUpper(cell("symbol"))
		if symbol == "" {
			res.Errors = append(res.Errors, RowError{Row: i + 1, Message: "missing symbol"})
			continue
		}
		ts, err := parseMTTime(cell("time"), loc)
		if err != nil {
			res.Errors = append(res.Errors, RowError{Row: i + 1, Message: fmt.Sprintf("invalid time %q", cell("time"))})
			continue
		}
		volume, err := parseMTNumber(cell("volume"))
		if err != nil || volume <= 0 {
			res.Errors = append(res.Errors, RowError{Row: i + 1, Message: fmt.Sprintf("invalid volume %q", cell("volume"))})
			continue
		}
		price, err := parseMTNumber(cell("price"))
		if err != nil || price <= 0 {
			res.Errors = append(res.Errors, RowError{Row: i + 1, Message: fmt.Sprintf("invalid price %q", cell("price"))})
			continue
		}
		instrument, mult := mtInstrument(symbol)
		// Swap (and any Fee column) stays in Fees so commission remains its
		// own line — the two are distinct costs on a MetaTrader account.
		commission := math.Abs(mtMoney(cell("commission")))
		fees := math.Abs(mtMoney(cell("swap"))) + math.Abs(mtMoney(cell("fee")))
		res.Executions = append(res.Executions, ParsedExecution{
			ExternalID:     cell("deal"),
			Symbol:         symbol,
			InstrumentType: instrument,
			Side:           side,
			Quantity:       volume,
			Price:          price,
			Commission:     commission,
			Fees:           fees,
			ExecutedAt:     ts,
			Multiplier:     mult,
		})
	}
}

// --- MT4 closed transactions -------------------------------------------------

// parseMT4 synthesizes an open+close fill pair per closed transaction. Balance
// rows and cancelled pending orders ("buy limit", "sell stop"…) are skipped;
// rows with broken fields fail soft into RowError. The pair shares a LotKey so
// overlapping same-symbol positions regroup into separate trades.
func (st *MTStatement) parseMT4(loc *time.Location, res *ParseResult) {
	col := mtColumnIndex(st.Headers)
	for i, row := range st.rows {
		cell := func(name string) string { return mtCell(row, col, name) }
		typ := strings.ToLower(cell("type"))
		if typ != "buy" && typ != "sell" {
			continue // balance / credit rows, cancelled pending orders
		}
		symbol := strings.ToUpper(cell("item"))
		if symbol == "" {
			symbol = strings.ToUpper(cell("symbol"))
		}
		if symbol == "" {
			res.Errors = append(res.Errors, RowError{Row: i + 1, Message: "missing symbol"})
			continue
		}
		size, err := parseMTNumber(cell("size"))
		if err != nil || size <= 0 {
			res.Errors = append(res.Errors, RowError{Row: i + 1, Message: fmt.Sprintf("invalid size %q", cell("size"))})
			continue
		}
		openAt, err := parseMTTime(cell("open time"), loc)
		if err != nil {
			res.Errors = append(res.Errors, RowError{Row: i + 1, Message: fmt.Sprintf("invalid open time %q", cell("open time"))})
			continue
		}
		closeAt, err := parseMTTime(cell("close time"), loc)
		if err != nil {
			res.Errors = append(res.Errors, RowError{Row: i + 1, Message: fmt.Sprintf("invalid close time %q", cell("close time"))})
			continue
		}
		openPrice, err := parseMTNumber(cell("open price"))
		if err != nil || openPrice <= 0 {
			res.Errors = append(res.Errors, RowError{Row: i + 1, Message: fmt.Sprintf("invalid open price %q", cell("open price"))})
			continue
		}
		closePrice, err := parseMTNumber(cell("close price"))
		if err != nil || closePrice <= 0 {
			res.Errors = append(res.Errors, RowError{Row: i + 1, Message: fmt.Sprintf("invalid close price %q", cell("close price"))})
			continue
		}
		closeSide := "sell"
		if typ == "sell" {
			closeSide = "buy"
		}
		ticket := cell("ticket")
		instrument, mult := mtInstrument(symbol)
		lot := "mt4-" + ticket
		open := ParsedExecution{
			ExternalID: ticket + "-open", Symbol: symbol, InstrumentType: instrument,
			Side: typ, Quantity: size, Price: openPrice, ExecutedAt: openAt,
			Multiplier: mult, LotKey: lot,
		}
		// Costs ride the closing fill: swap accrues over the position's life
		// and MT4 reports commission once per round-trip. Taxes join swap in
		// Fees so commission stays its own line.
		closeFill := ParsedExecution{
			ExternalID: ticket + "-close", Symbol: symbol, InstrumentType: instrument,
			Side: closeSide, Quantity: size, Price: closePrice, ExecutedAt: closeAt,
			Multiplier: mult, LotKey: lot,
			Commission: math.Abs(mtMoney(cell("commission"))),
			Fees:       math.Abs(mtMoney(cell("swap"))) + math.Abs(mtMoney(cell("taxes"))),
		}
		res.Executions = append(res.Executions, open, closeFill)
	}
}

// --- cell helpers ------------------------------------------------------------

func mtColumnIndex(headers []string) map[string]int {
	idx := map[string]int{}
	for i, h := range headers {
		key := strings.ToLower(strings.Join(strings.Fields(h), " "))
		if _, dup := idx[key]; !dup {
			idx[key] = i
		}
	}
	return idx
}

func mtCell(row []string, col map[string]int, name string) string {
	i, ok := col[name]
	if !ok || i >= len(row) {
		return ""
	}
	return strings.TrimSpace(row[i])
}

// parseMTNumber reads MetaTrader-formatted numbers: space (incl. NBSP) or
// comma thousands separators, plain minus sign.
func parseMTNumber(s string) (float64, error) {
	clean := strings.Map(func(r rune) rune {
		switch r {
		case ' ', '\u00a0', '\u202f', ',':
			return -1
		}
		return r
	}, strings.TrimSpace(s))
	if clean == "" {
		return 0, fmt.Errorf("empty")
	}
	return strconv.ParseFloat(clean, 64)
}

// mtMoney is parseMTNumber for optional money cells: blank or absent is 0.
func mtMoney(s string) float64 {
	v, err := parseMTNumber(s)
	if err != nil {
		return 0
	}
	return v
}

// parseMTTime reads MetaTrader timestamps ("2024.01.15 10:30:45") as wall
// time in loc. XLSX exports may store times as Excel date serials instead.
func parseMTTime(s string, loc *time.Location) (time.Time, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return time.Time{}, fmt.Errorf("empty")
	}
	for _, layout := range []string{
		"2006.01.02 15:04:05",
		"2006.01.02 15:04",
		"2006-01-02 15:04:05",
		"2006-01-02 15:04",
	} {
		if t, err := time.ParseInLocation(layout, s, loc); err == nil {
			return t.UTC(), nil
		}
	}
	// Excel serial (days since 1899-12-30) in the plausible statement range
	// (1982–2064): the serial encodes a wall-clock reading, so rebuild it in loc.
	if f, err := strconv.ParseFloat(s, 64); err == nil && f > 30000 && f < 60000 {
		base := time.Date(1899, 12, 30, 0, 0, 0, 0, time.UTC)
		d := base.Add(time.Duration(math.Round(f*86400)) * time.Second)
		wall := time.Date(d.Year(), d.Month(), d.Day(), d.Hour(), d.Minute(), d.Second(), 0, loc)
		return wall.UTC(), nil
	}
	return time.Time{}, fmt.Errorf("unrecognized time")
}

// --- instrument classification -----------------------------------------------

var mtCurrencyCodes = map[string]bool{
	"USD": true, "EUR": true, "GBP": true, "JPY": true, "CHF": true,
	"AUD": true, "NZD": true, "CAD": true, "SGD": true, "HKD": true,
	"NOK": true, "SEK": true, "DKK": true, "PLN": true, "ZAR": true,
	"MXN": true, "TRY": true, "CNH": true, "CNY": true, "HUF": true,
	"CZK": true, "RUB": true, "THB": true,
}

var mtCryptoBases = map[string]bool{
	"BTC": true, "ETH": true, "XRP": true, "LTC": true, "DOGE": true,
	"SOL": true, "ADA": true, "BNB": true, "DOT": true, "BCH": true,
}

// mtInstrument classifies a MetaTrader symbol and picks the per-lot contract
// size as the Multiplier (statements carry volume in lots, not units).
// Standard conventions: FX 100k units, gold 100 oz, silver 5k oz; everything
// else (indices, share/crypto CFDs) trades 1 unit per lot. Broker suffixes
// ("EURUSD.m", "XAUUSD#") are stripped for classification only.
func mtInstrument(symbol string) (instrumentType string, multiplier float64) {
	s := strings.ToUpper(strings.TrimSpace(symbol))
	s = strings.ReplaceAll(s, "/", "")
	if i := strings.IndexAny(s, ".#-_ "); i > 0 {
		s = s[:i]
	}
	switch {
	case strings.HasPrefix(s, "XAU"):
		return "cfd", 100
	case strings.HasPrefix(s, "XAG"):
		return "cfd", 5000
	case len(s) >= 6 && mtCurrencyCodes[s[:3]] && mtCurrencyCodes[s[3:6]]:
		return "forex", 100000
	case len(s) >= 3 && mtCryptoBases[s[:3]] || len(s) >= 4 && mtCryptoBases[s[:4]]:
		return "crypto", 1
	default:
		return "cfd", 1
	}
}

// --- HTML table extraction ----------------------------------------------------

// htmlTableRows flattens every <tr> in the document (MetaTrader reports are a
// single flat table) into trimmed cell texts, in document order.
func htmlTableRows(data []byte) ([][]string, error) {
	doc, err := html.Parse(bytes.NewReader(decodeUTF16IfBOM(data)))
	if err != nil {
		return nil, err
	}
	var rows [][]string
	var walk func(*html.Node)
	walk = func(n *html.Node) {
		if n.Type == html.ElementNode && n.Data == "tr" {
			var row []string
			for c := n.FirstChild; c != nil; c = c.NextSibling {
				if c.Type == html.ElementNode && (c.Data == "td" || c.Data == "th") {
					row = append(row, strings.Join(strings.Fields(nodeText(c)), " "))
				}
			}
			rows = append(rows, row)
			return
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			walk(c)
		}
	}
	walk(doc)
	return rows, nil
}

func nodeText(n *html.Node) string {
	var b strings.Builder
	var walk func(*html.Node)
	walk = func(n *html.Node) {
		if n.Type == html.TextNode {
			b.WriteString(n.Data)
			b.WriteByte(' ')
			return
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			walk(c)
		}
	}
	walk(n)
	return strings.ReplaceAll(b.String(), " ", " ")
}

// decodeUTF16IfBOM converts UTF-16 (either endianness, BOM-marked) to UTF-8;
// MT4 terminals on some locales save statements as UTF-16.
func decodeUTF16IfBOM(data []byte) []byte {
	if len(data) < 2 || len(data)%2 != 0 {
		return data
	}
	le := data[0] == 0xFF && data[1] == 0xFE
	be := data[0] == 0xFE && data[1] == 0xFF
	if !le && !be {
		return data
	}
	u16 := make([]uint16, 0, (len(data)-2)/2)
	for i := 2; i+1 < len(data); i += 2 {
		if le {
			u16 = append(u16, uint16(data[i])|uint16(data[i+1])<<8)
		} else {
			u16 = append(u16, uint16(data[i])<<8|uint16(data[i+1]))
		}
	}
	return []byte(string(utf16.Decode(u16)))
}
