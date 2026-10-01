package routines

import (
	"testing"

	"github.com/stretchr/testify/require"
)

// 2026-09-28 is a Monday.

func TestMaskRoundTrip(t *testing.T) {
	require.Equal(t, int64(MonToFri), MaskFromDays([]int{1, 2, 3, 4, 5}))
	require.Equal(t, []int{1, 2, 3, 4, 5}, DaysFromMask(MonToFri))
	require.Equal(t, int64(1), MaskFromDays([]int{0, 7, -1}))
}

func TestOnDay(t *testing.T) {
	it := Item{ID: "a", Weekdays: MonToFri, StartDay: "2026-09-28"}
	require.True(t, it.OnDay("2026-09-28"))
	require.False(t, it.OnDay("2026-09-27"), "Sunday, and before start")
	require.False(t, it.OnDay("2026-10-03"), "Saturday")
	require.False(t, it.OnDay("bogus"))

	it.EndDay = "2026-09-30"
	require.True(t, it.OnDay("2026-09-29"))
	require.False(t, it.OnDay("2026-09-30"), "archived from end_day on")
}

func TestDayItemsOrdersByStageThenPositionAndKeepsOffScheduleTicks(t *testing.T) {
	items := []Item{
		{ID: "post", Stage: StagePost, Weekdays: AllWeek, StartDay: "2026-01-01"},
		{ID: "pre2", Stage: StagePre, Position: 2, Weekdays: AllWeek, StartDay: "2026-01-01"},
		{ID: "pre1", Stage: StagePre, Position: 1, Weekdays: AllWeek, StartDay: "2026-01-01"},
		{ID: "weekday", Stage: StageDuring, Weekdays: MonToFri, StartDay: "2026-01-01"},
	}
	ids := func(its []Item) []string {
		out := []string{}
		for _, it := range its {
			out = append(out, it.ID)
		}
		return out
	}
	require.Equal(t, []string{"pre1", "pre2", "weekday", "post"}, ids(DayItems(items, Checks{}, "2026-09-28")))

	sat := "2026-10-03"
	require.Equal(t, []string{"pre1", "pre2", "post"}, ids(DayItems(items, Checks{}, sat)))
	checks := Checks{}
	checks.Add(sat, "weekday")
	require.Equal(t, []string{"pre1", "pre2", "weekday", "post"}, ids(DayItems(items, checks, sat)))
}

func TestHistoryRateAndStreak(t *testing.T) {
	items := []Item{
		{ID: "a", Stage: StagePre, Weekdays: MonToFri, StartDay: "2026-09-28"},
		{ID: "b", Stage: StagePost, Weekdays: MonToFri, StartDay: "2026-09-28"},
	}
	checks := Checks{}
	// Mon both, Tue only a, Wed both, Thu both (today), weekend off.
	for _, c := range [][2]string{
		{"2026-09-28", "a"}, {"2026-09-28", "b"},
		{"2026-09-29", "a"},
		{"2026-09-30", "a"}, {"2026-09-30", "b"},
		{"2026-10-01", "a"}, {"2026-10-01", "b"},
	} {
		checks.Add(c[0], c[1])
	}
	days := History(items, checks, "2026-09-27", "2026-10-01")
	require.Len(t, days, 5)
	require.Equal(t, DaySummary{Day: "2026-09-27"}, days[0], "Sunday: nothing scheduled")
	require.Equal(t, Tally{Total: 2, Done: 1}, days[2].Tally)

	rate := CompletionRate(days)
	require.NotNil(t, rate)
	require.InDelta(t, 7.0/8.0, *rate, 1e-9)
	require.Equal(t, 2, Streak(days, "2026-10-01"), "Wed + Thu; Tue broke it")

	byStage := ByStage(items, checks, "2026-09-27", "2026-10-01")
	require.Equal(t, Tally{Total: 4, Done: 4}, byStage[StagePre])
	require.Equal(t, Tally{Total: 4, Done: 3}, byStage[StagePost])
	require.Equal(t, Tally{}, byStage[StageDuring])
}

func TestStreakSkipsUnfinishedToday(t *testing.T) {
	days := []DaySummary{
		{Day: "2026-09-29", Tally: Tally{Total: 1, Done: 1}},
		{Day: "2026-09-30", Tally: Tally{Total: 1, Done: 1}},
		{Day: "2026-10-01", Tally: Tally{Total: 2, Done: 1}},
	}
	require.Equal(t, 2, Streak(days, "2026-10-01"))
	require.Equal(t, 0, Streak(days, "2026-10-02"), "yesterday unfinished breaks it")
}

func TestCompletionRateNilWithoutAList(t *testing.T) {
	require.Nil(t, CompletionRate([]DaySummary{{Day: "2026-10-04"}}))
}

func TestDoneTasks(t *testing.T) {
	body := "Checklist:\n- [x] Confirm market bias\n- [ ] Check news events\n* [X]  Mark levels  \nnot a task\n- [x] "
	require.Equal(t, []string{"Confirm market bias", "Mark levels"}, DoneTasks(body))
}
