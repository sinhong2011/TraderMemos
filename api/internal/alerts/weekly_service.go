package alerts

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"time"
	"uuid"

	"github.com/tradermemos/api/internal/analytics"
	"github.com/tradermemos/api/internal/store"
)

// accountTypeBacktest mirrors api.AccountTypeBacktest — paper trades stay out
// of the review the same way they stay out of every report by default.
const accountTypeBacktest = "backtest"

// WeeklyReview runs the weekly review for one user when it is due at now:
// alerts on, the weekly-review toggle on, now at or past Saturday 09:00 in
// the user's market timezone, and this week not already sent. It creates the
// week's review note (once — a restart reuses it) and pushes a summary that
// opens it. Reports whether it fired.
//
// Delivery is at most once, like the rule alerts: the week is marked sent
// before the channels are called, so a crash mid-send loses that push rather
// than doubling it on the next run.
func (s *Service) WeeklyReview(ctx context.Context, userID string, now time.Time) (bool, error) {
	settings, err := s.q.GetAlertSettings(ctx, userID)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if settings.Enabled == 0 || settings.RuleWeeklyReview == 0 {
		return false, nil
	}

	loc := s.marketLocation(ctx, userID)
	start, due := ReviewWeek(now, loc)
	if !due {
		return false, nil
	}
	week := WeekKey(start)

	ledger, err := s.q.GetWeeklyReview(ctx, store.GetWeeklyReviewParams{UserID: userID, WeekStart: week})
	found := err == nil
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return false, err
	}
	if found && ledger.SentAt.Valid {
		return false, nil
	}

	stats, err := s.weeklyStats(ctx, userID, start, loc)
	if err != nil {
		return false, err
	}

	// Reuse the note a previous (interrupted) run created, unless the owner
	// has since deleted it.
	noteID := ""
	if found && ledger.NoteID != "" {
		_, gerr := s.q.GetJournalNote(ctx, store.GetJournalNoteParams{ID: ledger.NoteID, UserID: userID})
		switch {
		case gerr == nil:
			noteID = ledger.NoteID
		case !errors.Is(gerr, sql.ErrNoRows):
			return false, gerr
		}
	}
	if noteID == "" {
		day := now.In(loc)
		if last := start.AddDate(0, 0, 6); day.After(last) {
			day = last
		}
		note, cerr := s.q.CreateJournalNote(ctx, store.CreateJournalNoteParams{
			ID:         uuid.New().String(),
			UserID:     userID,
			OccurredAt: day.Format("2006-01-02"),
			Title:      WeeklyNoteTitle(start),
			Body:       WeeklyNoteBody(stats),
			Symbols:    "[]",
			NoteType:   NoteTypeWeeklyReview,
		})
		if cerr != nil {
			return false, cerr
		}
		noteID = note.ID
		if uerr := s.q.UpsertWeeklyReviewNote(ctx, store.UpsertWeeklyReviewNoteParams{
			UserID: userID, WeekStart: week, NoteID: noteID,
		}); uerr != nil {
			return false, uerr
		}
	}

	ev := WeeklyEvent(stats, noteID)
	if err := s.q.MarkWeeklyReviewSent(ctx, store.MarkWeeklyReviewSentParams{
		SentAt: sql.NullTime{Time: s.now(), Valid: true}, UserID: userID, WeekStart: week,
	}); err != nil {
		return false, err
	}
	// The alert history row; its dedupe key is the week, so it is written once.
	if _, err := s.q.InsertAlertEvent(ctx, store.InsertAlertEventParams{
		ID: uuid.New().String(), UserID: userID,
		Rule: ev.Rule, DedupeKey: ev.DedupeKey, Title: ev.Title, Body: ev.Body,
	}); err != nil {
		return false, err
	}
	if err := s.dispatch(ctx, userID, []Event{ev}); err != nil {
		return true, err
	}
	return true, nil
}

// marketLocation resolves the account's market timezone; see MarketLocation.
func (s *Service) marketLocation(ctx context.Context, userID string) *time.Location {
	return MarketLocation(ctx, s.q, userID)
}

// PreferencesReader is the one query MarketLocation needs.
type PreferencesReader interface {
	GetUserPreferences(ctx context.Context, userID string) (store.UserPreference, error)
}

// MarketLocation resolves a user's market timezone from the synced
// preferences blob (`marketTimezone`, written by the web and mobile apps),
// falling back to the clients' default when it was never synced. It is the
// server's trading-day clock: the weekly review and routine days follow it.
func MarketLocation(ctx context.Context, q PreferencesReader, userID string) *time.Location {
	name := DefaultMarketTimezone
	if row, err := q.GetUserPreferences(ctx, userID); err == nil {
		var prefs struct {
			MarketTimezone string `json:"marketTimezone"`
		}
		if json.Unmarshal([]byte(row.Prefs), &prefs) == nil && prefs.MarketTimezone != "" {
			name = prefs.MarketTimezone
		}
	}
	if loc, err := time.LoadLocation(name); err == nil {
		return loc
	}
	loc, err := time.LoadLocation(DefaultMarketTimezone)
	if err != nil {
		return time.UTC
	}
	return loc
}

// weeklyStats loads everything the review summarizes and computes it.
func (s *Service) weeklyStats(ctx context.Context, userID string, start time.Time, loc *time.Location) (WeeklyStats, error) {
	accounts, err := s.q.ListAccounts(ctx, userID)
	if err != nil {
		return WeeklyStats{}, err
	}
	backtest := map[string]bool{}
	currency := map[string]string{}
	defaultCurrency := ""
	for _, a := range accounts {
		if a.AccountType == accountTypeBacktest {
			backtest[a.ID] = true
			continue
		}
		currency[a.ID] = a.BaseCurrency
		if defaultCurrency == "" {
			defaultCurrency = a.BaseCurrency
		}
	}
	if defaultCurrency == "" {
		defaultCurrency = "USD"
	}

	rows, err := s.q.ListClosedTrades(ctx, store.ListClosedTradesParams{UserID: userID})
	if err != nil {
		return WeeklyStats{}, err
	}
	journals, err := s.q.ListTradeJournalsForUser(ctx, userID)
	if err != nil {
		return WeeklyStats{}, err
	}
	journalByTrade := make(map[string]store.TradeJournal, len(journals))
	for _, j := range journals {
		journalByTrade[j.TradeID] = j
	}
	setups, err := s.q.ListSetups(ctx, userID)
	if err != nil {
		return WeeklyStats{}, err
	}
	setupName := make(map[string]string, len(setups))
	for _, st := range setups {
		setupName[st.ID] = st.Name
	}

	trades := make([]WeeklyTrade, 0, len(rows))
	for _, t := range rows {
		if backtest[t.AccountID] || !t.NetPnl.Valid || !t.ClosedAt.Valid {
			continue
		}
		wt := WeeklyTrade{NetPnl: t.NetPnl.Float64, ClosedAt: t.ClosedAt.Time, Currency: currency[t.AccountID]}
		if j, ok := journalByTrade[t.ID]; ok {
			if j.InitialRisk.Valid {
				wt.InitialRisk = j.InitialRisk.Float64
			}
			if j.SetupID.Valid {
				wt.Setup = setupName[j.SetupID.String]
			}
		}
		trades = append(trades, wt)
	}

	var rules analytics.ComplianceRules
	rr, err := s.q.GetRiskRules(ctx, userID)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return WeeklyStats{}, err
	}
	if err == nil {
		if rr.MaxRiskPerTrade.Valid {
			rules.MaxRiskPerTrade = rr.MaxRiskPerTrade.Float64
		}
		if rr.MaxDailyLoss.Valid {
			rules.MaxDailyLoss = rr.MaxDailyLoss.Float64
		}
		if rr.MaxTradesPerDay.Valid {
			rules.MaxTradesPerDay = int(rr.MaxTradesPerDay.Int64)
		}
		if rr.MaxConsecutiveLosses.Valid {
			rules.MaxConsecutiveLosses = int(rr.MaxConsecutiveLosses.Int64)
		}
	}

	missedRows, err := s.q.ListMissedTrades(ctx, userID)
	if err != nil {
		return WeeklyStats{}, err
	}
	missed := make([]time.Time, 0, len(missedRows))
	for _, m := range missedRows {
		missed = append(missed, m.ObservedAt)
	}

	return ComputeWeekly(trades, rules, missed, start, loc, defaultCurrency), nil
}
