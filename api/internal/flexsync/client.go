// Package flexsync pulls trade executions from Interactive Brokers' Flex Web
// Service and feeds them through the standard import pipeline. The user
// configures a Flex Query in IBKR Client Portal (Trades → Executions section,
// CSV format) plus a Flex Web Service token; TraderMemos then fetches on a
// schedule — token-based, no OAuth.
package flexsync

import (
	"context"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const (
	// DefaultBaseURL is IBKR's Flex Web Service endpoint.
	DefaultBaseURL = "https://gdcdyn.interactivebrokers.com/Universal/servlet/FlexStatementService.SendRequest"
	// maxStatementBytes caps a downloaded statement (a year of fills is well
	// under this; the cap guards a misconfigured query returning huge data).
	maxStatementBytes = 32 << 20
)

// flexResponse is the XML envelope for both request acknowledgement and
// error replies from the Flex Web Service.
type flexResponse struct {
	XMLName       xml.Name `xml:"FlexStatementResponse"`
	Status        string   `xml:"Status"`
	ReferenceCode string   `xml:"ReferenceCode"`
	URL           string   `xml:"Url"`
	ErrorCode     string   `xml:"ErrorCode"`
	ErrorMessage  string   `xml:"ErrorMessage"`
}

// ErrStatementPending is returned while IBKR is still generating the
// statement (their error code 1019); callers poll.
var ErrStatementPending = errors.New("statement generation in progress")

// Client talks to the IBKR Flex Web Service. The two-step flow: SendRequest
// returns a reference code, then GetStatement downloads the generated
// statement (retrying while generation is pending).
type Client struct {
	// BaseURL overrides DefaultBaseURL (tests, proxies).
	BaseURL string
	// HTTP defaults to a client with a 60s timeout.
	HTTP *http.Client
	// PollInterval and PollAttempts pace GetStatement retries while IBKR
	// generates the statement. Defaults: 5s × 12 (one minute).
	PollInterval time.Duration
	PollAttempts int
}

func (c *Client) httpClient() *http.Client {
	if c.HTTP != nil {
		return c.HTTP
	}
	return &http.Client{Timeout: 60 * time.Second}
}

func (c *Client) baseURL() string {
	if c.BaseURL != "" {
		return c.BaseURL
	}
	return DefaultBaseURL
}

// FetchStatement runs the full two-step flow and returns the raw statement
// bytes (CSV when the query is configured for CSV).
func (c *Client) FetchStatement(ctx context.Context, token, queryID string) ([]byte, error) {
	ref, stmtURL, err := c.sendRequest(ctx, token, queryID)
	if err != nil {
		return nil, err
	}

	interval := c.PollInterval
	if interval <= 0 {
		interval = 5 * time.Second
	}
	attempts := c.PollAttempts
	if attempts <= 0 {
		attempts = 12
	}
	for i := 0; i < attempts; i++ {
		if i > 0 {
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(interval):
			}
		}
		data, err := c.getStatement(ctx, stmtURL, token, ref)
		if errors.Is(err, ErrStatementPending) {
			continue
		}
		return data, err
	}
	return nil, fmt.Errorf("statement not ready after %d attempts", attempts)
}

func (c *Client) sendRequest(ctx context.Context, token, queryID string) (ref, stmtURL string, err error) {
	q := url.Values{"t": {token}, "q": {queryID}, "v": {"3"}}
	body, err := c.get(ctx, c.baseURL()+"?"+q.Encode())
	if err != nil {
		return "", "", err
	}
	var resp flexResponse
	if err := xml.Unmarshal(body, &resp); err != nil {
		return "", "", fmt.Errorf("unexpected SendRequest response: %w", err)
	}
	if !strings.EqualFold(resp.Status, "Success") {
		return "", "", fmt.Errorf("flex request failed: %s %s", resp.ErrorCode, resp.ErrorMessage)
	}
	if resp.ReferenceCode == "" || resp.URL == "" {
		return "", "", errors.New("flex request succeeded without reference code")
	}
	return resp.ReferenceCode, resp.URL, nil
}

func (c *Client) getStatement(ctx context.Context, stmtURL, token, ref string) ([]byte, error) {
	q := url.Values{"t": {token}, "q": {ref}, "v": {"3"}}
	body, err := c.get(ctx, stmtURL+"?"+q.Encode())
	if err != nil {
		return nil, err
	}
	// A still-generating (or failed) statement comes back as the XML envelope
	// instead of statement data.
	trimmed := strings.TrimSpace(string(body))
	if strings.HasPrefix(trimmed, "<") && strings.Contains(trimmed, "FlexStatementResponse") {
		var resp flexResponse
		if err := xml.Unmarshal(body, &resp); err == nil {
			if resp.ErrorCode == "1019" || strings.Contains(resp.ErrorMessage, "generation in progress") {
				return nil, ErrStatementPending
			}
			return nil, fmt.Errorf("flex statement failed: %s %s", resp.ErrorCode, resp.ErrorMessage)
		}
	}
	return body, nil
}

func (c *Client) get(ctx context.Context, u string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return nil, err
	}
	res, err := c.httpClient().Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("flex service returned HTTP %d", res.StatusCode)
	}
	return io.ReadAll(io.LimitReader(res.Body, maxStatementBytes))
}
