package exporter

import (
	"encoding/csv"
	"fmt"
	"io"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/tradermemos/api/internal/store"
)

// Journal columns match the Stonk Journal / closed-trade import format.
var journalHeaders = []string{
	"Date", "Symbol", "Status", "Market", "Side", "Call/Put", "Qty", "Entry", "Exit",
	"Entry Total", "Exit Total", "Position",
	"Return ($)", "Return (%)", "Dividends", "Open Date",
	"Tags", "Setup", "Confidence", "Target", "Stop", "Notes",
}

// JournalRow is one closed-trade export row (journal CSV round-trip).
type JournalRow struct {
	CloseDate   time.Time
	Symbol      string
	Status      string
	Market      string
	Side        string
	CallPut     string // Call|Put when Market is OPTION
	Qty         float64
	Entry       float64
	Exit        float64
	EntryTotal  float64
	ExitTotal   float64
	ReturnUSD   float64
	ReturnPct   float64
	Dividends   float64
	OpenDate    time.Time
	Tags        string
	Setup       string
	Confidence  string
	Target      string
	Stop        string
	Notes       string
}

// JournalInput bundles store rows needed to build journal exports.
type JournalInput struct {
	Trade       store.Trade
	Journal     store.TradeJournal
	Tags        []store.Tag
	Setup       string
	Dividends   float64
	OptionRight string // call|put from fill details
}

// BuildJournalRow converts a closed trade into a journal export row.
func BuildJournalRow(in JournalInput) (JournalRow, bool) {
	t := in.Trade
	if !t.ClosedAt.Valid || t.Status != "closed" {
		return JournalRow{}, false
	}
	mult := defaultMultiplier(t.InstrumentType)
	entryTotal := t.QtyOpened * t.AvgEntryPrice * mult
	exitTotal := 0.0
	exit := 0.0
	if t.AvgExitPrice.Valid {
		exit = t.AvgExitPrice.Float64
		exitTotal = t.QtyOpened * exit * mult
	}
	retUSD := 0.0
	if t.NetPnl.Valid {
		retUSD = t.NetPnl.Float64
	}
	retPct := 0.0
	if t.ReturnPct.Valid {
		retPct = t.ReturnPct.Float64
	}
	status := "BE"
	if retUSD > 0 {
		status = "WIN"
	} else if retUSD < 0 {
		status = "LOSS"
	}
	market := "STOCK"
	callPut := ""
	if t.InstrumentType == "option" {
		market = "OPTION"
		switch strings.ToLower(strings.TrimSpace(in.OptionRight)) {
		case "call":
			callPut = "Call"
		case "put":
			callPut = "Put"
		}
	}
	side := "LONG"
	if t.Direction == "short" {
		side = "SHORT"
	}
	j := in.Journal
	notes := j.Notes
	if notes == "" {
		notes = t.Notes
	}
	confidence := ""
	if j.Confidence.Valid {
		confidence = strconv.FormatInt(j.Confidence.Int64, 10)
	}
	target := ""
	if j.TargetPrice.Valid {
		target = formatNum(j.TargetPrice.Float64)
	}
	stop := ""
	if j.StopPrice.Valid {
		stop = formatNum(j.StopPrice.Float64)
	}
	return JournalRow{
		CloseDate:  t.ClosedAt.Time,
		Symbol:     t.Symbol,
		Status:     status,
		Market:     market,
		Side:       side,
		CallPut:    callPut,
		Qty:        t.QtyOpened,
		Entry:      t.AvgEntryPrice,
		Exit:       exit,
		EntryTotal: round2(entryTotal),
		ExitTotal:  round2(exitTotal),
		ReturnUSD:  round2(retUSD),
		ReturnPct:  round2(retPct),
		Dividends:  round2(in.Dividends),
		OpenDate:   t.OpenedAt,
		Tags:       formatJournalTags(in.Tags, j.EmotionalState),
		Setup:      in.Setup,
		Confidence: confidence,
		Target:     target,
		Stop:       stop,
		Notes:      notes,
	}, true
}

func formatJournalTags(tags []store.Tag, emotion string) string {
	parts := make([]string, 0, len(tags)+1)
	for _, tg := range tags {
		if strings.EqualFold(tg.Kind, "setup") {
			continue
		}
		name := strings.TrimSpace(tg.Name)
		if name == "" {
			continue
		}
		kind := strings.TrimSpace(tg.Kind)
		if kind == "" || strings.EqualFold(kind, "custom") {
			parts = append(parts, name)
		} else {
			parts = append(parts, kind+":"+name)
		}
	}
	if emotion = strings.TrimSpace(emotion); emotion != "" {
		parts = append(parts, "emotion:"+emotion)
	}
	return strings.Join(parts, "; ")
}

func formatNum(v float64) string {
	if math.Mod(v, 1) == 0 {
		return strconv.FormatFloat(v, 'f', 0, 64)
	}
	return strconv.FormatFloat(v, 'f', -1, 64)
}

func formatTime(t time.Time) string {
	return t.UTC().Format("2006-01-02T15:04:05.000Z")
}

func journalRowValues(row JournalRow) []string {
	return []string{
		formatTime(row.CloseDate),
		row.Symbol,
		row.Status,
		row.Market,
		row.Side,
		row.CallPut,
		formatNum(row.Qty),
		formatNum(row.Entry),
		formatNum(row.Exit),
		formatNum(row.EntryTotal),
		formatNum(row.ExitTotal),
		"0",
		formatNum(row.ReturnUSD),
		formatNum(row.ReturnPct),
		formatNum(row.Dividends),
		formatTime(row.OpenDate),
		row.Tags,
		row.Setup,
		row.Confidence,
		row.Target,
		row.Stop,
		row.Notes,
	}
}

// WriteJournalCSV writes journal export rows as CSV.
func WriteJournalCSV(w io.Writer, rows []JournalRow) error {
	cw := csv.NewWriter(w)
	if err := cw.Write(journalHeaders); err != nil {
		return err
	}
	for _, row := range rows {
		if err := cw.Write(journalRowValues(row)); err != nil {
			return err
		}
	}
	cw.Flush()
	return cw.Error()
}

func defaultMultiplier(instrument string) float64 {
	if instrument == "option" {
		return 100
	}
	return 1
}

func round2(v float64) float64 {
	return math.Round(v*100) / 100
}

// ExportFilename builds a download filename for trade exports.
func ExportFilename(prefix, accountName, ext string) string {
	day := time.Now().UTC().Format("2006-01-02")
	token := filenameToken(accountName)
	if token == "" {
		token = "account"
	}
	return fmt.Sprintf("%s-%s-%s.%s", prefix, token, day, ext)
}

func filenameToken(raw string) string {
	raw = strings.TrimSpace(strings.ToLower(raw))
	if raw == "" {
		return ""
	}
	var b strings.Builder
	lastDash := false
	for _, r := range raw {
		isAlphaNum := (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9')
		if isAlphaNum {
			b.WriteRune(r)
			lastDash = false
			continue
		}
		if !lastDash {
			b.WriteByte('-')
			lastDash = true
		}
	}
	out := strings.Trim(b.String(), "-")
	if len(out) > 40 {
		out = out[:40]
		out = strings.TrimRight(out, "-")
	}
	return out
}
