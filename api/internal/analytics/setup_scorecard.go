package analytics

import (
	"math"
	"sort"
	"time"

	"github.com/tradermemos/api/internal/money"
)

// Scorecard thresholds. Tuned for a discretionary day trader's sample sizes;
// kept together so they can be adjusted in one place.
const (
	scoreMinTrades     = 10  // below this a setup is "unproven"
	scoreTrustTrades   = 20  // edge / bleeding need at least this many
	scoreMinRCoverage  = 0.6 // share of trades with initial risk to score in R
	scoreMinCleanCount = 10  // clean (mistake-free) trades needed to call execution
	scoreStaleAfter    = 60 * 24 * time.Hour
	scoreZ95           = 1.96
)

// Verdicts, in the order the scorecard lists them.
const (
	VerdictEdge      = "edge"
	VerdictExecution = "execution"
	VerdictPromising = "promising"
	VerdictWatch     = "watch"
	VerdictUnproven  = "unproven"
	VerdictBleeding  = "bleeding"
)

var verdictRank = map[string]int{
	VerdictEdge: 0, VerdictExecution: 1, VerdictPromising: 2,
	VerdictWatch: 3, VerdictUnproven: 4, VerdictBleeding: 5,
}

// ScorecardTrade is one closed trade as the scorecard sees it.
type ScorecardTrade struct {
	NetPnl      float64
	InitialRisk float64 // 0 when the trade has no recorded risk
	Mistake     bool    // carries at least one mistake tag
	OpenedAt    time.Time
}

// SetupScore is one setup's row on the scorecard. Stats are in R when enough of
// its trades have a recorded risk (Basis "r"), else in account currency.
type SetupScore struct {
	SetupID string `json:"setup_id"` // "" for trades with no setup
	Name    string `json:"name"`

	Trades       int     `json:"trades"`
	Wins         int     `json:"wins"`
	Losses       int     `json:"losses"`
	WinRate      float64 `json:"win_rate"`
	NetPnl       float64 `json:"net_pnl"`
	Expectancy   float64 `json:"expectancy"` // currency per trade
	ProfitFactor float64 `json:"profit_factor"`

	RTrades      int       `json:"r_trades"`
	RCoverage    float64   `json:"r_coverage"`
	ExpectancyR  *float64  `json:"expectancy_r"`
	AvgWinR      *float64  `json:"avg_win_r"`
	AvgLossR     *float64  `json:"avg_loss_r"`
	Distribution []RBucket `json:"distribution"`

	// Basis is "r" or "currency"; Mean / CILow / CIHigh / Clean* are in it.
	Basis       string   `json:"basis"`
	Mean        float64  `json:"mean"`
	CILow       *float64 `json:"ci_low"`
	CIHigh      *float64 `json:"ci_high"`
	CleanTrades int      `json:"clean_trades"`
	CleanMean   *float64 `json:"clean_mean"`

	Verdict     string    `json:"verdict"`
	Stale       bool      `json:"stale"`
	LastTradeAt time.Time `json:"last_trade_at"`
}

// SetupScorecard holds the scored setups plus the "no setup" bucket.
type SetupScorecard struct {
	Setups []SetupScore `json:"setups"`
	None   *SetupScore  `json:"none"`
}

// ScoreSetup scores one setup's trades as of now.
func ScoreSetup(id, name string, ts []ScorecardTrade, now time.Time) SetupScore {
	s := SetupScore{SetupID: id, Name: name, Trades: len(ts), Distribution: defaultRBuckets()}

	var gains, losses float64
	var rs, clean []float64
	var cleanCurrency, allCurrency []float64
	var winR, lossR []float64
	for _, t := range ts {
		s.NetPnl += t.NetPnl
		allCurrency = append(allCurrency, t.NetPnl)
		if !t.Mistake {
			cleanCurrency = append(cleanCurrency, t.NetPnl)
		}
		switch {
		case t.NetPnl > 0:
			s.Wins++
			gains += t.NetPnl
		case t.NetPnl < 0:
			s.Losses++
			losses -= t.NetPnl
		}
		if t.OpenedAt.After(s.LastTradeAt) {
			s.LastTradeAt = t.OpenedAt
		}
		if t.InitialRisk > 0 {
			r := t.NetPnl / t.InitialRisk
			rs = append(rs, r)
			if !t.Mistake {
				clean = append(clean, r)
			}
			if r > 0 {
				winR = append(winR, r)
			} else if r < 0 {
				lossR = append(lossR, r)
			}
			bucketR(s.Distribution, r)
		}
	}

	s.NetPnl = money.Round2(s.NetPnl)
	if decided := s.Wins + s.Losses; decided > 0 {
		s.WinRate = round4(float64(s.Wins) / float64(decided))
	}
	if s.Trades > 0 {
		s.Expectancy = money.Round2(s.NetPnl / float64(s.Trades))
	}
	if losses > 0 {
		s.ProfitFactor = money.Round2(gains / losses)
	}
	s.RTrades = len(rs)
	if s.Trades > 0 {
		s.RCoverage = round4(float64(s.RTrades) / float64(s.Trades))
	}
	if len(rs) > 0 {
		s.ExpectancyR = ptr(money.Round2(mean(rs)))
	}
	if len(winR) > 0 {
		s.AvgWinR = ptr(money.Round2(mean(winR)))
	}
	if len(lossR) > 0 {
		s.AvgLossR = ptr(money.Round2(mean(lossR)))
	}

	sample, cleanSample := allCurrency, cleanCurrency
	s.Basis = "currency"
	if s.Trades > 0 && s.RCoverage >= scoreMinRCoverage {
		sample, cleanSample = rs, clean
		s.Basis = "r"
	}
	n := len(sample)
	if n > 0 {
		m := mean(sample)
		s.Mean = money.Round2(m)
		if n >= 2 {
			half := scoreZ95 * stddev(sample, m) / math.Sqrt(float64(n))
			s.CILow = ptr(money.Round2(m - half))
			s.CIHigh = ptr(money.Round2(m + half))
		}
	}
	s.CleanTrades = len(cleanSample)
	if len(cleanSample) > 0 {
		s.CleanMean = ptr(money.Round2(mean(cleanSample)))
	}

	s.Verdict = verdict(n, s)
	s.Stale = s.Trades > 0 && now.Sub(s.LastTradeAt) > scoreStaleAfter
	return s
}

func verdict(n int, s SetupScore) string {
	if n < scoreMinTrades {
		return VerdictUnproven
	}
	if n >= scoreTrustTrades && s.CILow != nil && *s.CILow > 0 {
		return VerdictEdge
	}
	// The setup pays when it's followed, so the loss is in execution — more
	// actionable than "bleeding", so it is checked first.
	if s.Mean <= 0 && s.CleanTrades >= scoreMinCleanCount && s.CleanMean != nil && *s.CleanMean > 0 {
		return VerdictExecution
	}
	if n >= scoreTrustTrades && s.CIHigh != nil && *s.CIHigh < 0 {
		return VerdictBleeding
	}
	if s.Mean > 0 {
		return VerdictPromising
	}
	return VerdictWatch
}

// SortScorecard orders setups by verdict, then by mean in their basis.
func SortScorecard(rows []SetupScore) {
	sort.SliceStable(rows, func(i, j int) bool {
		a, b := verdictRank[rows[i].Verdict], verdictRank[rows[j].Verdict]
		if a != b {
			return a < b
		}
		if rows[i].Mean != rows[j].Mean {
			return rows[i].Mean > rows[j].Mean
		}
		return rows[i].Name < rows[j].Name
	})
}

func bucketR(buckets []RBucket, r float64) {
	for i := range buckets {
		b := &buckets[i]
		if i == len(buckets)-1 {
			if r >= b.From {
				b.Count++
			}
			return
		}
		if r >= b.From && r < b.To {
			b.Count++
			return
		}
	}
}

func round4(v float64) float64 { return math.Round(v*1e4) / 1e4 }

// stddev is the sample standard deviation (n-1).
func stddev(xs []float64, m float64) float64 {
	if len(xs) < 2 {
		return 0
	}
	var ss float64
	for _, x := range xs {
		ss += (x - m) * (x - m)
	}
	return math.Sqrt(ss / float64(len(xs)-1))
}

func ptr(v float64) *float64 { return &v }
