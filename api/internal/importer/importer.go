package importer

import "time"

// ParsedExecution is a broker-agnostic fill produced by an Importer.
type ParsedExecution struct {
	ExternalID     string
	Symbol         string
	InstrumentType string
	OptionRight    string // call|put when instrument is option
	Side           string // buy|sell
	Quantity       float64
	Price          float64
	Fees           float64
	Commission     float64
	ExecutedAt     time.Time
	Multiplier     float64 // 1 stock, 100 option; 0 means "default to 1"
	// LotKey isolates overlapping same-symbol round-trips (journal imports).
	// Stored in executions.details as {"lot":"..."}.
	LotKey string
	// Annotation is set on the opening fill of a journal-trade row so callers
	// can attach journal/tags/setup after regroup (trade id = opening fill id).
	Annotation *TradeAnnotation
}

// TradeAnnotation carries journal metadata from a trade-level CSV row.
type TradeAnnotation struct {
	Notes      string
	SetupName  string
	Confidence *int64
	Target     *float64
	Stop       *float64
	Emotion    string
	Tags       []TagRef
	Dividends  float64
}

// TagRef is a tag to create/attach during journal import.
type TagRef struct {
	Name string
	Kind string // mistake|custom
}

type RowError struct {
	Row     int    `json:"row"`
	Message string `json:"message"`
}

type ParseResult struct {
	Executions []ParsedExecution
	Errors     []RowError
	Format     string // "executions" | "journal_trades"
}

type Importer interface {
	Detect(headers []string) bool
	ParseRows(rows []map[string]string) ParseResult
	Name() string
}

// DefaultMultiplier returns the conventional multiplier for an instrument type.
func DefaultMultiplier(instrumentType string) float64 {
	switch instrumentType {
	case "option":
		return 100
	default:
		return 1
	}
}
