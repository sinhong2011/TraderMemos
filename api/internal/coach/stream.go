package coach

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/tradermemos/api/internal/ocr"
)

// NoteFunc receives each note as soon as it is complete in the stream.
type NoteFunc func(Note)

// sseDataPrefix is how an OpenAI-compatible stream frames each chunk.
const sseDataPrefix = "data:"

// streamDone is the sentinel that ends an OpenAI-compatible stream.
const streamDone = "[DONE]"

type streamChunk struct {
	Choices []struct {
		Delta struct {
			Content string `json:"content"`
		} `json:"delta"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

// GenerateReviewStream generates a review, invoking onNote for each note as
// soon as it arrives rather than after the whole response lands. The returned
// Review is still parsed from the complete payload, so it is authoritative:
// the streamed notes are a preview, not the record.
//
// Falls back to a blocking GenerateReview when the endpoint refuses either the
// stream flag or the response format — the same reasoning as the json_schema
// fallback, since a coach that worked before must not break on an upgrade.
func GenerateReviewStream(
	ctx context.Context,
	cfg ocr.VisionConfig,
	trade TradeContext,
	onNote NoteFunc,
) (Review, error) {
	if !cfg.Ready() {
		return Review{}, fmt.Errorf("%w: coach not configured", ErrUnavailable)
	}

	userMsg := FormatTradeContext(trade) + "\n\n" + responseFormatPrompt
	messages := []chatMessage{
		{Role: "system", Content: systemPrompt(cfg)},
		{Role: "user", Content: userMsg},
	}

	review, err := streamReview(ctx, cfg, messages, schemaFormat(), onNote)
	if errors.Is(err, errFormatRejected) {
		review, err = streamReview(ctx, cfg, messages, objectFormat(), onNote)
	}
	if errors.Is(err, errStreamUnsupported) {
		// No notes can have been emitted yet — the request was refused before
		// any chunk arrived — so a blocking retry cannot duplicate them.
		return GenerateReview(ctx, cfg, trade)
	}
	return review, err
}

// streamReview performs one streaming completion, emitting notes as they close.
func streamReview(
	ctx context.Context,
	cfg ocr.VisionConfig,
	messages []chatMessage,
	format *chatFmt,
	onNote NoteFunc,
) (Review, error) {
	payload, err := json.Marshal(chatRequest{
		Model:          modelName(cfg),
		Messages:       messages,
		ResponseFormat: format,
		Temperature:    0.3,
		Stream:         true,
	})
	if err != nil {
		return Review{}, err
	}

	base := strings.TrimRight(strings.TrimSpace(cfg.BaseURL), "/")
	req, err := http.NewRequestWithContext(
		ctx, http.MethodPost, base+"/chat/completions", bytes.NewReader(payload),
	)
	if err != nil {
		return Review{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "text/event-stream")
	req.Header.Set("Authorization", "Bearer "+strings.TrimSpace(cfg.APIKey))

	res, err := client(cfg).Do(req)
	if err != nil {
		if isTimeoutErr(err) {
			return Review{}, fmt.Errorf(
				"%w: coach API at %s did not respond within %s", ErrTimeout, base, timeout(cfg),
			)
		}
		return Review{}, err
	}
	defer res.Body.Close()

	if res.StatusCode >= 300 {
		raw, _ := io.ReadAll(io.LimitReader(res.Body, 8<<10))
		apiErr := fmt.Errorf("coach api %s: %s", res.Status, truncateRunes(string(raw), 300))
		if !rejectsRequestShape(res.StatusCode) {
			return Review{}, apiErr
		}
		if isSchemaRequest(format) {
			return Review{}, fmt.Errorf("%w: %w", errFormatRejected, apiErr)
		}
		// Plain JSON mode was refused too, so the objection is to streaming.
		return Review{}, fmt.Errorf("%w: %w", errStreamUnsupported, apiErr)
	}

	var content strings.Builder
	emitted := 0
	sc := bufio.NewScanner(res.Body)
	sc.Buffer(make([]byte, 0, 64<<10), 1<<20)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if line == "" || !strings.HasPrefix(line, sseDataPrefix) {
			continue
		}
		data := strings.TrimSpace(strings.TrimPrefix(line, sseDataPrefix))
		if data == streamDone {
			break
		}
		var chunk streamChunk
		if err := json.Unmarshal([]byte(data), &chunk); err != nil {
			// A frame we cannot read is skipped: the authoritative parse runs
			// over the accumulated content at the end regardless.
			continue
		}
		if chunk.Error != nil && chunk.Error.Message != "" {
			return Review{}, fmt.Errorf("coach api: %s", chunk.Error.Message)
		}
		for _, ch := range chunk.Choices {
			content.WriteString(ch.Delta.Content)
		}
		if onNote != nil {
			emitted = emitNewNotes(content.String(), emitted, onNote)
		}
	}
	if err := sc.Err(); err != nil {
		if isTimeoutErr(err) {
			return Review{}, fmt.Errorf("%w: coach stream from %s stalled", ErrTimeout, base)
		}
		return Review{}, err
	}

	return parseReview(content.String())
}

// emitNewNotes emits any notes that have closed since the last call and
// returns the new emitted count.
func emitNewNotes(buf string, alreadyEmitted int, onNote NoteFunc) int {
	objs := completeNoteObjects(buf)
	for i := alreadyEmitted; i < len(objs); i++ {
		var n struct {
			Tone     string `json:"tone"`
			Headline string `json:"headline"`
			Detail   string `json:"detail"`
		}
		if err := json.Unmarshal([]byte(objs[i]), &n); err != nil {
			continue
		}
		note, ok := toNote(n.Tone, n.Headline, n.Detail, i)
		if !ok {
			continue
		}
		onNote(note)
	}
	return len(objs)
}

// completeNoteObjects returns the fully-closed JSON objects inside the "notes"
// array of a partially received payload. Braces and brackets inside strings do
// not count toward nesting, so a headline containing "{" cannot desynchronise
// the scan.
func completeNoteObjects(buf string) []string {
	start := strings.Index(buf, `"notes"`)
	if start < 0 {
		return nil
	}
	open := strings.IndexByte(buf[start:], '[')
	if open < 0 {
		return nil
	}
	i := start + open + 1

	var out []string
	depth, objStart := 0, -1
	inStr, escaped := false, false
	for ; i < len(buf); i++ {
		c := buf[i]
		if inStr {
			switch {
			case escaped:
				escaped = false
			case c == '\\':
				escaped = true
			case c == '"':
				inStr = false
			}
			continue
		}
		switch c {
		case '"':
			inStr = true
		case '{':
			if depth == 0 {
				objStart = i
			}
			depth++
		case '}':
			depth--
			if depth == 0 && objStart >= 0 {
				out = append(out, buf[objStart:i+1])
				objStart = -1
			}
		case ']':
			if depth == 0 {
				return out
			}
		}
	}
	return out
}
