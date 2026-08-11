package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/tradermemos/api/internal/importer"
)

// Client is a thin authenticated wrapper over the TraderMemos REST API.
type Client struct {
	baseURL string
	token   string
	http    *http.Client
}

func newClient(apiURL, token string) *Client {
	return &Client{
		baseURL: strings.TrimRight(apiURL, "/"),
		token:   token,
		http:    &http.Client{Timeout: 30 * time.Second},
	}
}

type apiAccount struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// CheckAccount verifies connectivity, the PAT, and that accountID exists.
func (c *Client) CheckAccount(ctx context.Context, accountID string) error {
	body, err := c.do(ctx, http.MethodGet, "/api/v1/accounts", nil)
	if err != nil {
		return err
	}
	var accounts []apiAccount
	if err := json.Unmarshal(body, &accounts); err != nil {
		return fmt.Errorf("unexpected /accounts response: %w", err)
	}
	names := make([]string, 0, len(accounts))
	for _, a := range accounts {
		if a.ID == accountID {
			return nil
		}
		names = append(names, fmt.Sprintf("%s (%s)", a.Name, a.ID))
	}
	return fmt.Errorf("account %q not found on server; available: %s", accountID, strings.Join(names, ", "))
}

// postResult is the fate of one fill on the server.
type postResult int

const (
	postInserted postResult = iota
	postDeduped
)

type createExecutionReq struct {
	AccountID      string            `json:"account_id"`
	Symbol         string            `json:"symbol"`
	InstrumentType string            `json:"instrument_type"`
	Side           string            `json:"side"`
	Quantity       float64           `json:"quantity"`
	Price          float64           `json:"price"`
	Fees           float64           `json:"fees"`
	Commission     float64           `json:"commission"`
	ExecutedAt     time.Time         `json:"executed_at"`
	Multiplier     float64           `json:"multiplier"`
	Details        map[string]string `json:"details,omitempty"`
}

// PostExecution sends one parsed fill. The server dedups by content hash and
// regroups trades, so replaying a whole statement is safe and idempotent.
func (c *Client) PostExecution(ctx context.Context, accountID string, ex importer.ParsedExecution) (postResult, error) {
	req := createExecutionReq{
		AccountID:      accountID,
		Symbol:         ex.Symbol,
		InstrumentType: ex.InstrumentType,
		Side:           ex.Side,
		Quantity:       ex.Quantity,
		Price:          ex.Price,
		Fees:           ex.Fees,
		Commission:     ex.Commission,
		ExecutedAt:     ex.ExecutedAt,
		Multiplier:     ex.Multiplier,
	}
	// The lot key isolates overlapping same-symbol round-trips (MT4 pairs).
	if ex.LotKey != "" {
		req.Details = map[string]string{"lot": ex.LotKey}
	}
	payload, err := json.Marshal(req)
	if err != nil {
		return postInserted, err
	}
	body, err := c.do(ctx, http.MethodPost, "/api/v1/executions", payload)
	if err != nil {
		return postInserted, err
	}
	var resp struct {
		Deduped string `json:"deduped"`
	}
	if err := json.Unmarshal(body, &resp); err == nil && resp.Deduped == "true" {
		return postDeduped, nil
	}
	return postInserted, nil
}

func (c *Client) do(ctx context.Context, method, path string, payload []byte) ([]byte, error) {
	var body io.Reader
	if payload != nil {
		body = bytes.NewReader(payload)
	}
	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+c.token)
	if payload != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	res, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	out, err := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if err != nil {
		return nil, err
	}
	if res.StatusCode == http.StatusUnauthorized || res.StatusCode == http.StatusForbidden {
		return nil, fmt.Errorf("authentication failed (%d) — is the token valid and unexpired?", res.StatusCode)
	}
	if res.StatusCode < 200 || res.StatusCode > 299 {
		return nil, fmt.Errorf("%s %s: %d %s", method, path, res.StatusCode, strings.TrimSpace(string(out)))
	}
	return out, nil
}
