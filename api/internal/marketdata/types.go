package marketdata

import "time"

// Bar is one OHLCV candle normalized for charting.
type Bar struct {
	Time   int64   `json:"time"` // Unix seconds (UTC)
	Open   float64 `json:"open"`
	High   float64 `json:"high"`
	Low    float64 `json:"low"`
	Close  float64 `json:"close"`
	Volume float64 `json:"volume"`
}

// Request describes a bar fetch window.
type Request struct {
	Symbol         string
	InstrumentType string
	Interval       string // 1, 5, 15, 30, 60, 240, D, W, M
	From           time.Time
	To             time.Time
}

// Response is returned by GET /market/bars.
type Response struct {
	Symbol   string `json:"symbol"`
	Interval string `json:"interval"`
	From     string `json:"from"`
	To       string `json:"to"`
	Provider string `json:"provider"`
	Cached   bool   `json:"cached"`
	Bars     []Bar  `json:"bars"`
}
