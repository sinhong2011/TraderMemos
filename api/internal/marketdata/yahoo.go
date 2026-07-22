package marketdata

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

// YahooProvider uses Yahoo Finance chart API (no API key). Suitable for dev and
// self-hosted stock charts; not licensed for commercial redistribution.
type YahooProvider struct {
	Client    *http.Client
	ChartBase string // optional override for tests
}

func NewYahooProvider() *YahooProvider {
	return &YahooProvider{Client: &http.Client{Timeout: 20 * time.Second}}
}

func (p *YahooProvider) chartBase() string {
	if p.ChartBase != "" {
		return strings.TrimRight(p.ChartBase, "/")
	}
	return "https://query1.finance.yahoo.com"
}

func (p *YahooProvider) Name() string { return "yahoo" }

func (p *YahooProvider) FetchBars(ctx context.Context, req Request) ([]Bar, error) {
	symbol := chartSymbol(req)
	interval, err := yahooInterval(req.Interval)
	if err != nil {
		return nil, err
	}
	from := req.From.Unix()
	to := req.To.Unix()
	if to <= from {
		to = from + 3600
	}

	u := fmt.Sprintf(
		"%s/v8/finance/chart/%s?interval=%s&period1=%d&period2=%d&includePrePost=false",
		p.chartBase(),
		url.PathEscape(symbol),
		interval,
		from,
		to,
	)
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("User-Agent", "TraderMemos/1.0")

	resp, err := p.Client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound || resp.StatusCode == http.StatusUnprocessableEntity {
		return []Bar{}, nil
	}
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return nil, fmt.Errorf("yahoo chart: %s: %s", resp.Status, strings.TrimSpace(string(body)))
	}

	var payload yahooChartResponse
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		return nil, err
	}
	if payload.Chart.Error != nil {
		// Unknown or delisted symbols — treat as empty, not a hard failure.
		return []Bar{}, nil
	}
	if len(payload.Chart.Result) == 0 {
		return []Bar{}, nil
	}
	result := payload.Chart.Result[0]
	quotes := result.Indicators.Quote
	if len(quotes) == 0 {
		return []Bar{}, nil
	}
	q := quotes[0]
	bars := make([]Bar, 0, len(result.Timestamp))
	for i, ts := range result.Timestamp {
		o, h, l, c := at(q.Open, i), at(q.High, i), at(q.Low, i), at(q.Close, i)
		if o == nil || h == nil || l == nil || c == nil {
			continue
		}
		vol := 0.0
		if i < len(q.Volume) && q.Volume[i] != nil {
			vol = *q.Volume[i]
		}
		bars = append(bars, Bar{
			Time:   ts,
			Open:   *o,
			High:   *h,
			Low:    *l,
			Close:  *c,
			Volume: vol,
		})
	}
	return bars, nil
}

func chartSymbol(req Request) string {
	sym := strings.ToUpper(strings.TrimSpace(req.Symbol))
	if req.InstrumentType == "option" {
		// Options: chart underlying when symbol looks like OCC (e.g. TSLA250117C00425000).
		if u := occUnderlying(sym); u != "" {
			return u
		}
	}
	return sym
}

func occUnderlying(sym string) string {
	for i, r := range sym {
		if r >= '0' && r <= '9' {
			if i > 0 {
				return sym[:i]
			}
			break
		}
	}
	return ""
}

func yahooInterval(interval string) (string, error) {
	switch interval {
	case "1":
		return "1m", nil
	case "5":
		return "5m", nil
	case "15":
		return "15m", nil
	case "60":
		return "60m", nil
	case "240":
		return "60m", nil // Yahoo has no 4h; closest
	case "D":
		return "1d", nil
	default:
		return "", fmt.Errorf("unsupported interval %q", interval)
	}
}

func at(vals []*float64, i int) *float64 {
	if i >= len(vals) {
		return nil
	}
	return vals[i]
}

type yahooChartResponse struct {
	Chart struct {
		Result []struct {
			Timestamp  []int64 `json:"timestamp"`
			Indicators struct {
				Quote []struct {
					Open   []*float64 `json:"open"`
					High   []*float64 `json:"high"`
					Low    []*float64 `json:"low"`
					Close  []*float64 `json:"close"`
					Volume []*float64 `json:"volume"`
				} `json:"quote"`
			} `json:"indicators"`
		} `json:"result"`
		Error *struct {
			Description string `json:"description"`
		} `json:"error"`
	} `json:"chart"`
}

// SnapChartTime rounds a timestamp to the minute for stable cache keys.
func SnapChartTime(t time.Time) time.Time {
	return t.UTC().Truncate(time.Minute)
}
func ParseInterval(raw string) (string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return "5", nil
	}
	switch raw {
	case "1", "5", "15", "60", "240", "D":
		return raw, nil
	default:
		return "", fmt.Errorf("interval must be one of 1, 5, 15, 60, 240, D")
	}
}

// DefaultInterval picks a sensible bar size from hold duration.
func DefaultInterval(from, to time.Time) string {
	if to.Before(from) {
		to = from.Add(time.Hour)
	}
	d := to.Sub(from)
	switch {
	case d <= 2*time.Hour:
		return "1"
	case d <= 8*time.Hour:
		return "5"
	case d <= 3*24*time.Hour:
		return "15"
	case d <= 14*24*time.Hour:
		return "60"
	default:
		return "D"
	}
}

// CacheKey builds a stable cache key for a bar request.
func CacheKey(req Request) string {
	return strings.Join([]string{
		strings.ToUpper(req.Symbol),
		req.InstrumentType,
		req.Interval,
		req.From.UTC().Format(time.RFC3339),
		req.To.UTC().Format(time.RFC3339),
	}, "|")
}

// ParseTimeParam parses RFC3339 or date-only query params.
func ParseTimeParam(raw string) (time.Time, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return time.Time{}, fmt.Errorf("missing time")
	}
	if t, err := time.Parse(time.RFC3339, raw); err == nil {
		return t.UTC(), nil
	}
	if t, err := time.Parse("2006-01-02", raw); err == nil {
		return t.UTC(), nil
	}
	return time.Time{}, fmt.Errorf("invalid time %q", raw)
}

// FormatTimeRFC3339 formats a time for JSON output.
func FormatTimeRFC3339(t time.Time) string {
	return t.UTC().Format(time.RFC3339)
}

// SupportedInstrument returns whether we can chart this instrument type.
func SupportedInstrument(instrumentType string) bool {
	switch instrumentType {
	case "stock", "option", "crypto", "future", "forex":
		return true
	default:
		return false
	}
}

// FinnhubResolution maps our interval to Finnhub resolution string.
func FinnhubResolution(interval string) (string, error) {
	switch interval {
	case "1":
		return "1", nil
	case "5":
		return "5", nil
	case "15":
		return "15", nil
	case "60", "240":
		return "60", nil
	case "D":
		return "D", nil
	default:
		return "", fmt.Errorf("unsupported interval %q", interval)
	}
}

// UnixString returns unix seconds as string for Finnhub API.
func UnixString(t time.Time) string {
	return strconv.FormatInt(t.Unix(), 10)
}
