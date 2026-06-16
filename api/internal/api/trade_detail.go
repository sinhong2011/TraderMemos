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
	Fills       []store.Execution       `json:"fills"`
	Setup       *store.Setup            `json:"setup"`
	InitialRisk *float64                `json:"initial_risk"`
	RMultiple   *float64                `json:"r_multiple"`
	Attachments []store.TradeAttachment `json:"attachments"`
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

	j, err := s.deps.Store.GetTradeJournal(ctx, store.GetTradeJournalParams{TradeID: t.ID, UserID: userID})
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return tradeDetailDTO{}, err
	}
	if err == nil {
		d.Notes = j.Notes // journal is the source of truth for notes
		d.InitialRisk = fptr(j.InitialRisk)
		if j.SetupID.Valid {
			setup, serr := s.deps.Store.GetSetup(ctx, store.GetSetupParams{ID: j.SetupID.String, UserID: userID})
			if serr == nil {
				d.Setup = &setup
			}
		}
		if j.InitialRisk.Valid && j.InitialRisk.Float64 != 0 && t.NetPnl.Valid {
			r := t.NetPnl.Float64 / j.InitialRisk.Float64
			d.RMultiple = &r
		}
	}
	return d, nil
}
