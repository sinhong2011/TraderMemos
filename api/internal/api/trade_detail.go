package api

import (
	"context"
	"database/sql"
	"errors"

	"github.com/tradermemos/api/internal/store"
)

// tradeDetailDTO is the enriched single-trade payload: the trade plus its fills,
// journal (notes/setup/risk/R), tags, and attachments. Embedded tradeDTO fields
// are promoted into the JSON object.
type tradeDetailDTO struct {
	tradeDTO
	Fills          []store.Execution       `json:"fills"`
	Setup          *setupDTO               `json:"setup"`
	InitialRisk    *float64                `json:"initial_risk"`
	TargetPrice    *float64                `json:"target_price"`
	StopPrice      *float64                `json:"stop_price"`
	RMultiple      *float64                `json:"r_multiple"`
	EmotionalState string                  `json:"emotional_state"`
	Confidence     *int64                  `json:"confidence"`
	TradeQuality   *int64                  `json:"trade_quality"`
	Mae            *float64                `json:"mae"`
	Mfe            *float64                `json:"mfe"`
	DividendTotal  float64                 `json:"dividend_total"`
	TotalPnl       *float64                `json:"total_pnl"`
	Attachments    []store.TradeAttachment `json:"attachments"`
}

// buildTradeDetail assembles the enriched detail for a trade the caller owns.
func (s *Server) buildTradeDetail(ctx context.Context, userID string, t store.Trade) (tradeDetailDTO, error) {
	tags, err := s.deps.Store.ListTagsForTrade(ctx, t.ID)
	if err != nil {
		return tradeDetailDTO{}, err
	}
	d := tradeDetailDTO{tradeDTO: toTradeDTO(t, tags)}

	fills, err := s.deps.Store.ListExecutionsForTrade(ctx, t.ID)
	if err != nil {
		return tradeDetailDTO{}, err
	}
	if fills == nil {
		fills = []store.Execution{}
	}
	d.Fills = fills

	atts, err := s.deps.Store.ListAttachmentsForTrade(ctx, store.ListAttachmentsForTradeParams{TradeID: t.ID, UserID: userID})
	if err != nil {
		return tradeDetailDTO{}, err
	}
	if atts == nil {
		atts = []store.TradeAttachment{}
	}
	d.Attachments = atts

	cash, err := s.deps.Store.ListCashForTrade(ctx, store.ListCashForTradeParams{UserID: userID, TradeID: sql.NullString{String: t.ID, Valid: true}})
	if err != nil {
		return tradeDetailDTO{}, err
	}
	var divTotal float64
	for _, c := range cash {
		if c.Type == "dividend" {
			divTotal += c.Amount
		}
	}
	d.DividendTotal = divTotal
	if t.NetPnl.Valid {
		total := t.NetPnl.Float64 + divTotal
		d.TotalPnl = &total
	}

	j, err := s.deps.Store.GetTradeJournal(ctx, store.GetTradeJournalParams{TradeID: t.ID, UserID: userID})
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return tradeDetailDTO{}, err
	}
	if err == nil {
		d.Notes = j.Notes // journal is the source of truth for notes
		d.InitialRisk = fptr(j.InitialRisk)
		d.TargetPrice = fptr(j.TargetPrice)
		d.StopPrice = fptr(j.StopPrice)
		d.EmotionalState = j.EmotionalState
		d.Confidence = iptr(j.Confidence)
		d.TradeQuality = iptr(j.TradeQuality)
		d.Mae = fptr(j.Mae)
		d.Mfe = fptr(j.Mfe)
		if j.SetupID.Valid {
			setup, serr := s.deps.Store.GetSetup(ctx, store.GetSetupParams{ID: j.SetupID.String, UserID: userID})
			if serr == nil {
				dto := toSetupDTO(setup)
				d.Setup = &dto
			}
		}
		// R stays price-based (Stonk model): dividends do not affect R.
		if j.InitialRisk.Valid && j.InitialRisk.Float64 != 0 && t.NetPnl.Valid {
			r := t.NetPnl.Float64 / j.InitialRisk.Float64
			d.RMultiple = &r
		}
	}
	return d, nil
}
