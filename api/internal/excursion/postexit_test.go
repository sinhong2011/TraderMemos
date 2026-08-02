package excursion

import (
	"errors"
	"testing"
	"time"

	"github.com/tradermemos/api/internal/marketdata"
)

func TestComputePostExitLong(t *testing.T) {
	// Exited long 100 @ 52 at t0+3m; price then runs to 55 and dips to 51.
	exit := t0.Add(3 * time.Minute)
	bars := []marketdata.Bar{
		bar(0, 50.5, 49.8), // before exit — ignored
		bar(3, 53.0, 51.0),
		bar(4, 55.0, 52.5),
	}
	res, err := ComputePostExit(bars, exit, 60, 52, "long", 100, 1)
	if err != nil {
		t.Fatal(err)
	}
	almost(t, "post mfe", res.Mfe, 300) // (55-52)*100 missed run
	almost(t, "post mae", res.Mae, 100) // (52-51)*100 avoided dip
	if res.BarsUsed != 2 {
		t.Errorf("bars_used = %d, want 2", res.BarsUsed)
	}
}

func TestComputePostExitShort(t *testing.T) {
	// Covered short 50 @ 195; price falls to 190 (missed) and pops to 198 (avoided).
	exit := t0
	bars := []marketdata.Bar{
		bar(0, 196, 190),
		bar(1, 198, 194),
	}
	res, err := ComputePostExit(bars, exit, 60, 195, "short", 50, 1)
	if err != nil {
		t.Fatal(err)
	}
	almost(t, "post mfe", res.Mfe, 250) // (195-190)*50
	almost(t, "post mae", res.Mae, 150) // (198-195)*50
}

func TestComputePostExitClampsAtZero(t *testing.T) {
	// Price only falls after a long exit: nothing missed, only avoided.
	bars := []marketdata.Bar{bar(0, 51.5, 50.0)}
	res, err := ComputePostExit(bars, t0, 60, 52, "long", 100, 1)
	if err != nil {
		t.Fatal(err)
	}
	almost(t, "post mfe", res.Mfe, 0)
	almost(t, "post mae", res.Mae, 200) // (52-50)*100
}

func TestComputePostExitRespectsMaxBars(t *testing.T) {
	// The spike in bar 3 is beyond the 2-bar window and must not count.
	bars := []marketdata.Bar{
		bar(0, 52.5, 51.5),
		bar(1, 53.0, 52.0),
		bar(3, 60.0, 52.0),
	}
	res, err := ComputePostExit(bars, t0, 2, 52, "long", 100, 1)
	if err != nil {
		t.Fatal(err)
	}
	almost(t, "post mfe", res.Mfe, 100) // (53-52)*100
	if res.BarsUsed != 2 {
		t.Errorf("bars_used = %d, want 2", res.BarsUsed)
	}
}

func TestComputePostExitMultiplier(t *testing.T) {
	// 2 futures contracts, multiplier 50.
	bars := []marketdata.Bar{bar(0, 53, 51)}
	res, err := ComputePostExit(bars, t0, 60, 52, "long", 2, 50)
	if err != nil {
		t.Fatal(err)
	}
	almost(t, "post mfe", res.Mfe, 100) // (53-52)*2*50
	almost(t, "post mae", res.Mae, 100)
}

func TestComputePostExitNoBars(t *testing.T) {
	// All bars precede the exit — the window hasn't traded yet.
	bars := []marketdata.Bar{bar(0, 51, 50)}
	_, err := ComputePostExit(bars, t0.Add(10*time.Minute), 60, 52, "long", 100, 1)
	if !errors.Is(err, ErrNoBars) {
		t.Fatalf("err = %v, want ErrNoBars", err)
	}
}
