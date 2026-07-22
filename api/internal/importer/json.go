package importer

import (
	"encoding/json"
	"fmt"
	"math"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
)

// JSONImport bundles a parsed JSON upload for preview/commit.
type JSONImport struct {
	Format  string
	Headers []string
	Rows    []map[string]string
	Result  ParseResult
	Account *JSONAccountMeta
	Cash    []JSONCashTx
	Setups  []JSONSetup
}

// JSONSetup is a playbook setup from a TraderMemos JSON export catalog.
type JSONSetup struct {
	Name        string
	Description string
	Thesis      string
	Symbol      string
	Direction   string
	TargetPrice *float64
	StopPrice   *float64
	Checklist   []string
}

// JSONAccountMeta is optional account metadata from a TraderMemos JSON export.
type JSONAccountMeta struct {
	Name            string
	Broker          string
	AccountType     string
	BaseCurrency    string
	StartingBalance *float64
}

// JSONCashTx is a standalone cash movement from a TraderMemos JSON export.
type JSONCashTx struct {
	Type       string
	Amount     float64
	Currency   string
	OccurredAt time.Time
	Note       string
}

// IsJSONFilename reports whether the upload looks like JSON by extension.
func IsJSONFilename(name string) bool {
	return strings.HasSuffix(strings.ToLower(strings.TrimSpace(name)), ".json")
}

// ParseJSONImport parses TraderMemos export JSON or journal row arrays.
func ParseJSONImport(data []byte) (JSONImport, error) {
	data = bytesTrimSpace(data)
	if len(data) == 0 {
		return JSONImport{}, fmt.Errorf("empty json")
	}

	var root map[string]json.RawMessage
	if err := json.Unmarshal(data, &root); err == nil && len(root) > 0 {
		accountMeta := parseJSONAccountMeta(root)
		cash := parseJSONCashTransactions(root)
		setups := parseJSONSetups(root)

		if raw, ok := root["trades"]; ok && len(raw) > 2 {
			out, err := parseJSONTradesWrapper(raw)
			if err != nil {
				return JSONImport{}, err
			}
			out.Account = accountMeta
			out.Cash = cash
			out.Setups = setups
			return out, nil
		}
		if raw, ok := root["executions"]; ok && len(raw) > 2 {
			out, err := parseJSONExecutionsWrapper(raw)
			if err != nil {
				return JSONImport{}, err
			}
			out.Account = accountMeta
			out.Cash = cash
			out.Setups = setups
			return out, nil
		}
		if accountMeta != nil || len(cash) > 0 || len(setups) > 0 {
			return JSONImport{
				Format:  "account_backup",
				Account: accountMeta,
				Cash:    cash,
				Setups:  setups,
				Result:  ParseResult{Format: "account_backup", Errors: []RowError{}},
			}, nil
		}
	}
	var arr []json.RawMessage
	if err := json.Unmarshal(data, &arr); err == nil && len(arr) > 0 {
		return parseJSONArray(arr)
	}

	return JSONImport{}, fmt.Errorf("unrecognized json import format")
}

func parseJSONAccountMeta(root map[string]json.RawMessage) *JSONAccountMeta {
	meta := &JSONAccountMeta{}
	found := false

	if raw, ok := root["account"]; ok && len(raw) > 2 {
		var nested struct {
			Name            string   `json:"name"`
			Broker          string   `json:"broker"`
			AccountType     string   `json:"account_type"`
			BaseCurrency    string   `json:"base_currency"`
			StartingBalance *float64 `json:"starting_balance"`
		}
		if err := json.Unmarshal(raw, &nested); err == nil {
			meta.Name = strings.TrimSpace(nested.Name)
			meta.Broker = strings.TrimSpace(nested.Broker)
			meta.AccountType = strings.TrimSpace(nested.AccountType)
			meta.BaseCurrency = strings.TrimSpace(nested.BaseCurrency)
			meta.StartingBalance = nested.StartingBalance
			found = meta.Name != "" || meta.Broker != "" || meta.AccountType != "" ||
				meta.BaseCurrency != "" || meta.StartingBalance != nil
		}
	}

	// Legacy flat fields on the export root.
	if raw, ok := root["account_name"]; ok {
		var name string
		if err := json.Unmarshal(raw, &name); err == nil {
			name = strings.TrimSpace(name)
			if name != "" && meta.Name == "" {
				meta.Name = name
				found = true
			}
		}
	}
	if raw, ok := root["broker"]; ok {
		var broker string
		if err := json.Unmarshal(raw, &broker); err == nil {
			broker = strings.TrimSpace(broker)
			if broker != "" && meta.Broker == "" {
				meta.Broker = broker
				found = true
			}
		}
	}

	if !found {
		return nil
	}
	return meta
}

func parseJSONSetups(root map[string]json.RawMessage) []JSONSetup {
	raw, ok := root["setups"]
	if !ok || len(raw) < 3 {
		return nil
	}
	var items []struct {
		Name        string   `json:"name"`
		Description string   `json:"description"`
		Thesis      string   `json:"thesis"`
		Symbol      string   `json:"symbol"`
		Direction   string   `json:"direction"`
		TargetPrice *float64 `json:"target_price"`
		StopPrice   *float64 `json:"stop_price"`
		Checklist   []string `json:"checklist"`
	}
	if err := json.Unmarshal(raw, &items); err != nil {
		return nil
	}
	out := make([]JSONSetup, 0, len(items))
	for _, item := range items {
		name := strings.TrimSpace(item.Name)
		if name == "" {
			continue
		}
		dir := strings.ToLower(strings.TrimSpace(item.Direction))
		if dir != "long" && dir != "short" {
			dir = ""
		}
		checklist := item.Checklist
		if checklist == nil {
			checklist = []string{}
		}
		out = append(out, JSONSetup{
			Name: name, Description: strings.TrimSpace(item.Description),
			Thesis: strings.TrimSpace(item.Thesis), Symbol: strings.TrimSpace(item.Symbol),
			Direction: dir, TargetPrice: item.TargetPrice, StopPrice: item.StopPrice,
			Checklist: checklist,
		})
	}
	return out
}

func parseJSONCashTransactions(root map[string]json.RawMessage) []JSONCashTx {
	raw, ok := root["cash_transactions"]
	if !ok || len(raw) < 3 {
		return nil
	}
	var items []struct {
		Type       string    `json:"type"`
		Amount     float64   `json:"amount"`
		Currency   string    `json:"currency"`
		OccurredAt time.Time `json:"occurred_at"`
		Note       string    `json:"note"`
	}
	if err := json.Unmarshal(raw, &items); err != nil {
		return nil
	}
	out := make([]JSONCashTx, 0, len(items))
	for _, item := range items {
		typ := strings.ToLower(strings.TrimSpace(item.Type))
		if typ == "" || item.OccurredAt.IsZero() {
			continue
		}
		cur := strings.TrimSpace(item.Currency)
		if cur == "" {
			cur = "USD"
		}
		out = append(out, JSONCashTx{
			Type: typ, Amount: item.Amount, Currency: cur,
			OccurredAt: item.OccurredAt, Note: strings.TrimSpace(item.Note),
		})
	}
	return out
}

func parseJSONArray(items []json.RawMessage) (JSONImport, error) {
	var probe map[string]any
	if err := json.Unmarshal(items[0], &probe); err != nil {
		return JSONImport{}, err
	}
	if looksLikeJournalRow(probe) {
		rows := make([]map[string]string, 0, len(items))
		for _, raw := range items {
			var obj map[string]any
			if err := json.Unmarshal(raw, &obj); err != nil {
				return JSONImport{}, err
			}
			rows = append(rows, jsonObjectToRow(obj))
		}
		parsed := NewJournal().ParseRows(rows)
		parsed.Format = "journal_trades"
		return JSONImport{
			Format:  "journal_trades",
			Headers: journalHeadersFromRows(rows),
			Rows:    rows,
			Result:  parsed,
		}, nil
	}
	if looksLikeTradeObject(probe) {
		trades := make([]jsonTrade, 0, len(items))
		for i, raw := range items {
			var t jsonTrade
			if err := json.Unmarshal(raw, &t); err != nil {
				return JSONImport{}, fmt.Errorf("trade %d: %w", i+1, err)
			}
			trades = append(trades, t)
		}
		return buildJSONTradesImport(trades)
	}
	if looksLikeExecutionObject(probe) {
		execs := make([]jsonExecution, 0, len(items))
		for i, raw := range items {
			var e jsonExecution
			if err := json.Unmarshal(raw, &e); err != nil {
				return JSONImport{}, fmt.Errorf("execution %d: %w", i+1, err)
			}
			execs = append(execs, e)
		}
		return buildJSONExecutionsImport(execs)
	}
	return JSONImport{}, fmt.Errorf("unrecognized json array item shape")
}

func parseJSONTradesWrapper(raw json.RawMessage) (JSONImport, error) {
	var trades []jsonTrade
	if err := json.Unmarshal(raw, &trades); err != nil {
		return JSONImport{}, err
	}
	if len(trades) == 0 {
		return JSONImport{}, fmt.Errorf("trades array is empty")
	}
	return buildJSONTradesImport(trades)
}

func parseJSONExecutionsWrapper(raw json.RawMessage) (JSONImport, error) {
	var execs []jsonExecution
	if err := json.Unmarshal(raw, &execs); err != nil {
		return JSONImport{}, err
	}
	if len(execs) == 0 {
		return JSONImport{}, fmt.Errorf("executions array is empty")
	}
	return buildJSONExecutionsImport(execs)
}

func buildJSONTradesImport(trades []jsonTrade) (JSONImport, error) {
	res := ParseResult{Format: "journal_trades"}
	rows := make([]map[string]string, 0, len(trades))
	for i, t := range trades {
		exs, ann, row, err := tradeToJournal(t, i+1)
		if err != nil {
			res.Errors = append(res.Errors, RowError{Row: i + 1, Message: err.Error()})
			continue
		}
		if len(exs) == 0 {
			continue
		}
		lot := uuid.NewString()
		for j := range exs {
			exs[j].LotKey = lot
		}
		exs[0].Annotation = ann
		res.Executions = append(res.Executions, exs...)
		if row != nil {
			rows = append(rows, row)
		}
	}
	if len(rows) == 0 && len(res.Executions) == 0 && len(res.Errors) == 0 {
		return JSONImport{}, fmt.Errorf("no importable trades in json")
	}
	return JSONImport{
		Format:  "journal_trades",
		Headers: journalHeadersFromRows(rows),
		Rows:    rows,
		Result:  res,
	}, nil
}

func buildJSONExecutionsImport(execs []jsonExecution) (JSONImport, error) {
	res := ParseResult{Format: "executions"}
	headers := []string{"symbol", "side", "quantity", "price", "executed_at", "instrument_type", "fees", "commission"}
	rows := make([]map[string]string, 0, len(execs))
	for i, e := range execs {
		pe, err := jsonExecutionToParsed(e)
		if err != nil {
			res.Errors = append(res.Errors, RowError{Row: i + 1, Message: err.Error()})
			continue
		}
		res.Executions = append(res.Executions, pe)
		rows = append(rows, map[string]string{
			"symbol": e.Symbol, "side": e.Side,
			"quantity": formatFloat(e.Quantity), "price": formatFloat(e.Price),
			"executed_at": e.ExecutedAt.UTC().Format(time.RFC3339),
			"instrument_type": e.InstrumentType,
			"fees": formatFloat(e.Fees), "commission": formatFloat(e.Commission),
		})
	}
	if len(res.Executions) == 0 && len(res.Errors) == 0 {
		return JSONImport{}, fmt.Errorf("no importable executions in json")
	}
	return JSONImport{
		Format:  "executions",
		Headers: headers,
		Rows:    rows,
		Result:  res,
	}, nil
}

type jsonTag struct {
	Name string `json:"name"`
	Kind string `json:"kind"`
}

type jsonSetup struct {
	Name string `json:"name"`
}

type jsonExecution struct {
	Symbol         string            `json:"symbol"`
	Side           string            `json:"side"`
	Quantity       float64           `json:"quantity"`
	Price          float64           `json:"price"`
	ExecutedAt     time.Time         `json:"executed_at"`
	InstrumentType string            `json:"instrument_type"`
	Fees           float64           `json:"fees"`
	Commission     float64           `json:"commission"`
	Multiplier     float64           `json:"multiplier"`
	Details        map[string]string `json:"details"`
}

type jsonTrade struct {
	Symbol         string          `json:"symbol"`
	InstrumentType string          `json:"instrument_type"`
	Direction      string          `json:"direction"`
	Status         string          `json:"status"`
	OpenedAt       time.Time       `json:"opened_at"`
	ClosedAt       *time.Time      `json:"closed_at"`
	QtyOpened      float64         `json:"qty_opened"`
	AvgEntryPrice  float64         `json:"avg_entry_price"`
	AvgExitPrice   *float64        `json:"avg_exit_price"`
	NetPnl         *float64        `json:"net_pnl"`
	FeesTotal      float64         `json:"fees_total"`
	Notes          string          `json:"notes"`
	EmotionalState string          `json:"emotional_state"`
	Confidence     *int64          `json:"confidence"`
	TargetPrice    *float64        `json:"target_price"`
	StopPrice      *float64        `json:"stop_price"`
	DividendTotal  float64         `json:"dividend_total"`
	Tags           []jsonTag       `json:"tags"`
	Setup          *jsonSetup      `json:"setup"`
	Fills          []jsonExecution `json:"fills"`
}

func tradeToJournal(t jsonTrade, rowNum int) ([]ParsedExecution, *TradeAnnotation, map[string]string, error) {
	if strings.TrimSpace(t.Symbol) == "" {
		return nil, nil, nil, fmt.Errorf("missing symbol")
	}
	ann := tradeAnnotation(t)
	if len(t.Fills) > 0 {
		exs, err := fillsToParsed(t.Fills, t.InstrumentType)
		if err != nil {
			return nil, nil, nil, err
		}
		if len(exs) == 0 {
			return nil, nil, nil, fmt.Errorf("no fills")
		}
		sort.Slice(exs, func(i, j int) bool {
			return exs[i].ExecutedAt.Before(exs[j].ExecutedAt)
		})
		return exs, ann, tradeToJournalRow(t, exs), nil
	}
	if t.ClosedAt == nil || t.AvgExitPrice == nil || t.QtyOpened <= 0 || t.AvgEntryPrice <= 0 {
		return nil, nil, nil, fmt.Errorf("closed trade missing exit data")
	}
	instrument := t.InstrumentType
	if instrument == "" {
		instrument = ParseInstrumentType("", t.Symbol)
	}
	mult := DefaultMultiplier(instrument)
	direction := strings.ToLower(strings.TrimSpace(t.Direction))
	if direction == "" {
		direction = "long"
	}
	entrySide, exitSide := "buy", "sell"
	if direction == "short" {
		entrySide, exitSide = "sell", "buy"
	}
	entryComm, exitComm := splitFees(t.FeesTotal)
	exs := []ParsedExecution{
		{
			Symbol: t.Symbol, InstrumentType: instrument, Side: entrySide,
			Quantity: t.QtyOpened, Price: t.AvgEntryPrice, Commission: entryComm,
			ExecutedAt: t.OpenedAt.UTC(), Multiplier: mult,
		},
		{
			Symbol: t.Symbol, InstrumentType: instrument, Side: exitSide,
			Quantity: t.QtyOpened, Price: *t.AvgExitPrice, Commission: exitComm,
			ExecutedAt: t.ClosedAt.UTC(), Multiplier: mult,
		},
	}
	return exs, ann, tradeToJournalRow(t, exs), nil
}

func fillsToParsed(fills []jsonExecution, fallbackInstrument string) ([]ParsedExecution, error) {
	out := make([]ParsedExecution, 0, len(fills))
	for _, f := range fills {
		pe, err := jsonExecutionToParsed(f)
		if err != nil {
			return nil, err
		}
		if pe.InstrumentType == "" {
			pe.InstrumentType = ParseInstrumentType(fallbackInstrument, pe.Symbol)
		}
		out = append(out, pe)
	}
	return out, nil
}

func jsonExecutionToParsed(e jsonExecution) (ParsedExecution, error) {
	symbol := strings.TrimSpace(e.Symbol)
	if symbol == "" {
		return ParsedExecution{}, fmt.Errorf("missing symbol")
	}
	side := strings.ToLower(strings.TrimSpace(e.Side))
	switch side {
	case "buy", "b", "bot":
		side = "buy"
	case "sell", "s", "sld":
		side = "sell"
	default:
		return ParsedExecution{}, fmt.Errorf("invalid side %q", e.Side)
	}
	if e.Quantity <= 0 {
		return ParsedExecution{}, fmt.Errorf("invalid quantity")
	}
	if e.Price <= 0 {
		return ParsedExecution{}, fmt.Errorf("invalid price")
	}
	if e.ExecutedAt.IsZero() {
		return ParsedExecution{}, fmt.Errorf("missing executed_at")
	}
	instrument := e.InstrumentType
	if instrument == "" {
		instrument = ParseInstrumentType("", symbol)
	}
	mult := e.Multiplier
	if mult == 0 {
		mult = DefaultMultiplier(instrument)
	}
	pe := ParsedExecution{
		Symbol: symbol, InstrumentType: instrument, Side: side,
		Quantity: e.Quantity, Price: e.Price, Fees: e.Fees, Commission: e.Commission,
		ExecutedAt: e.ExecutedAt.UTC(), Multiplier: mult,
	}
	if e.Details != nil {
		if right := ParseOptionRight(e.Details["option_right"]); right != "" {
			pe.OptionRight = right
		}
	}
	if pe.OptionRight == "" && instrument == "option" {
		pe.OptionRight = InferOptionRight(symbol)
	}
	return pe, nil
}

func tradeAnnotation(t jsonTrade) *TradeAnnotation {
	setupName := ""
	if t.Setup != nil {
		setupName = strings.TrimSpace(t.Setup.Name)
	}
	tags := make([]TagRef, 0, len(t.Tags))
	for _, tg := range t.Tags {
		if strings.EqualFold(tg.Kind, "setup") {
			if setupName == "" {
				setupName = strings.TrimSpace(tg.Name)
			}
			continue
		}
		tags = append(tags, TagRef{Name: strings.TrimSpace(tg.Name), Kind: strings.TrimSpace(tg.Kind)})
	}
	return &TradeAnnotation{
		Notes: strings.TrimSpace(t.Notes), SetupName: setupName,
		Confidence: t.Confidence, Target: t.TargetPrice, Stop: t.StopPrice,
		Emotion: strings.TrimSpace(t.EmotionalState), Tags: tags,
		Dividends: t.DividendTotal,
	}
}

func tradeToJournalRow(t jsonTrade, exs []ParsedExecution) map[string]string {
	if len(exs) == 0 {
		return nil
	}
	entry := exs[0]
	exit := exs[len(exs)-1]
	mult := entry.Multiplier
	if mult == 0 {
		mult = 1
	}
	entryTotal := entry.Quantity * entry.Price * mult
	exitTotal := exit.Quantity * exit.Price * mult
	retUSD := 0.0
	if t.NetPnl != nil {
		retUSD = *t.NetPnl
	}
	retPct := 0.0
	if entryTotal > 0 {
		retPct = (retUSD / entryTotal) * 100
	}
	status := "BE"
	if retUSD > 0 {
		status = "WIN"
	} else if retUSD < 0 {
		status = "LOSS"
	}
	market := "STOCK"
	if entry.InstrumentType == "option" {
		market = "OPTION"
	}
	side := "LONG"
	if strings.EqualFold(t.Direction, "short") {
		side = "SHORT"
	}
	closeAt := exit.ExecutedAt
	if t.ClosedAt != nil {
		closeAt = t.ClosedAt.UTC()
	}
	ann := tradeAnnotation(t)
	tags := formatJournalTagsFromTrade(ann)
	confidence := ""
	if ann.Confidence != nil {
		confidence = strconv.FormatInt(*ann.Confidence, 10)
	}
	target, stop := "", ""
	if ann.Target != nil {
		target = formatFloat(*ann.Target)
	}
	if ann.Stop != nil {
		stop = formatFloat(*ann.Stop)
	}
	return map[string]string{
		"Date":         closeAt.Format("2006-01-02T15:04:05.000Z"),
		"Symbol":       strings.ToUpper(entry.Symbol),
		"Status":       status,
		"Market":       market,
		"Side":         side,
		"Qty":          formatFloat(entry.Quantity),
		"Entry":        formatFloat(entry.Price),
		"Exit":         formatFloat(exit.Price),
		"Entry Total":  formatFloat(entryTotal),
		"Exit Total":   formatFloat(exitTotal),
		"Position":     "0",
		"Return ($)":   formatFloat(retUSD),
		"Return (%)":   formatFloat(math.Round(retPct*100) / 100),
		"Dividends":    formatFloat(ann.Dividends),
		"Open Date":    entry.ExecutedAt.UTC().Format("2006-01-02T15:04:05.000Z"),
		"Tags":         tags,
		"Setup":        ann.SetupName,
		"Confidence":   confidence,
		"Target":       target,
		"Stop":         stop,
		"Notes":        ann.Notes,
	}
}

func formatJournalTagsFromTrade(ann *TradeAnnotation) string {
	if ann == nil {
		return ""
	}
	parts := make([]string, 0, len(ann.Tags)+1)
	for _, tg := range ann.Tags {
		if tg.Name == "" {
			continue
		}
		if tg.Kind == "" || strings.EqualFold(tg.Kind, "custom") {
			parts = append(parts, tg.Name)
		} else {
			parts = append(parts, tg.Kind+":"+tg.Name)
		}
	}
	if ann.Emotion != "" {
		parts = append(parts, "emotion:"+ann.Emotion)
	}
	return strings.Join(parts, "; ")
}

func splitFees(total float64) (entry, exit float64) {
	if total <= 0 {
		return 0, 0
	}
	entry = total / 2
	exit = total - entry
	return entry, exit
}

func looksLikeJournalRow(obj map[string]any) bool {
	return hasKey(obj, "symbol") && hasKey(obj, "entry") && hasKey(obj, "exit") &&
		(hasKey(obj, "open date") || hasKey(obj, "open_date") || hasKey(obj, "opendate"))
}

func looksLikeTradeObject(obj map[string]any) bool {
	return hasKey(obj, "symbol") && (hasKey(obj, "opened_at") || hasKey(obj, "fills") || hasKey(obj, "avg_entry_price"))
}

func looksLikeExecutionObject(obj map[string]any) bool {
	return hasKey(obj, "symbol") && hasKey(obj, "side") && hasKey(obj, "executed_at")
}

func hasKey(obj map[string]any, want string) bool {
	want = strings.ToLower(want)
	for k := range obj {
		if strings.ToLower(k) == want {
			return true
		}
	}
	return false
}

func jsonObjectToRow(obj map[string]any) map[string]string {
	row := make(map[string]string, len(obj))
	for k, v := range obj {
		row[k] = stringifyJSONValue(v)
	}
	return row
}

func stringifyJSONValue(v any) string {
	switch x := v.(type) {
	case nil:
		return ""
	case string:
		return x
	case float64:
		return formatFloat(x)
	case bool:
		return strconv.FormatBool(x)
	default:
		b, err := json.Marshal(x)
		if err != nil {
			return fmt.Sprint(x)
		}
		return string(b)
	}
}

func formatFloat(v float64) string {
	if math.Mod(v, 1) == 0 {
		return strconv.FormatFloat(v, 'f', 0, 64)
	}
	return strconv.FormatFloat(v, 'f', -1, 64)
}

func journalHeadersFromRows(rows []map[string]string) []string {
	if len(rows) == 0 {
		return nil
	}
	seen := map[string]bool{}
	var headers []string
	for _, row := range rows {
		for k := range row {
			if seen[k] {
				continue
			}
			seen[k] = true
			headers = append(headers, k)
		}
	}
	return headers
}

func bytesTrimSpace(b []byte) []byte {
	return []byte(strings.TrimSpace(string(b)))
}
