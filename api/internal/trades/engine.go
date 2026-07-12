package trades

import (
	"sort"
	"time"

	"github.com/tradermemos/api/internal/money"
)

type Execution struct {
	ID             string
	Symbol         string
	InstrumentType string
	Side           string // buy|sell
	Quantity       float64
	Price          float64
	Fees           float64
	Commission     float64
	ExecutedAt     time.Time
	Multiplier     float64 // 1 stock, 100 option, tick-derived for futures
	LotKey         string  // optional; isolates overlapping same-symbol round-trips
}

type Trade struct {
	Symbol          string
	InstrumentType  string
	Direction       string // long|short
	Status          string // open|closed
	OpenedAt        time.Time
	ClosedAt        *time.Time
	QtyOpened       float64
	QtyRemaining    float64 // open position size; 0 when closed
	AvgEntryPrice   float64
	AvgExitPrice    *float64
	GrossPnl        *float64
	FeesTotal       float64
	NetPnl          *float64
	ReturnPct       *float64
	TimeInTradeSecs *int64
	ExecutionIDs    []string
}

// Group folds executions for a SINGLE (account,symbol,instrument) stream into round-trip trades
// using average-cost. Callers must pre-partition by symbol+instrument+account.
func Group(fills []Execution) []Trade {
	sort.SliceStable(fills, func(i, j int) bool {
		if fills[i].ExecutedAt.Equal(fills[j].ExecutedAt) {
			return fills[i].ID < fills[j].ID
		}
		return fills[i].ExecutedAt.Before(fills[j].ExecutedAt)
	})

	var trades []Trade
	var cur *openState

	for _, f := range fills {
		signed := f.Quantity
		if f.Side == "sell" {
			signed = -f.Quantity
		}
		mult := f.Multiplier
		if mult == 0 {
			mult = 1
		}

		if cur == nil {
			cur = newOpen(f, signed, mult, true)
			continue
		}

		// same direction → scale in
		if (cur.position > 0) == (signed > 0) {
			cur.scaleIn(f, signed)
			continue
		}

		// opposite direction → reduce/close, possibly cross zero
		closeQty := min(abs(signed), abs(cur.position))
		cur.reduce(f, closeQty, mult)

		remaining := abs(signed) - closeQty
		if abs(cur.position) < 1e-9 {
			trades = append(trades, cur.finalize(f.ExecutedAt))
			cur = nil
			if remaining > 1e-9 {
				// The crossing fill closed the prior trade AND opens an opposite
				// trade with the remainder. Its fees were already attributed to the
				// closed trade in reduce(), so do not count them again here.
				crossSigned := remaining
				if signed < 0 {
					crossSigned = -remaining
				}
				cur = newOpen(f, crossSigned, mult, false)
			}
		}
	}

	if cur != nil {
		trades = append(trades, cur.finalizeOpen())
	}
	return trades
}

type openState struct {
	symbol, instrument string
	direction          string
	position           float64 // signed remaining qty
	qtyOpened          float64 // total opened (absolute) for return calc
	entryNotional      float64 // sum(price*qty) on the opening side
	entryQty           float64
	exitNotional       float64
	exitQty            float64
	feesTotal          float64
	openedAt           time.Time
	execIDs            []string
	lastMult           float64 // multiplier of the most recent fill; used for P&L
}

// newOpen starts a new trade from a fill. countFees is false when the fill is a
// zero-cross remainder whose fees were already booked against the closed trade.
func newOpen(f Execution, signed, mult float64, countFees bool) *openState {
	q := abs(signed)
	s := &openState{
		symbol:        f.Symbol,
		instrument:    f.InstrumentType,
		openedAt:      f.ExecutedAt,
		position:      signed,
		qtyOpened:     q,
		entryNotional: f.Price * q,
		entryQty:      q,
		lastMult:      mult,
	}
	if signed > 0 {
		s.direction = "long"
	} else {
		s.direction = "short"
	}
	if countFees {
		s.feesTotal += f.Fees + f.Commission
	}
	s.execIDs = append(s.execIDs, f.ID)
	return s
}

func (s *openState) scaleIn(f Execution, signed float64) {
	q := abs(signed)
	s.position += signed
	s.qtyOpened += q
	s.entryNotional += f.Price * q
	s.entryQty += q
	s.feesTotal += f.Fees + f.Commission
	s.execIDs = append(s.execIDs, f.ID)
}

func (s *openState) reduce(f Execution, closeQty, mult float64) {
	s.exitNotional += f.Price * closeQty
	s.exitQty += closeQty
	s.feesTotal += f.Fees + f.Commission
	s.execIDs = append(s.execIDs, f.ID)
	if s.position > 0 {
		s.position -= closeQty
	} else {
		s.position += closeQty
	}
	s.lastMult = mult
}

func (s *openState) finalize(closedAt time.Time) Trade {
	avgEntry := s.entryNotional / s.entryQty
	avgExit := s.exitNotional / s.exitQty
	mult := s.lastMult
	if mult == 0 {
		mult = 1
	}
	dirSign := 1.0
	if s.direction == "short" {
		dirSign = -1.0
	}
	gross := money.Round2((avgExit - avgEntry) * s.exitQty * dirSign * mult)
	net := money.Round2(gross - s.feesTotal)
	ret := 0.0
	if base := avgEntry * s.exitQty * mult; base != 0 {
		ret = money.Round2(net / base * 100)
	}
	secs := int64(closedAt.Sub(s.openedAt).Seconds())
	return Trade{
		Symbol: s.symbol, InstrumentType: s.instrument, Direction: s.direction,
		Status: "closed", OpenedAt: s.openedAt, ClosedAt: &closedAt,
		QtyOpened: s.qtyOpened, QtyRemaining: 0, AvgEntryPrice: money.Round2(avgEntry),
		AvgExitPrice: f64(money.Round2(avgExit)), GrossPnl: f64(gross),
		FeesTotal: money.Round2(s.feesTotal), NetPnl: f64(net), ReturnPct: f64(ret),
		TimeInTradeSecs: &secs, ExecutionIDs: s.execIDs,
	}
}

func (s *openState) finalizeOpen() Trade {
	avgEntry := s.entryNotional / s.entryQty
	return Trade{
		Symbol: s.symbol, InstrumentType: s.instrument, Direction: s.direction,
		Status: "open", OpenedAt: s.openedAt, QtyOpened: s.qtyOpened,
		QtyRemaining: money.Round2(abs(s.position)),
		AvgEntryPrice: money.Round2(avgEntry), FeesTotal: money.Round2(s.feesTotal),
		ExecutionIDs: s.execIDs,
	}
}

func f64(v float64) *float64 { return &v }

func abs(v float64) float64 {
	if v < 0 {
		return -v
	}
	return v
}

func min(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}
