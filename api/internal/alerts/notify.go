package alerts

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"
)

// expoPushURL is Expo's push gateway; overridable in tests.
var expoPushURL = "https://exp.host/--/api/v2/push/send"

// errDeviceNotRegistered marks an Expo token whose app install is gone; the
// service disables the channel instead of retrying forever.
var errDeviceNotRegistered = errors.New("device not registered")

// webhookPayload is the outgoing webhook body. `content` (Discord) and `text`
// (Slack/Mattermost) mirror title+body so common incoming webhooks render the
// alert without a relay; ntfy subscribers get the title via the X-Title header.
type webhookPayload struct {
	Source  string `json:"source"`
	Rule    string `json:"rule"`
	Title   string `json:"title"`
	Body    string `json:"body"`
	FiredAt string `json:"fired_at"`
	Content string `json:"content"`
	Text    string `json:"text"`
}

func (s *Service) sendWebhook(ctx context.Context, url string, ev Event, at time.Time) error {
	line := ev.Title + " — " + ev.Body
	b, err := json.Marshal(webhookPayload{
		Source:  "tradermemos",
		Rule:    ev.Rule,
		Title:   ev.Title,
		Body:    ev.Body,
		FiredAt: at.UTC().Format(time.RFC3339),
		Content: line,
		Text:    line,
	})
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(b))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Title", ev.Title)
	resp, err := s.httpc.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 4096))
	if resp.StatusCode >= 300 {
		return fmt.Errorf("webhook returned %s", resp.Status)
	}
	return nil
}

type expoMessage struct {
	To    string `json:"to"`
	Title string `json:"title"`
	Body  string `json:"body"`
	Sound string `json:"sound"`
}

type expoTicket struct {
	Status  string `json:"status"`
	Message string `json:"message"`
	Details struct {
		Error string `json:"error"`
	} `json:"details"`
}

// sendExpo pushes one event to a batch of Expo tokens in a single request.
// The returned slice aligns with tokens; a non-nil entry is that token's
// delivery error (errDeviceNotRegistered when the install is gone).
func (s *Service) sendExpo(ctx context.Context, tokens []string, ev Event) ([]error, error) {
	msgs := make([]expoMessage, len(tokens))
	for i, to := range tokens {
		msgs[i] = expoMessage{To: to, Title: ev.Title, Body: ev.Body, Sound: "default"}
	}
	b, err := json.Marshal(msgs)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, expoPushURL, bytes.NewReader(b))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	resp, err := s.httpc.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("expo push returned %s", resp.Status)
	}
	var out struct {
		Data []expoTicket `json:"data"`
	}
	if err := json.Unmarshal(body, &out); err != nil {
		return nil, fmt.Errorf("expo push: unreadable response: %w", err)
	}
	errs := make([]error, len(tokens))
	for i, t := range out.Data {
		if i >= len(errs) || t.Status != "error" {
			continue
		}
		if t.Details.Error == "DeviceNotRegistered" {
			errs[i] = errDeviceNotRegistered
		} else {
			errs[i] = fmt.Errorf("expo push: %s", t.Message)
		}
	}
	return errs, nil
}
