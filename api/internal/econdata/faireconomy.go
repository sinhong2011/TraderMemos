package econdata

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const DefaultFeedURL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json"

// FairEconomyProvider reads the free ForexFactory weekly calendar feed.
// The feed is rate-limited upstream (2 downloads per 5 minutes), which the
// service's TTL keeps us far under.
type FairEconomyProvider struct {
	Client  *http.Client
	FeedURL string // optional override for tests / mirrors
}

func NewFairEconomyProvider(feedURL string) *FairEconomyProvider {
	return &FairEconomyProvider{
		Client:  &http.Client{Timeout: 20 * time.Second},
		FeedURL: feedURL,
	}
}

func (p *FairEconomyProvider) Name() string { return "forexfactory" }

func (p *FairEconomyProvider) feedURL() string {
	if p.FeedURL != "" {
		return p.FeedURL
	}
	return DefaultFeedURL
}

type fairEconomyItem struct {
	Title    string `json:"title"`
	Country  string `json:"country"`
	Date     string `json:"date"`
	Impact   string `json:"impact"`
	Forecast string `json:"forecast"`
	Previous string `json:"previous"`
}

func (p *FairEconomyProvider) FetchEvents(ctx context.Context) ([]Event, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, p.feedURL(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "TraderMemos/1.0")

	resp, err := p.Client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return nil, fmt.Errorf("faireconomy feed: %s: %s", resp.Status, strings.TrimSpace(string(body)))
	}

	var items []fairEconomyItem
	if err := json.NewDecoder(resp.Body).Decode(&items); err != nil {
		return nil, err
	}

	events := make([]Event, 0, len(items))
	for _, it := range items {
		t, perr := time.Parse(time.RFC3339, it.Date)
		if perr != nil || strings.TrimSpace(it.Title) == "" {
			continue
		}
		events = append(events, Event{
			Title:    strings.TrimSpace(it.Title),
			Country:  strings.ToUpper(strings.TrimSpace(it.Country)),
			Impact:   normalizeImpact(it.Impact),
			Time:     t,
			Forecast: strings.TrimSpace(it.Forecast),
			Previous: strings.TrimSpace(it.Previous),
		})
	}
	return events, nil
}

func normalizeImpact(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "high":
		return "high"
	case "medium":
		return "medium"
	case "holiday", "non-economic":
		return "holiday"
	default:
		return "low"
	}
}
