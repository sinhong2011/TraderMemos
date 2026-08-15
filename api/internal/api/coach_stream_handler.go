package api

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/labstack/echo/v5"
	"github.com/tradermemos/api/internal/auth"
	"github.com/tradermemos/api/internal/coach"
	"github.com/tradermemos/api/internal/store"
)

// sseEvent writes one Server-Sent Event and pushes it to the client. Every
// event is flushed immediately — buffering them would defeat the point.
func sseEvent(w http.ResponseWriter, fl http.Flusher, event string, payload any) error {
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	if _, err := fmt.Fprintf(w, "event: %s\ndata: %s\n\n", event, body); err != nil {
		return err
	}
	if fl != nil {
		fl.Flush()
	}
	return nil
}

// handleTradeCoachStream is the streaming twin of handleTradeCoach: same
// review, same persistence, but notes are pushed as the model produces them
// instead of after a minute of silence.
//
// Errors after the stream opens are delivered as an `error` event rather than
// an HTTP status — the 200 and the headers are already on the wire by then.
func (s *Server) handleTradeCoachStream(c *echo.Context) error {
	ctx := c.Request().Context()
	uid := auth.UserID(c)
	tradeID := c.Param("id")

	t, err := s.deps.Store.GetTrade(ctx, store.GetTradeParams{ID: tradeID, UserID: uid})
	if errors.Is(err, sql.ErrNoRows) {
		return Fail(http.StatusNotFound, "not_found", "trade not found", nil)
	}
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load trade", nil)
	}
	detail, err := s.buildTradeDetail(ctx, uid, t)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load trade detail", nil)
	}

	cfg := s.effectiveCoachConfig(ctx)
	if !cfg.Ready() {
		return c.JSON(http.StatusOK, coachReviewDTO{Source: "off", Notes: []coach.Note{}})
	}

	tradeCtx := tradeContextFromDetail(detail)
	hist, herr := s.coachHistoryFor(ctx, uid, detail, coachLoc(c))
	if herr != nil {
		c.Logger().Warn("coach history context incomplete", "trade_id", tradeID, "err", herr)
	}
	tradeCtx.Session = hist.session
	tradeCtx.Execution = hist.execution

	w := c.Response()
	// Without a flusher every event would sit in the buffer until the handler
	// returned, which is exactly the wait this endpoint exists to remove.
	fl, ok := w.(http.Flusher)
	if !ok {
		c.Logger().Warn("response writer cannot flush; coach stream would buffer",
			"trade_id", tradeID)
		return Fail(http.StatusInternalServerError, "internal", "streaming unsupported", nil)
	}

	h := w.Header()
	h.Set("Content-Type", "text/event-stream")
	h.Set("Cache-Control", "no-cache")
	h.Set("Connection", "keep-alive")
	// Proxies that buffer would hold every event until the response closed.
	h.Set("X-Accel-Buffering", "no")
	w.WriteHeader(http.StatusOK)
	fl.Flush()

	// A write failure means the client is gone; record it and stop pushing,
	// but let generation finish so the review is still persisted.
	var writeErr error
	emit := func(event string, payload any) {
		if writeErr != nil {
			return
		}
		if err := sseEvent(w, fl, event, payload); err != nil {
			writeErr = err
		}
	}

	review, err := coach.GenerateReviewStream(ctx, cfg, tradeCtx, func(n coach.Note) {
		emit("note", n)
	})
	if err != nil {
		if errors.Is(err, coach.ErrUnavailable) {
			emit("done", coachReviewDTO{Source: "off", Notes: []coach.Note{}})
			return nil
		}
		msg := strings.TrimSpace(err.Error())
		if msg == "" {
			msg = "coach generation failed"
		}
		if errors.Is(err, coach.ErrTimeout) {
			c.Logger().Warn("coach stream timed out", "trade_id", tradeID, "err", err)
		} else {
			c.Logger().Warn("coach stream failed", "trade_id", tradeID, "err", err)
		}
		emit("error", map[string]string{"message": msg})
		return nil
	}

	if review.Notes == nil {
		review.Notes = []coach.Note{}
	}
	out := coachReviewDTO{
		Source:     "llm",
		Notes:      review.Notes,
		NextAction: review.NextAction,
	}
	if rec, perr := s.saveCoachReview(ctx, uid, tradeID, cfg, review); perr != nil {
		c.Logger().Warn("could not persist coach review", "trade_id", tradeID, "err", perr)
	} else {
		out.ID = rec.ID
		out.CreatedAt = &rec.CreatedAt
	}
	// The done event carries the authoritative review: the streamed notes were
	// a preview, and only this payload has the next action and stored id.
	emit("done", out)
	return nil
}
