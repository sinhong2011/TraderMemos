package importer

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/tradermemos/api/internal/store"
	"github.com/tradermemos/api/internal/trades"
)

// CommitResult is the outcome of inserting parsed executions and annotations.
type CommitResult struct {
	Inserted  int
	Skipped   int
	Annotated int
	Trades    int
	Errors    []RowError
	Format    string
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
	// Journal lots where an earlier leg was skipped (already in DB). Skip the rest of
	// that lot so a re-import does not insert an orphan avg-exit sell as an OPEN short.
	skippedLots := map[string]bool{}

	// One round trip answers the dedup question for the whole file. `seen` then
	// grows as rows are accepted, so a fill repeated inside the same file is
	// still skipped — the row-at-a-time path got that from its own prior insert.
	hashes := make([]string, len(parsed.Executions))
	for i, pe := range parsed.Executions {
		hashes[i] = DedupHash(pe.Symbol, pe.Side, pe.Quantity, pe.Price, pe.ExecutedAt)
	}
	seen, err := store.BulkExistingDedupHashes(ctx, q, accountID, hashes)
	if err != nil {
		return res, fmt.Errorf("dedup check for %d executions: %w", len(hashes), err)
	}

	multipliers := map[string]float64{}
	inserts := make([]store.InsertExecutionParams, 0, len(parsed.Executions))
	for i, pe := range parsed.Executions {
		mult := resolveMultiplierCached(ctx, q, multipliers, pe)
		if pe.LotKey != "" && skippedLots[pe.LotKey] {
			res.Skipped++
			continue
		}
		hash := hashes[i]
		if _, exists := seen[hash]; exists {
			if pe.LotKey != "" {
				skippedLots[pe.LotKey] = true
			}
			res.Skipped++
			continue
		}
		seen[hash] = struct{}{}
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
		inserts = append(inserts, store.InsertExecutionParams{
			ID: id, UserID: userID, AccountID: accountID, ExternalID: ext,
			Symbol: pe.Symbol, InstrumentType: pe.InstrumentType, Side: pe.Side,
			Quantity: pe.Quantity, Price: pe.Price, Fees: pe.Fees, Commission: pe.Commission,
			ExecutedAt: pe.ExecutedAt, Multiplier: mult, Details: details,
			ImportBatchID: batchID, DedupHash: hash,
		})
		res.Inserted++
		if pe.Annotation != nil {
			pendingAnns = append(pendingAnns, pending{tradeID: id, ann: pe.Annotation})
		}
	}

	if err := store.BulkInsertExecutions(ctx, q, inserts); err != nil {
		return res, fmt.Errorf("insert %d executions: %w", len(inserts), err)
	}

	if err := trades.NewService(q).Regroup(ctx, userID, accountID); err != nil {
		return res, fmt.Errorf("regroup trades after %d inserts: %w", res.Inserted, err)
	}

	if len(pendingAnns) > 0 {
		cache, err := newAnnotationCache(ctx, q, userID)
		if err != nil {
			return res, fmt.Errorf("load journal catalog: %w", err)
		}
		journals := make([]store.UpsertTradeJournalParams, 0, len(pendingAnns))
		tagLinks := []store.SetTradeTagsParams{}
		for _, p := range pendingAnns {
			journal, links, err := prepareAnnotation(ctx, q, cache, userID, accountID, p.tradeID, p.ann)
			if err != nil {
				res.Errors = append(res.Errors, RowError{Row: 0, Message: "annotation: " + err.Error()})
				continue
			}
			journals = append(journals, journal)
			tagLinks = append(tagLinks, links...)
			res.Annotated++
		}
		if err := store.BulkUpsertTradeJournals(ctx, q, journals); err != nil {
			return res, fmt.Errorf("write %d journal entries: %w", len(journals), err)
		}
		if err := store.BulkSetTradeTags(ctx, q, tagLinks); err != nil {
			return res, fmt.Errorf("link %d trade tags: %w", len(tagLinks), err)
		}
	}
	return res, nil
}

// resolveMultiplierCached memoizes ResolveMultiplier, which hits
// instrument_specs once per futures symbol root.
func resolveMultiplierCached(ctx context.Context, q store.Querier, cache map[string]float64, pe ParsedExecution) float64 {
	if pe.Multiplier > 0 {
		return pe.Multiplier
	}
	key := pe.InstrumentType + "|" + pe.Symbol
	if m, ok := cache[key]; ok {
		return m
	}
	m := ResolveMultiplier(ctx, q, pe.InstrumentType, pe.Symbol, pe.Multiplier)
	cache[key] = m
	return m
}

// annotationCache holds the per-user catalogs an annotation reads. Loading each
// one once turns three round trips per annotated trade into three per import.
type annotationCache struct {
	setups   map[string]store.Setup        // lower(name) -> setup
	tags     map[string]store.Tag          // lower(name) -> tag
	journals map[string]store.TradeJournal // trade id -> row as it stands now
}

func newAnnotationCache(ctx context.Context, q store.Querier, userID string) (*annotationCache, error) {
	c := &annotationCache{
		setups:   map[string]store.Setup{},
		tags:     map[string]store.Tag{},
		journals: map[string]store.TradeJournal{},
	}
	setups, err := q.ListSetups(ctx, userID)
	if err != nil {
		return nil, err
	}
	for _, s := range setups {
		c.setups[strings.ToLower(s.Name)] = s
	}
	tags, err := q.ListTags(ctx, userID)
	if err != nil {
		return nil, err
	}
	for _, t := range tags {
		c.tags[strings.ToLower(t.Name)] = t
	}
	journals, err := q.ListTradeJournalsForUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	for _, j := range journals {
		c.journals[j.TradeID] = j
	}
	return c, nil
}

// prepareAnnotation resolves one annotation into the journal row and tag links
// to write, creating setups/tags and dividend cash rows as it goes. The journal
// and tag writes themselves are batched by the caller.
func prepareAnnotation(
	ctx context.Context,
	q store.Querier,
	cache *annotationCache,
	userID, accountID, tradeID string,
	ann *TradeAnnotation,
) (store.UpsertTradeJournalParams, []store.SetTradeTagsParams, error) {
	var none store.UpsertTradeJournalParams
	if ann == nil {
		return none, nil, fmt.Errorf("nil annotation for trade %s", tradeID)
	}

	var setupID sql.NullString
	if name := strings.TrimSpace(ann.SetupName); name != "" {
		id, err := ensureSetup(ctx, q, cache, userID, name)
		if err != nil {
			return none, nil, err
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

	// Preserve existing journal fields when annotation leaves them empty
	// (import should still overwrite notes/setup when set).
	cur, hasCur := cache.journals[tradeID]
	notes := ann.Notes
	risk := sql.NullFloat64{}
	quality := sql.NullInt64{}
	mae, mfe := sql.NullFloat64{}, sql.NullFloat64{}
	if hasCur {
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

	journal := store.UpsertTradeJournalParams{
		TradeID: tradeID, UserID: userID, Notes: notes, SetupID: setupID, InitialRisk: risk,
		TargetPrice: target, StopPrice: stop, EmotionalState: emotion, Confidence: confidence,
		TradeQuality: quality, Mae: mae, Mfe: mfe,
	}

	var links []store.SetTradeTagsParams
	for _, ref := range ann.Tags {
		name := strings.TrimSpace(ref.Name)
		if name == "" {
			continue
		}
		kind := ref.Kind
		if kind != "mistake" {
			kind = "custom"
		}
		tag, ok := cache.tags[strings.ToLower(name)]
		if !ok {
			created, err := q.CreateTag(ctx, store.CreateTagParams{
				ID: uuid.NewString(), UserID: userID, Name: name,
				Color: "#CBD5E1", Description: "", Kind: kind,
			})
			if err != nil {
				// Race / duplicate — reload the catalog and look again.
				existing, listErr := q.ListTags(ctx, userID)
				if listErr != nil {
					return none, nil, err
				}
				for _, t := range existing {
					cache.tags[strings.ToLower(t.Name)] = t
				}
				tag, ok = cache.tags[strings.ToLower(name)]
				if !ok {
					return none, nil, err
				}
			} else {
				tag = created
				cache.tags[strings.ToLower(name)] = tag
			}
		}
		links = append(links, store.SetTradeTagsParams{TradeID: tradeID, TagID: tag.ID})
	}

	if ann.Dividends != 0 {
		acc, err := q.GetAccount(ctx, store.GetAccountParams{ID: accountID, UserID: userID})
		if err != nil {
			return none, nil, err
		}
		tr, err := q.GetTrade(ctx, store.GetTradeParams{ID: tradeID, UserID: userID})
		if err != nil {
			return none, nil, err
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
			return none, nil, err
		}
	}
	return journal, links, nil
}

func ensureSetup(ctx context.Context, q store.Querier, cache *annotationCache, userID, name string) (string, error) {
	if s, ok := cache.setups[strings.ToLower(name)]; ok {
		return s.ID, nil
	}
	created, err := q.CreateSetup(ctx, store.CreateSetupParams{
		ID: uuid.NewString(), UserID: userID, Name: name,
		Description: "", Thesis: "", Symbol: "", Direction: "",
		TargetPrice: sql.NullFloat64{}, StopPrice: sql.NullFloat64{}, Checklist: "[]",
	})
	if err != nil {
		return "", err
	}
	cache.setups[strings.ToLower(name)] = created
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
