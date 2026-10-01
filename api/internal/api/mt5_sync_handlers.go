package api

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"
	"uuid"

	"github.com/labstack/echo/v5"
	"github.com/tradermemos/api/internal/auth"
	"github.com/tradermemos/api/internal/importer"
	"github.com/tradermemos/api/internal/store"
)

// mt5SyncSource tags import batches written by the TraderMemos MT5 EA.
const mt5SyncSource = "mt5-ea"

// maxMT5SyncDeals caps one request; the EA sends history in chunks below it.
const maxMT5SyncDeals = 5000

func (s *Server) mt5SyncRoutes(g *echo.Group) {
	g.POST("/sync/mt5", s.handleMT5Sync)
}

type mt5SyncReq struct {
	AccountID string `json:"account_id"`
	// SourceTZ is the IANA zone of the broker server clock; empty means the
	// MetaTrader convention (Europe/Athens), same as statement imports.
	SourceTZ string `json:"source_tz"`
	// ServerUTCOffset is the terminal's current TimeTradeServer()-TimeGMT() in
	// seconds — used only to warn when SourceTZ disagrees with the broker.
	ServerUTCOffset *int               `json:"server_utc_offset"`
	Login           string             `json:"login"`
	Server          string             `json:"server"`
	Deals           []importer.MT5Deal `json:"deals"`
}

type mt5SyncResult struct {
	Inserted      int                 `json:"inserted"`
	Skipped       int                 `json:"skipped"`
	ImportBatchID string              `json:"import_batch_id"`
	Errors        []importer.RowError `json:"errors"`
	Warnings      []string            `json:"warnings"`
}

// errNothingNew rolls back a sync whose deals were all already imported, so
// the EA's frequent re-sends never leave empty batches in import history.
var errNothingNew = errors.New("no new deals")

// handleMT5Sync ingests deals pushed by the MT5 EA through the regular import
// pipeline: one batch per sync that inserted something (reversible from
// import history), occurrence-aware dedup, one regroup.
func (s *Server) handleMT5Sync(c *echo.Context) error {
	uid := auth.UserID(c)
	var in mt5SyncReq
	if err := c.Bind(&in); err != nil {
		return Fail(http.StatusBadRequest, "bad_request", "invalid JSON body", nil)
	}
	in.AccountID = strings.TrimSpace(in.AccountID)
	if in.AccountID == "" {
		return Fail(http.StatusBadRequest, "bad_request", "account_id is required", nil)
	}
	if len(in.Deals) > maxMT5SyncDeals {
		return Fail(http.StatusRequestEntityTooLarge, "too_large",
			fmt.Sprintf("at most %d deals per request", maxMT5SyncDeals), nil)
	}
	in.SourceTZ = strings.TrimSpace(in.SourceTZ)
	if in.SourceTZ != "" {
		if _, err := time.LoadLocation(in.SourceTZ); err != nil {
			return Fail(http.StatusBadRequest, "bad_request", "invalid 'source_tz' (want IANA timezone name)", nil)
		}
	}
	if err := s.assertAccount(c.Request().Context(), uid, in.AccountID); err != nil {
		return Fail(http.StatusNotFound, "not_found", "account not found", nil)
	}

	out := mt5SyncResult{Errors: []importer.RowError{}, Warnings: []string{}}
	if w := mt5OffsetWarning(in.SourceTZ, in.ServerUTCOffset, time.Now()); w != "" {
		out.Warnings = append(out.Warnings, w)
	}

	parsed := importer.ParseMT5Deals(in.Deals, in.SourceTZ)
	if len(parsed.Executions) == 0 {
		if parsed.Errors != nil {
			out.Errors = parsed.Errors
		}
		return c.JSON(http.StatusOK, out)
	}

	label := "MT5"
	if in.Login != "" {
		label += " " + in.Login
		if in.Server != "" {
			label += " @ " + in.Server
		}
	}
	// The body is fully read; a dropped connection must not cancel the commit
	// halfway (same reasoning as finishImportCommit).
	ctx := context.WithoutCancel(c.Request().Context())
	var committed importer.CommitResult
	batchID := uuid.New().String()
	err := store.InTx(ctx, s.deps.Store, func(q store.Querier) error {
		if _, err := q.CreateImportBatch(ctx, store.CreateImportBatchParams{
			ID: batchID, UserID: uid, AccountID: in.AccountID, Source: mt5SyncSource,
			Filename: sql.NullString{String: label, Valid: true},
			RowCount: int64(len(in.Deals)), Status: "pending",
		}); err != nil {
			return fmt.Errorf("create batch: %w", err)
		}
		var err error
		committed, err = importer.Commit(ctx, q, uid, in.AccountID,
			sql.NullString{String: batchID, Valid: true}, parsed)
		if err != nil {
			return fmt.Errorf("commit executions: %w", err)
		}
		if committed.Inserted == 0 {
			return errNothingNew
		}
		return q.SetImportBatchStatus(ctx, store.SetImportBatchStatusParams{Status: "committed", ID: batchID, UserID: uid})
	})
	switch {
	case errors.Is(err, errNothingNew):
		batchID = ""
	case err != nil:
		return Fail(http.StatusInternalServerError, "internal", "could not sync deals", err.Error())
	}

	out.Inserted, out.Skipped, out.ImportBatchID = committed.Inserted, committed.Skipped, batchID
	if committed.Errors != nil {
		out.Errors = committed.Errors
	}
	return c.JSON(http.StatusOK, out)
}

// mt5OffsetWarning reports when the broker clock the terminal sees disagrees
// with the zone its times are read in — every fill would land shifted by the
// difference. Only the current offset is comparable; history across a DST
// change is the zone's job, which is why source_tz stays authoritative.
func mt5OffsetWarning(sourceTZ string, serverOffset *int, now time.Time) string {
	if serverOffset == nil {
		return ""
	}
	loc := importer.MTLocation(sourceTZ)
	_, zoneOffset := now.In(loc).Zone()
	if zoneOffset == *serverOffset {
		return ""
	}
	return fmt.Sprintf("broker server clock is %s but %s is %s right now — fill times will be off by the difference; set the EA's SourceTimezone to the broker's zone",
		utcOffsetLabel(*serverOffset), loc.String(), utcOffsetLabel(zoneOffset))
}

func utcOffsetLabel(seconds int) string {
	sign := "+"
	if seconds < 0 {
		sign, seconds = "-", -seconds
	}
	h, m := seconds/3600, seconds%3600/60
	if m == 0 {
		return fmt.Sprintf("UTC%s%d", sign, h)
	}
	return fmt.Sprintf("UTC%s%d:%02d", sign, h, m)
}
