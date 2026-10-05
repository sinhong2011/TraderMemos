package alerts

import (
	"testing"
	"time"
)

func TestReviewCutoff(t *testing.T) {
	got := ReviewCutoff(`{"theme":"dark","reviewBacklogCutoff":"2026-09-01T00:00:00Z"}`)
	if got == nil || !got.Equal(time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC)) {
		t.Fatalf("want 2026-09-01, got %v", got)
	}
	for _, prefs := range []string{"", "{}", `{"reviewBacklogCutoff":5}`, `{"reviewBacklogCutoff":"soon"}`} {
		if got := ReviewCutoff(prefs); got != nil {
			t.Errorf("%q → want nil, got %v", prefs, got)
		}
	}
}

func TestGraded(t *testing.T) {
	if Graded(false, 3) || Graded(true, 0) || !Graded(true, 1) {
		t.Fatal("graded = valid and positive")
	}
}

func TestCountUnreviewed(t *testing.T) {
	day := func(d int) time.Time { return time.Date(2026, 9, d, 15, 0, 0, 0, time.UTC) }
	trades := []ReviewTrade{
		{ClosedAt: day(2)},                // before the dismissed cutoff
		{ClosedAt: day(10)},               // counts
		{ClosedAt: day(11), Graded: true}, // reviewed
		{ClosedAt: day(12)},               // counts
		{ClosedAt: day(25)},               // too recent
	}
	olderThan := day(20)
	if got := CountUnreviewed(trades, olderThan, nil); got != 3 {
		t.Errorf("no cutoff: want 3, got %d", got)
	}
	cutoff := day(5)
	if got := CountUnreviewed(trades, olderThan, &cutoff); got != 2 {
		t.Errorf("with cutoff: want 2, got %d", got)
	}
}
