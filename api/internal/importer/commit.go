package importer

import (
	"context"
	"database/sql"
	"encoding/json"
	"strings"

	"github.com/google/uuid"
	"github.com/tradermemos/api/internal/store"
	"github.com/tradermemos/api/internal/trades"
)

// CommitResult is the outcome of inserting parsed executions and annotations.
type CommitResult struct {
	Inserted    int
	Skipped     int
	Annotated   int
	Trades      int
	Errors      []RowError
	Format      string
}

// Commit inserts executions, regroups trades, then applies journal annotations.
// batchID may be invalid (CLI imports); when valid, executions are tagged for reversal.
func Commit(ctx context.Context, q store.Querier, userID, accountID string, batchID sql.NullString, parsed ParseResult) (CommitResult, error) {
	res := CommitResult{Errors: parsed.Errors, Format: parsed.Format}
	if res.Errors == nil {
		res.Errors = []RowError{}
	}
	if parsed.Format == "journal_trades" {
		res.Trades = CountJournalTrades(parsed.Executions)
	}

	type pending struct {
		tradeID string
		ann     *TradeAnnotation
	}
	var pendingAnns []pending

	for _, pe := range parsed.Executions {
		mult := pe.Multiplier
		if mult == 0 {
			mult = DefaultMultiplier(pe.InstrumentType)
		}
		hash := DedupHash(pe.Symbol, pe.Side, pe.Quantity, pe.Price, pe.ExecutedAt)
		exists, err := q.ExecutionExists(ctx, store.ExecutionExistsParams{AccountID: accountID, DedupHash: hash})
		if err != nil {
			return res, err
		}
		if exists == 1 {
			res.Skipped++
			continue
		}
		ext := sql.NullString{}
		if pe.ExternalID != "" {
			ext = sql.NullString{String: pe.ExternalID, Valid: true}
		}
		id := uuid.NewString()
		details := sql.NullString{}
		if pe.LotKey != "" || pe.OptionRight != "" {
			payload := map[string]string{}
			if pe.LotKey != "" {
				payload["lot"] = pe.LotKey
			}
			if pe.OptionRight != "" {
				payload["option_right"] = pe.OptionRight
			}
			if b, err := json.Marshal(payload); err == nil {
				details = sql.NullString{String: string(b), Valid: true}
			}
		}
		if _, err := q.InsertExecution(ctx, store.InsertExecutionParams{
			ID: id, UserID: userID, AccountID: accountID, ExternalID: ext,
			Symbol: pe.Symbol, InstrumentType: pe.InstrumentType, Side: pe.Side,
			Quantity: pe.Quantity, Price: pe.Price, Fees: pe.Fees, Commission: pe.Commission,
			ExecutedAt: pe.ExecutedAt, Multiplier: mult, Details: details,
			ImportBatchID: batchID, DedupHash: hash,
		}); err != nil {
			return res, err
		}
		res.Inserted++
		if pe.Annotation != nil {
			pendingAnns = append(pendingAnns, pending{tradeID: id, ann: pe.Annotation})
		}
	}

	if err := trades.NewService(q).Regroup(ctx, userID, accountID); err != nil {
		return res, err
	}

	for _, p := range pendingAnns {
		if err := applyAnnotation(ctx, q, userID, accountID, p.tradeID, p.ann); err != nil {
			res.Errors = append(res.Errors, RowError{Row: 0, Message: "annotation: " + err.Error()})
			continue
		}
		res.Annotated++
	}
	return res, nil
}

func applyAnnotation(ctx context.Context, q store.Querier, userID, accountID, tradeID string, ann *TradeAnnotation) error {
	if ann == nil {
		return nil
	}

	var setupID sql.NullString
	if name := strings.TrimSpace(ann.SetupName); name != "" {
		id, err := ensureSetup(ctx, q, userID, name)
		if err != nil {
			return err
		}
		setupID = sql.NullString{String: id, Valid: true}
	}

	var confidence sql.NullInt64
	if ann.Confidence != nil {
		confidence = sql.NullInt64{Int64: *ann.Confidence, Valid: true}
	}
	var target, stop sql.NullFloat64
	if ann.Target != nil {
		target = sql.NullFloat64{Float64: *ann.Target, Valid: true}
	}
	if ann.Stop != nil {
		stop = sql.NullFloat64{Float64: *ann.Stop, Valid: true}
	}
	emotion := ann.Emotion

	// Preserve existing journal fields when annotation leaves them empty by
	// reading current row first (import should still overwrite notes/setup when set).
	cur, err := q.GetTradeJournal(ctx, store.GetTradeJournalParams{TradeID: tradeID, UserID: userID})
	notes := ann.Notes
	risk := sql.NullFloat64{}
	quality := sql.NullInt64{}
	mae, mfe := sql.NullFloat64{}, sql.NullFloat64{}
	if err == nil {
		if notes == "" {
			notes = cur.Notes
		}
		if !setupID.Valid {
			setupID = cur.SetupID
		}
		risk = cur.InitialRisk
		if !confidence.Valid {
			confidence = cur.Confidence
		}
		if !target.Valid {
			target = cur.TargetPrice
		}
		if !stop.Valid {
			stop = cur.StopPrice
		}
		if emotion == "" {
			emotion = cur.EmotionalState
		}
		quality = cur.TradeQuality
		mae, mfe = cur.Mae, cur.Mfe
	}

	if err := q.UpsertTradeJournal(ctx, store.UpsertTradeJournalParams{
		TradeID: tradeID, UserID: userID, Notes: notes, SetupID: setupID, InitialRisk: risk,
		TargetPrice: target, StopPrice: stop, EmotionalState: emotion, Confidence: confidence,
		TradeQuality: quality, Mae: mae, Mfe: mfe,
	}); err != nil {
		return err
	}

	if len(ann.Tags) > 0 {
		existing, err := q.ListTags(ctx, userID)
		if err != nil {
			return err
		}
		byName := map[string]store.Tag{}
		for _, t := range existing {
			byName[strings.ToLower(t.Name)] = t
		}
		for _, ref := range ann.Tags {
			name := strings.TrimSpace(ref.Name)
			if name == "" {
				continue
			}
			kind := ref.Kind
			if kind != "mistake" {
				kind = "custom"
			}
			tag, ok := byName[strings.ToLower(name)]
			if !ok {
				created, err := q.CreateTag(ctx, store.CreateTagParams{
					ID: uuid.NewString(), UserID: userID, Name: name,
					Color: "#CBD5E1", Description: "", Kind: kind,
				})
				if err != nil {
					// Race / duplicate — reload list
					existing, _ = q.ListTags(ctx, userID)
					byName = map[string]store.Tag{}
					for _, t := range existing {
						byName[strings.ToLower(t.Name)] = t
					}
					tag, ok = byName[strings.ToLower(name)]
					if !ok {
						return err
					}
				} else {
					tag = created
					byName[strings.ToLower(name)] = tag
				}
			}
			_ = q.SetTradeTags(ctx, store.SetTradeTagsParams{TradeID: tradeID, TagID: tag.ID})
		}
	}

	if ann.Dividends != 0 {
		acc, err := q.GetAccount(ctx, store.GetAccountParams{ID: accountID, UserID: userID})
		if err != nil {
			return err
		}
		tr, err := q.GetTrade(ctx, store.GetTradeParams{ID: tradeID, UserID: userID})
		if err != nil {
			return err
		}
		occurred := tr.OpenedAt
		if tr.ClosedAt.Valid {
			occurred = tr.ClosedAt.Time
		}
		if _, err := q.InsertCashTransaction(ctx, store.InsertCashTransactionParams{
			ID: uuid.NewString(), UserID: userID, AccountID: accountID,
			Type: "dividend", Amount: ann.Dividends, Currency: acc.BaseCurrency,
			OccurredAt: occurred, Note: tr.Symbol + " dividend",
			ImportBatchID: sql.NullString{}, TradeID: sql.NullString{String: tradeID, Valid: true},
		}); err != nil {
			return err
		}
	}
	return nil
}

func ensureSetup(ctx context.Context, q store.Querier, userID, name string) (string, error) {
	setups, err := q.ListSetups(ctx, userID)
	if err != nil {
		return "", err
	}
	for _, s := range setups {
		if strings.EqualFold(s.Name, name) {
			return s.ID, nil
		}
	}
	created, err := q.CreateSetup(ctx, store.CreateSetupParams{
		ID: uuid.NewString(), UserID: userID, Name: name,
		Description: "", Thesis: "", Symbol: "", Direction: "",
		TargetPrice: sql.NullFloat64{}, StopPrice: sql.NullFloat64{}, Checklist: "[]",
	})
	if err != nil {
		return "", err
	}
	return created.ID, nil
}

// UpsertSetups restores a playbook catalog from a JSON backup.
// Matching is case-insensitive by name; existing setups are overwritten with catalog fields.
func UpsertSetups(ctx context.Context, q store.Querier, userID string, catalog []JSONSetup) (int, error) {
	if len(catalog) == 0 {
		return 0, nil
	}
	existing, err := q.ListSetups(ctx, userID)
	if err != nil {
		return 0, err
	}
	byName := make(map[string]store.Setup, len(existing))
	for _, s := range existing {
		byName[strings.ToLower(s.Name)] = s
	}

	applied := 0
	for _, item := range catalog {
		name := strings.TrimSpace(item.Name)
		if name == "" {
			continue
		}
		target := sql.NullFloat64{}
		if item.TargetPrice != nil {
			target = sql.NullFloat64{Float64: *item.TargetPrice, Valid: true}
		}
		stop := sql.NullFloat64{}
		if item.StopPrice != nil {
			stop = sql.NullFloat64{Float64: *item.StopPrice, Valid: true}
		}
		checklist := item.Checklist
		if checklist == nil {
			checklist = []string{}
		}
		checklistJSON, err := json.Marshal(checklist)
		if err != nil {
			checklistJSON = []byte("[]")
		}
		dir := strings.ToLower(strings.TrimSpace(item.Direction))
		if dir != "long" && dir != "short" {
			dir = ""
		}

		if cur, ok := byName[strings.ToLower(name)]; ok {
			if err := q.UpdateSetup(ctx, store.UpdateSetupParams{
				Name: name, Description: item.Description, Thesis: item.Thesis,
				Symbol: item.Symbol, Direction: dir, TargetPrice: target, StopPrice: stop,
				Checklist: string(checklistJSON), ID: cur.ID, UserID: userID,
			}); err != nil {
				return applied, err
			}
			applied++
			continue
		}
		created, err := q.CreateSetup(ctx, store.CreateSetupParams{
			ID: uuid.NewString(), UserID: userID, Name: name,
			Description: item.Description, Thesis: item.Thesis, Symbol: item.Symbol,
			Direction: dir, TargetPrice: target, StopPrice: stop, Checklist: string(checklistJSON),
		})
		if err != nil {
			return applied, err
		}
		byName[strings.ToLower(name)] = created
		applied++
	}
	return applied, nil
}
