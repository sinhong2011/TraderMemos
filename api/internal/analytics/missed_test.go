package analytics

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestPlannedR(t *testing.T) {
	long := MissedPlan{Direction: "long", Entry: fp(100), Stop: fp(98), Target: fp(105)}
	require.InDelta(t, 2.5, *long.PlannedR(), 1e-9)

	short := MissedPlan{Direction: "short", Entry: fp(50), Stop: fp(51), Target: fp(47)}
	require.InDelta(t, 3.0, *short.PlannedR(), 1e-9)

	require.Nil(t, MissedPlan{Direction: "long", Entry: fp(100), Stop: fp(98)}.PlannedR(), "no target")
	require.Nil(t, MissedPlan{Direction: "long", Entry: fp(100), Stop: fp(101), Target: fp(105)}.PlannedR(), "stop above a long entry")
	require.Nil(t, MissedPlan{Direction: "short", Entry: fp(50), Stop: fp(51), Target: fp(52)}.PlannedR(), "target above a short entry")
	require.Nil(t, MissedPlan{Direction: "sideways", Entry: fp(1), Stop: fp(0), Target: fp(2)}.PlannedR())
}

func TestMissedR(t *testing.T) {
	require.InDelta(t, 2.5, *MissedR(MissedTarget, fp(2.5)), 1e-9)
	require.Nil(t, MissedR(MissedTarget, nil), "a target hit without a plan cannot be priced")
	require.InDelta(t, -1.0, *MissedR(MissedStop, nil), 1e-9)
	require.InDelta(t, 0.0, *MissedR(MissedNoTrigger, nil), 1e-9)
	require.Nil(t, MissedR(MissedUnknown, fp(2)))
}

func TestSummarizeMissed(t *testing.T) {
	s := SummarizeMissed([]MissedTrade{
		{Reason: MissedHesitated, SetupID: "orb", Outcome: MissedTarget, PlannedR: fp(2)},
		{Reason: MissedHesitated, SetupID: "orb", Outcome: MissedTarget, PlannedR: fp(3)},
		{Reason: MissedHesitated, Outcome: MissedStop, PlannedR: fp(2)},
		{Reason: MissedAway, SetupID: "vwap", Outcome: MissedNoTrigger},
		{Reason: MissedRules, Outcome: MissedUnknown, PlannedR: fp(4)},
		{Reason: "", Outcome: MissedTarget}, // hit, but no plan to price it
	})
	require.Equal(t, 6, s.Count)
	require.Equal(t, map[string]int{"unknown": 1, "target": 3, "stop": 1, "no_trigger": 1}, s.Outcomes)
	require.Equal(t, 4, s.Scored)
	require.Equal(t, 1, s.Unpriced)
	require.InDelta(t, 5.0, s.RLeft, 1e-9)
	require.InDelta(t, 1.0, s.RAvoided, 1e-9)
	require.InDelta(t, 4.0, s.NetR, 1e-9)
	require.InDelta(t, 1.0, *s.AvgR, 1e-9)

	require.Equal(t, MissedGroup{Key: MissedHesitated, Count: 3, Scored: 3, NetR: 4}, s.ByReason[0])
	require.Equal(t, []MissedGroup{
		{Key: "orb", Count: 2, Scored: 2, NetR: 5},
		{Key: "vwap", Count: 1, Scored: 1, NetR: 0},
	}, s.BySetup)
}

func TestSummarizeMissedEmpty(t *testing.T) {
	s := SummarizeMissed(nil)
	require.Equal(t, 0, s.Count)
	require.Nil(t, s.AvgR)
	require.NotNil(t, s.ByReason)
	require.NotNil(t, s.BySetup)
}
