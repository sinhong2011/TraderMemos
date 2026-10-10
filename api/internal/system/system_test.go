package system

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestSuggestAdherence(t *testing.T) {
	require.Equal(t, "", SuggestAdherence(nil))
	require.Equal(t, AdherenceFull, SuggestAdherence(map[string]bool{
		CheckPlannedEntry: true, CheckPresetExit: true, CheckRiskAsPlanned: true,
		CheckExitByPlan: true, CheckNoManualEdits: true,
	}))
	require.Equal(t, AdherenceNone, SuggestAdherence(map[string]bool{
		CheckPlannedEntry: false, CheckPresetExit: false,
	}))
	require.Equal(t, AdherencePartial, SuggestAdherence(map[string]bool{
		CheckPlannedEntry: true, CheckPresetExit: false,
	}))
}

func TestPlanSemantics(t *testing.T) {
	steps := Plan(PlanInput{Executable: 16, Activated: 1, HistoryTrades: 10, LiveTrades: 10})
	require.Equal(t, "write", steps[0].Key)
	require.True(t, steps[0].Done)
	require.True(t, steps[1].Done)
	require.True(t, steps[2].Done)
	require.Equal(t, "revise", steps[3].Key)
	require.False(t, steps[3].Done, "one activation is not a revision")

	steps = Plan(PlanInput{Executable: 16, Activated: 2, HistoryTrades: 10, LiveTrades: 10})
	require.True(t, steps[3].Done)
}

func TestSampleBandIsAdequateNotReliable(t *testing.T) {
	require.Equal(t, SampleThin, sampleBand(5))
	require.Equal(t, SampleHint, sampleBand(15))
	require.Equal(t, SampleSolid, sampleBand(30))
	require.Equal(t, "adequate", SampleSolid)
}

func tr(id string, day int, pnl float64, adh, regime string) Trade {
	return Trade{
		ID: id, OpenedAt: time.Date(2026, 1, day, 14, 0, 0, 0, time.UTC),
		ClosedAt: time.Date(2026, 1, day, 15, 0, 0, 0, time.UTC),
		NetPnl: pnl, Carded: true, Adherence: adh, Regime: regime,
	}
}

func TestStreakRegimeRespectsDefensiveTrading(t *testing.T) {
	// Three losses while Defensive must not score as a regime cause.
	trades := []Trade{
		tr("a", 5, -10, AdherenceFull, StanceDefensive),
		tr("b", 4, -10, AdherenceFull, StanceDefensive),
		tr("c", 3, -10, AdherenceFull, StanceDefensive),
		tr("d", 2, 20, AdherenceFull, StanceNormal),
		tr("e", 1, 10, AdherenceFull, StanceNormal),
	}
	s := diagnoseStreak(trades)
	require.NotNil(t, s)
	require.Equal(t, 3, s.Length)
	for _, c := range s.Causes {
		if c.Key == "regime" {
			require.Equal(t, 0.0, c.Score)
		}
	}

	paused := []Trade{
		tr("a", 5, -10, AdherenceFull, StancePaused),
		tr("b", 4, -10, AdherenceFull, StancePaused),
		tr("c", 3, -10, AdherenceFull, StancePaused),
		tr("d", 2, 20, AdherenceFull, StanceNormal),
	}
	s = diagnoseStreak(paused)
	require.NotNil(t, s)
	var regime float64
	for _, c := range s.Causes {
		if c.Key == "regime" {
			regime = c.Score
		}
	}
	require.Equal(t, 1.0, regime)
}

func TestQuadrantSplitsOnAdherence(t *testing.T) {
	r := Compute([]Trade{
		tr("1", 1, 10, AdherenceFull, StanceNormal),
		tr("2", 2, -5, AdherenceFull, StanceNormal),
		tr("3", 3, 8, AdherenceNone, StanceNormal),
		tr("4", 4, -3, AdherencePartial, StanceNormal),
	})
	require.Equal(t, 1, r.Quadrant.RightWin.Trades)
	require.Equal(t, 1, r.Quadrant.RightLoss.Trades)
	require.Equal(t, 1, r.Quadrant.WrongWin.Trades)
	require.Equal(t, 1, r.Quadrant.WrongLoss.Trades)
}
