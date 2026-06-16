package importer

import "time"

// ParsedExecution is a broker-agnostic fill produced by an Importer.
type ParsedExecution struct {
	ExternalID     string
	Symbol         string
	InstrumentType string
	Side           string // buy|sell
	Quantity       float64
	Price          float64
	Fees           float64
	Commission     float64
	ExecutedAt     time.Time
}

type RowError struct {
	Row     int    `json:"row"`
	Message string `json:"message"`
}

type ParseResult struct {
	Executions []ParsedExecution
	Errors     []RowError
}

type Importer interface {
	Detect(headers []string) bool
	ParseRows(rows []map[string]string) ParseResult
	Name() string
}
