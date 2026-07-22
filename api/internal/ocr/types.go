package ocr

// ExtractedFill is one candidate execution row for the Log Trade form.
type ExtractedFill struct {
	Symbol      string  `json:"symbol,omitempty"`
	Side        string  `json:"side"` // buy | sell
	Quantity    float64 `json:"quantity"`
	Price       float64 `json:"price"`
	Fees        float64 `json:"fees"`
	Commission  float64 `json:"commission"`
	ExecutedAt  string  `json:"executed_at"`            // RFC3339 when known; empty otherwise
	OptionRight string  `json:"option_right,omitempty"` // call | put
	Strike      float64 `json:"strike,omitempty"`
	Expiry      string  `json:"expiry,omitempty"` // YYYY-MM-DD
}

// TradeExtract is the structured OCR result returned by POST /ocr/parse.
type TradeExtract struct {
	Symbol         string          `json:"symbol"`
	InstrumentType string          `json:"instrument_type"`
	Side           string          `json:"side"` // long | short when inferred
	Confidence     float64         `json:"confidence"`
	RawText        string          `json:"raw_text"`
	Rows           []ExtractedFill `json:"rows"`
	Warnings       []string        `json:"warnings"`
	// Symbols lists every ticker found when a screenshot spans multiple underlyings.
	Symbols []string `json:"symbols,omitempty"`
}
