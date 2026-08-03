package excursion

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/tradermemos/api/internal/marketdata"
	"github.com/tradermemos/api/internal/store"
)

// Sentinel errors let callers (the API endpoint, the backfill job) map the
// same pipeline to their own error surfaces.
var (
	ErrNotClosed    = errors.New("excursion needs a closed trade")
	ErrOptionTrade  = errors.New("auto excursion is not supported for options — enter MAE/MFE manually")
	ErrNotChartable = errors.New("no market data source for this symbol")
	ErrBarsExpired  = errors.New("intraday bars are no longer available for this trade")
	ErrBarsFetch    = errors.New("could not fetch market data")
)

// AutoResult is a computed excursion plus how it was computed. PostExitMae /
// PostExitMfe are nil when the post-exit window hasn't fully traded yet (the
// backfill job completes them later).
type AutoResult struct {
	Result
	Interval    string
	Provider    string
	PostExitMae *float64
	PostExitMfe *float64
}

// AutoCompute runs the full auto-excursion pipeline for one trade —
// eligibility, bar fetch, computation, and journal merge — and is shared by
// POST /trades/:id/excursion and the background backfill job. market must be
// non-nil; callers gate on configuration.
func AutoCompute(ctx context.Context, q store.Querier, market *marketdata.Service, t store.Trade) (AutoResult, error) {
	if t.Status != "closed" || !t.ClosedAt.Valid {
		return AutoResult{}, ErrNotClosed
	}
	if t.InstrumentType == "option" {
		// Bars for OCC symbols chart the underlying; pretending underlying
		// excursion is option P&L would mislead. Manual entry stays available.
		return AutoResult{}, ErrOptionTrade
	}
	if !marketdata.ChartableSymbol(t.Symbol) || !marketdata.SupportedInstrument(t.InstrumentType) {
		return AutoResult{}, ErrNotChartable
	}

	now := time.Now().UTC()
	opened, closed := t.OpenedAt.UTC(), t.ClosedAt.Time.UTC()
	interval := ChooseInterval(opened, closed, now)
	if interval == "D" && closed.Sub(opened) < 24*time.Hour {
		// Daily candles around an intraday trade would wildly overstate
		// excursion; better to report nothing than a wrong number.
		return AutoResult{}, ErrBarsExpired
	}

	// One bar of padding on each side so the entry and exit bars are covered.
	// The window also runs past the exit so post-exit excursion can be read
	// from the same fetch; slack covers weekend/holiday session gaps.
	pad := IntervalDuration(interval)
	req := marketdata.Request{
		Symbol:         t.Symbol,
		InstrumentType: t.InstrumentType,
		Interval:       interval,
		From:           marketdata.SnapChartTime(opened.Add(-pad)),
		To:             marketdata.SnapChartTime(closed.Add(PostExitFetchSlack(interval) + pad)),
	}
	bars, err := market.GetBars(ctx, req)
	if err != nil {
		return AutoResult{}, fmt.Errorf("%w: %v", ErrBarsFetch, err)
	}

	execs, err := q.ListExecutionsForTrade(ctx, t.ID)
	if err != nil {
		return AutoResult{}, fmt.Errorf("load fills: %w", err)
	}
	fills := make([]Fill, 0, len(execs))
	for _, e := range execs {
		fills = append(fills, Fill{
			Side: e.Side, Quantity: e.Quantity, Price: e.Price,
			Multiplier: e.Multiplier, ExecutedAt: e.ExecutedAt,
		})
	}

	res, err := Compute(bars.Bars, interval, fills)
	if err != nil {
		return AutoResult{}, err
	}

	// Post-exit excursion against the average exit: what holding the closed
	// position through the next bars would have done. Persist only once the
	// window has fully traded (or the slack horizon has passed with a partial
	// window), so a trade closed minutes ago isn't frozen at a half-answer.
	out := AutoResult{Result: res, Interval: interval, Provider: bars.Provider}
	var postMae, postMfe sql.NullFloat64
	if t.AvgExitPrice.Valid {
		mult := 1.0
		if n := len(fills); n > 0 && fills[n-1].Multiplier > 0 {
			mult = fills[n-1].Multiplier
		}
		wanted := PostExitBarCount(interval)
		post, perr := ComputePostExit(
			bars.Bars, closed, wanted, t.AvgExitPrice.Float64, t.Direction, t.QtyOpened, mult,
		)
		if perr == nil && (post.BarsUsed >= wanted || now.After(closed.Add(PostExitFetchSlack(interval)))) {
			postMae = sql.NullFloat64{Float64: post.Mae, Valid: true}
			postMfe = sql.NullFloat64{Float64: post.Mfe, Valid: true}
			out.PostExitMae = &post.Mae
			out.PostExitMfe = &post.Mfe
		}
	}

	// Merge into the journal without clobbering other fields.
	cur, jerr := q.GetTradeJournal(ctx, store.GetTradeJournalParams{TradeID: t.ID, UserID: t.UserID})
	if jerr != nil && !errors.Is(jerr, sql.ErrNoRows) {
		return AutoResult{}, fmt.Errorf("load journal: %w", jerr)
	}
	if !postMae.Valid {
		postMae, postMfe = cur.PostExitMae, cur.PostExitMfe
	}
	if err := q.UpsertTradeJournal(ctx, store.UpsertTradeJournalParams{
		TradeID: t.ID, UserID: t.UserID,
		Notes: cur.Notes, SetupID: cur.SetupID, InitialRisk: cur.InitialRisk,
		TargetPrice: cur.TargetPrice, StopPrice: cur.StopPrice,
		EmotionalState: cur.EmotionalState, Confidence: cur.Confidence, TradeQuality: cur.TradeQuality,
		Mae:         sql.NullFloat64{Float64: res.Mae, Valid: true},
		Mfe:         sql.NullFloat64{Float64: res.Mfe, Valid: true},
		PostExitMae: postMae,
		PostExitMfe: postMfe,
	}); err != nil {
		return AutoResult{}, fmt.Errorf("save excursion: %w", err)
	}

	return out, nil
}
