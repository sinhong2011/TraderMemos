package analytics

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func axCfg() ExecScoreConfig {
	cfg := DefaultExecScoreConfig()
	cfg.MinTempoDays = 1
	return cfg
}

func TestTradeAxesForUnknownTrade(t *testing.T) {
	_, ok := TradeAxesFor("nope", []ScoreTrade{est("a", "AAPL", 1, 10, 50, 100, fp(0), fp(100))},
		ComplianceRules{}, axCfg(), time.UTC)
	require.False(t, ok)
}

func TestTradeAxesForEntryAndExit(t *testing.T) {
	// MAE 50 against MFE 150 → entry = 1 − 50/200 = 75.
	// Net 75 against MFE 150 → exit = 50.
	trades := []ScoreTrade{est("a", "AAPL", 1, 10, 75, 100, fp(50), fp(150))}
	ax, ok := TradeAxesFor("a", trades, ComplianceRules{}, axCfg(), time.UTC)

	require.True(t, ok)
	require.NotNil(t, ax.Entry)
	require.Equal(t, 75.0, *ax.Entry)
	require.NotNil(t, ax.Exit)
	require.Equal(t, 50.0, *ax.Exit)
}

// A trade with no recorded excursion must report nil, not zero — a zero would
// read to the coach as a failing entry rather than as missing data.
func TestTradeAxesForMissingExcursionIsNilNotZero(t *testing.T) {
	trades := []ScoreTrade{est("a", "AAPL", 1, 10, 75, 100, nil, nil)}
	ax, ok := TradeAxesFor("a", trades, ComplianceRules{}, axCfg(), time.UTC)

	require.True(t, ok)
	require.Nil(t, ax.Entry)
	require.Nil(t, ax.Exit)
	require.NotNil(t, ax.Risk, "risk is scorable without excursion data")
}

func TestTradeAxesForRiskDisciplineWithoutRules(t *testing.T) {
	recorded := []ScoreTrade{est("a", "AAPL", 1, 10, 50, 100, nil, nil)}
	ax, _ := TradeAxesFor("a", recorded, ComplianceRules{}, axCfg(), time.UTC)
	require.Equal(t, 100.0, *ax.Risk)
	require.True(t, ax.RiskRecorded)
	require.False(t, ax.RulesConfigured)

	unrecorded := []ScoreTrade{est("a", "AAPL", 1, 10, 50, 0, nil, nil)}
	ax, _ = TradeAxesFor("a", unrecorded, ComplianceRules{}, axCfg(), time.UTC)
	require.Equal(t, 0.0, *ax.Risk)
	require.False(t, ax.RiskRecorded)
}

func TestTradeAxesForOverMaxRisk(t *testing.T) {
	trades := []ScoreTrade{est("a", "AAPL", 1, 10, 50, 500, nil, nil)}
	ax, _ := TradeAxesFor("a", trades, ComplianceRules{MaxRiskPerTrade: 100}, axCfg(), time.UTC)

	// Risk was defined (0.5) but broke the rule (0) → 50.
	require.Equal(t, 50.0, *ax.Risk)
	require.True(t, ax.OverMaxRisk)
	require.True(t, ax.RulesConfigured)
}

func TestTradeAxesForDailyLossBreachTaintsTheDay(t *testing.T) {
	// The day dips past −200 on the first trade; the second trade is on the
	// same day and inherits the breach.
	trades := []ScoreTrade{
		est("a", "AAPL", 1, 10, -250, 50, nil, nil),
		est("b", "MSFT", 1, 12, 40, 50, nil, nil),
	}
	ax, _ := TradeAxesFor("b", trades, ComplianceRules{MaxDailyLoss: 200}, axCfg(), time.UTC)

	require.True(t, ax.DailyLossBreach)
	require.Equal(t, 50.0, *ax.Risk)
	require.False(t, ax.OverMaxRisk)
}

func TestTradeAxesForQuickReentryDocksTempo(t *testing.T) {
	// est closes 30 minutes after open, so a same-symbol trade opened at 11:00
	// follows the 10:00 trade's 10:30 close inside the 15-minute window.
	base := time.Date(2026, 7, 1, 10, 0, 0, 0, time.UTC)
	trades := []ScoreTrade{
		{ID: "a", Symbol: "AAPL", NetPnl: 10, OpenedAt: base, ClosedAt: base.Add(30 * time.Minute)},
		{
			ID: "b", Symbol: "AAPL", NetPnl: -5,
			OpenedAt: base.Add(40 * time.Minute),
			ClosedAt: base.Add(70 * time.Minute),
		},
	}
	ax, _ := TradeAxesFor("b", trades, ComplianceRules{}, axCfg(), time.UTC)

	require.Equal(t, 0.0, *ax.Tempo)
	require.True(t, ax.QuickReentry)
}

func TestTradeAxesForCleanTempo(t *testing.T) {
	trades := []ScoreTrade{
		est("a", "AAPL", 1, 10, 50, 100, nil, nil),
		est("b", "MSFT", 2, 10, 50, 100, nil, nil),
	}
	ax, _ := TradeAxesFor("b", trades, ComplianceRules{}, axCfg(), time.UTC)

	require.Equal(t, 100.0, *ax.Tempo)
	require.False(t, ax.QuickReentry)
	require.False(t, ax.Overtraded)
}

// The per-trade axes must agree with the aggregate the reports page shows:
// one trade's Entry is the ExecScore Entry over a single-trade set.
func TestTradeAxesForAgreesWithExecScore(t *testing.T) {
	trades := []ScoreTrade{est("a", "AAPL", 1, 10, 75, 100, fp(50), fp(150))}
	cfg := axCfg()
	cfg.MinTrades = 1

	rep := ExecScore(trades, ComplianceRules{}, cfg, time.UTC, "week")
	ax, ok := TradeAxesFor("a", trades, ComplianceRules{}, cfg, time.UTC)

	require.True(t, ok)
	require.Equal(t, *rep.Entry.Score, *ax.Entry)
	require.Equal(t, *rep.Exit.Score, *ax.Exit)
	require.Equal(t, *rep.Risk.Score, *ax.Risk)
	require.Equal(t, *rep.Tempo.Score, *ax.Tempo)
}
