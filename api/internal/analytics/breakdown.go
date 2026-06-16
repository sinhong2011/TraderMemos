package analytics

import "sort"

type BreakGroup struct {
	Key     string  `json:"key"`
	Summary Summary `json:"summary"`
}

// Breakdown summarizes each group of closed trades and returns the groups
// sorted by net P&L descending (ties broken by key for stable output).
func Breakdown(groups map[string][]ClosedTrade) []BreakGroup {
	out := make([]BreakGroup, 0, len(groups))
	for k, ts := range groups {
		out = append(out, BreakGroup{Key: k, Summary: Summarize(ts)})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Summary.NetPnl != out[j].Summary.NetPnl {
			return out[i].Summary.NetPnl > out[j].Summary.NetPnl
		}
		return out[i].Key < out[j].Key
	})
	return out
}
