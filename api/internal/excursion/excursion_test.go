package excursion

import (
	"math"
	"testing"
	"time"

	"github.com/tradermemos/api/internal/marketdata"
)

var t0 = time.Date(2026, 7, 1, 14, 30, 0, 0, time.UTC)

func bar(offsetMin int, high, low float64) marketdata.Bar {
	return marketdata.Bar{
		Time: t0.Add(time.Duration(offsetMin) * time.Minute).Unix(),
		Open: (high + low) / 2, High: high, Low: low, Close: (high + low) / 2,
	}
}

func fill(offsetMin int, side string, qty, price float64) Fill {
	return Fill{Side: side, Quantity: qty, Price: price, ExecutedAt: t0.Add(time.Duration(offsetMin) * time.Minute)}
}

func almost(t *testing.T, name string, got, want float64) {
	t.Helper()
	if math.Abs(got-want) > 1e-9 {
		t.Errorf("%s = %v, want %v", name, got, want)
	}
}

func TestComputeLongRoundTrip(t *testing.T) {
	// Buy 100 @ 50, dips to 49, rallies to 53, sold 100 @ 52.
	bars := []marketdata.Bar{
		bar(0, 50.5, 49.8),
		bar(1, 50.2, 49.0),
		bar(2, 53.0, 50.0),
		bar(3, 52.5, 51.5),
	}
	fills := []Fill{
		fill(0, "buy", 100, 50),
		fill(3, "sell", 100, 52),
	}
	res, err := Compute(bars, "1", fills)
	if err != nil {
		t.Fatal(err)
	}
	almost(t, "mae", res.Mae, 100) // (50-49)*100
	almost(t, "mfe", res.Mfe, 300) // (53-50)*100
	// The exit bar is not evaluated open — the position closes as its fills apply.
	if res.BarsUsed != 3 {
		t.Errorf("bars_used = %d, want 3", res.BarsUsed)
	}
}

func TestComputeShort(t *testing.T) {
	// Short 50 @ 200, spikes against to 204, falls to 190, covered @ 195.
	bars := []marketdata.Bar{
		bar(0, 204, 199),
		bar(1, 202, 190),
		bar(2, 196, 193),
	}
	fills := []Fill{
		fill(0, "sell", 50, 200),
		fill(2, "buy", 50, 195),
	}
	res, err := Compute(bars, "1", fills)
	if err != nil {
		t.Fatal(err)
	}
	almost(t, "mae", res.Mae, 200) // (204-200)*50
	almost(t, "mfe", res.Mfe, 500) // (200-190)*50
}

func TestComputePartialExitKeepsRealized(t *testing.T) {
	// Buy 200 @ 10; sell 100 @ 12 (realized +200); rest rides to 13, out @ 11.
	bars := []marketdata.Bar{
		bar(0, 10.5, 9.9),
		bar(1, 12.0, 10.4),
		bar(2, 13.0, 11.8),
		bar(3, 12.0, 11.0),
	}
	fills := []Fill{
		fill(0, "buy", 200, 10),
		fill(1, "sell", 100, 12),
		fill(3, "sell", 100, 11),
	}
	res, err := Compute(bars, "1", fills)
	if err != nil {
		t.Fatal(err)
	}
	// Peak: realized 200 + open (13-10)*100 = 500. Dip: (10-9.9)*200 = 20.
	almost(t, "mfe", res.Mfe, 500)
	almost(t, "mae", res.Mae, 20)
}

func TestComputeMultiplier(t *testing.T) {
	// One MES contract (mult 5): long from 5000, low 4990, high 5012.
	bars := []marketdata.Bar{
		bar(0, 5005, 4990),
		bar(1, 5012, 5000),
	}
	fills := []Fill{
		{Side: "buy", Quantity: 1, Price: 5000, Multiplier: 5, ExecutedAt: t0},
		// Exit lands after the last bar; the trailing fill loop settles it.
		{Side: "sell", Quantity: 1, Price: 5010, Multiplier: 5, ExecutedAt: t0.Add(150 * time.Second)},
	}
	res, err := Compute(bars, "1", fills)
	if err != nil {
		t.Fatal(err)
	}
	almost(t, "mae", res.Mae, 50) // 10 pts * 5
	almost(t, "mfe", res.Mfe, 60) // 12 pts * 5
}

func TestComputeScaleInAveragesCost(t *testing.T) {
	// 100 @ 10 then 100 @ 12 -> avg 11; high 13 => (13-11)*200 = 400.
	bars := []marketdata.Bar{
		bar(0, 10.2, 9.95),
		bar(1, 12.1, 11.8),
		bar(2, 13.0, 12.0),
		bar(3, 12.6, 12.2),
	}
	fills := []Fill{
		fill(0, "buy", 100, 10),
		fill(1, "buy", 100, 12),
		fill(3, "sell", 200, 12.5),
	}
	res, err := Compute(bars, "1", fills)
	if err != nil {
		t.Fatal(err)
	}
	almost(t, "mfe", res.Mfe, 400)
	// Worst dip: before the add, (10-9.95)*100 = 5.
	almost(t, "mae", res.Mae, 5)
}

func TestComputeNoBars(t *testing.T) {
	if _, err := Compute(nil, "1", []Fill{fill(0, "buy", 1, 1)}); err != ErrNoBars {
		t.Fatalf("err = %v, want ErrNoBars", err)
	}
	// Bars exist but the position never overlaps them.
	bars := []marketdata.Bar{bar(0, 10, 9)}
	late := []Fill{fill(60, "buy", 1, 9.5), fill(61, "sell", 1, 9.6)}
	if _, err := Compute(bars, "1", late); err != ErrNoBars {
		t.Fatalf("err = %v, want ErrNoBars", err)
	}
}

func TestChooseInterval(t *testing.T) {
	now := time.Date(2026, 8, 1, 0, 0, 0, 0, time.UTC)
	day := 24 * time.Hour
	cases := []struct {
		age, hold time.Duration
		want      string
	}{
		{2 * day, 2 * time.Hour, "1"},
		{40 * day, 2 * time.Hour, "5"},
		{2 * day, 5 * day, "5"},
		{40 * day, 20 * day, "15"},
		{200 * day, 3 * day, "60"},
		{800 * day, 2 * time.Hour, "D"},
		{100 * day, 200 * day, "D"},
	}
	for _, c := range cases {
		opened := now.Add(-c.age)
		if got := ChooseInterval(opened, opened.Add(c.hold), now); got != c.want {
			t.Errorf("ChooseInterval(age=%v hold=%v) = %q, want %q", c.age, c.hold, got, c.want)
		}
	}
}
