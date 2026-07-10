package analytics

import "github.com/tradermemos/api/internal/money"

// RiskTrade is a closed trade with known initial risk (R).
type RiskTrade struct {
	NetPnl      float64
	InitialRisk float64
	FeesTotal   float64
}

// RSummary mirrors Summary but in R-multiples. Only trades with InitialRisk > 0
// are included; Excluded counts closed trades skipped for missing risk.
type RSummary struct {
	Summary
	Excluded       int                `json:"excluded"`
	AvgR           float64            `json:"avg_r"`
	AvgWinR        float64            `json:"avg_win_r"`
	AvgLossR       float64            `json:"avg_loss_r"`
	BestR          float64            `json:"best_r"`
	WorstR         float64            `json:"worst_r"`
	Distribution   []RBucket          `json:"distribution"`
}

type RBucket struct {
	Label string  `json:"label"`
	Count int     `json:"count"`
	From  float64 `json:"from"`
	To    float64 `json:"to"`
}

// SummarizeR converts dollar P&L into R and summarizes. Trades with non-positive
// InitialRisk are omitted from the stats and counted in Excluded.
func SummarizeR(ts []RiskTrade, excluded int) RSummary {
	var rs RSummary
	rs.Excluded = excluded
	rTrades := make([]ClosedTrade, 0, len(ts))
	var sumR, sumWinR, sumLossR float64
	var wins, losses int
	best, worst := 0.0, 0.0
	hasBest, hasWorst := false, false
	buckets := defaultRBuckets()

	for _, t := range ts {
		if t.InitialRisk <= 0 {
			rs.Excluded++
			continue
		}
		r := money.Round2(t.NetPnl / t.InitialRisk)
		rTrades = append(rTrades, ClosedTrade{NetPnl: r, FeesTotal: 0})
		sumR += r
		switch {
		case r > 0:
			wins++
			sumWinR += r
			if !hasBest || r > best {
				best, hasBest = r, true
			}
		case r < 0:
			losses++
			sumLossR += r
			if !hasWorst || r < worst {
				worst, hasWorst = r, true
			}
		}
		for i := range buckets {
			b := &buckets[i]
			if i == len(buckets)-1 {
				if r >= b.From {
					b.Count++
				}
				break
			}
			if r >= b.From && r < b.To {
				b.Count++
				break
			}
		}
	}

	rs.Summary = Summarize(rTrades)
	if len(rTrades) > 0 {
		rs.AvgR = money.Round2(sumR / float64(len(rTrades)))
	}
	if wins > 0 {
		rs.AvgWinR = money.Round2(sumWinR / float64(wins))
	}
	if losses > 0 {
		rs.AvgLossR = money.Round2(sumLossR / float64(losses))
	}
	if hasBest {
		rs.BestR = money.Round2(best)
	}
	if hasWorst {
		rs.WorstR = money.Round2(worst)
	}
	rs.Distribution = buckets
	return rs
}

func defaultRBuckets() []RBucket {
	return []RBucket{
		{Label: "< -2R", From: -1e9, To: -2},
		{Label: "-2R to -1R", From: -2, To: -1},
		{Label: "-1R to 0", From: -1, To: 0},
		{Label: "0 to 1R", From: 0, To: 1},
		{Label: "1R to 2R", From: 1, To: 2},
		{Label: "≥ 2R", From: 2, To: 1e9},
	}
}
