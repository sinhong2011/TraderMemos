package api

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"path"
	"strings"
	"time"

	"github.com/labstack/echo/v5"
	"github.com/tradermemos/api/internal/auth"
	"github.com/tradermemos/api/internal/exporter"
	"github.com/tradermemos/api/internal/store"
)

const exportFormatVersion = 1

func (s *Server) exportRoutes(g *echo.Group) {
	g.GET("/exports", s.handleExport)
	// Legacy aliases — same unified account export.
	g.GET("/exports/trades", s.handleExport)
}

type exportAccountMeta struct {
	ID              string  `json:"id"`
	Name            string  `json:"name"`
	Broker          string  `json:"broker"`
	AccountType     string  `json:"account_type"`
	BaseCurrency    string  `json:"base_currency"`
	StartingBalance float64 `json:"starting_balance"`
}

type exportCashTx struct {
	Type       string    `json:"type"`
	Amount     float64   `json:"amount"`
	Currency   string    `json:"currency"`
	OccurredAt time.Time `json:"occurred_at"`
	Note       string    `json:"note"`
}

// accountExportJSON is the canonical TraderMemos backup format (JSON).
type accountExportJSON struct {
	FormatVersion    int                `json:"format_version"`
	ExportedAt       time.Time          `json:"exported_at"`
	AccountID        string             `json:"account_id,omitempty"`
	AccountName      string             `json:"account_name,omitempty"`
	Account          *exportAccountMeta `json:"account,omitempty"`
	CashTransactions []exportCashTx     `json:"cash_transactions"`
	Setups           []setupDTO         `json:"setups"`
	TradeCount       int                `json:"trade_count"`
	Trades           []tradeDetailDTO   `json:"trades"`
}

func queryTruthy(v string) bool {
	switch strings.ToLower(strings.TrimSpace(v)) {
	case "1", "true", "yes", "on":
		return true
	default:
		return false
	}
}

// stripAccountFromTradeExport clears account identifiers so the payload is
// portable trade data without binding to a specific account.
func stripAccountFromTradeExport(details []tradeDetailDTO) {
	for i := range details {
		details[i].AccountID = ""
		for j := range details[i].Fills {
			details[i].Fills[j].AccountID = ""
		}
	}
}

func (s *Server) handleExport(c *echo.Context) error {
	uid := auth.UserID(c)
	ctx := c.Request().Context()

	format := strings.ToLower(strings.TrimSpace(c.QueryParam("format")))
	if format == "" {
		format = "json"
	}
	if format != "csv" && format != "json" && format != "zip" {
		return Fail(http.StatusBadRequest, "bad_request", "format must be csv, json, or zip", nil)
	}

	accountID := c.QueryParam("account_id")
	if accountID == "" {
		return Fail(http.StatusBadRequest, "bad_request", "account_id is required", nil)
	}
	acc, err := s.deps.Store.GetAccount(ctx, store.GetAccountParams{ID: accountID, UserID: uid})
	if err != nil {
		return Fail(http.StatusNotFound, "not_found", "account not found", nil)
	}

	omitAccount := queryTruthy(c.QueryParam("omit_account"))
	if omitAccount && format == "csv" {
		return Fail(http.StatusBadRequest, "bad_request", "omit_account is only supported for json and zip", nil)
	}

	f, err := parseFilters(c)
	if err != nil {
		return Fail(http.StatusBadRequest, "bad_request", err.Error(), nil)
	}
	f.AccountIDs = []string{accountID}
	// Exports double as backups: keep backtest accounts in the dataset.
	f.IncludeBacktest = true

	trades, err := s.loadTrades(ctx, uid, f)
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load trades", nil)
	}
	details := make([]tradeDetailDTO, 0, len(trades))
	for _, t := range trades {
		detail, err := s.buildTradeDetail(ctx, uid, t)
		if err != nil {
			return Fail(http.StatusInternalServerError, "internal", "could not build trade export", nil)
		}
		details = append(details, detail)
	}

	cashRows, err := s.deps.Store.ListCashTransactions(ctx, store.ListCashTransactionsParams{
		UserID: uid, AccountID: accountArg(accountID),
	})
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not load cash transactions", nil)
	}
	cashOut := make([]exportCashTx, 0, len(cashRows))
	for _, row := range cashRows {
		// Trade-linked dividends travel with journal rows; keep standalone cash in the backup.
		if row.TradeID.Valid {
			continue
		}
		cashOut = append(cashOut, exportCashTx{
			Type: row.Type, Amount: row.Amount, Currency: row.Currency,
			OccurredAt: row.OccurredAt, Note: row.Note,
		})
	}

	switch format {
	case "json", "zip":
		setupRows, err := s.deps.Store.ListSetups(ctx, uid)
		if err != nil {
			return Fail(http.StatusInternalServerError, "internal", "could not load setups", nil)
		}
		setupOut := make([]setupDTO, 0, len(setupRows))
		for _, st := range setupRows {
			setupOut = append(setupOut, toSetupDTO(st))
		}
		if omitAccount {
			stripAccountFromTradeExport(details)
		}
		payload := accountExportJSON{
			FormatVersion:    exportFormatVersion,
			ExportedAt:       time.Now().UTC(),
			CashTransactions: cashOut,
			Setups:           setupOut,
			TradeCount:       len(details),
			Trades:           details,
		}
		if !omitAccount {
			payload.AccountID = accountID
			payload.AccountName = acc.Name
			payload.Account = &exportAccountMeta{
				ID: acc.ID, Name: acc.Name, Broker: acc.Broker,
				AccountType: acc.AccountType, BaseCurrency: acc.BaseCurrency,
				StartingBalance: acc.StartingBalance,
			}
		}
		if format == "json" {
			filename := exporter.ExportFilename("tradermemos-export", acc.Name, "json")
			c.Response().Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
			return c.JSON(http.StatusOK, payload)
		}
		return s.writeExportZip(c, uid, accountID, acc.Name, payload)
	default:
		rows, err := s.buildJournalExportRows(ctx, uid, f)
		if err != nil {
			return Fail(http.StatusInternalServerError, "internal", "could not build export", nil)
		}
		var buf bytes.Buffer
		if err := exporter.WriteJournalCSV(&buf, rows); err != nil {
			return Fail(http.StatusInternalServerError, "internal", "could not write csv", nil)
		}
		filename := exporter.ExportFilename("tradermemos-export", acc.Name, "csv")
		c.Response().Header().Set("Content-Type", "text/csv; charset=utf-8")
		c.Response().Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
		return c.Blob(http.StatusOK, "text/csv; charset=utf-8", buf.Bytes())
	}
}

func (s *Server) writeExportZip(c *echo.Context, userID, accountID, accountName string, payload accountExportJSON) error {
	ctx := c.Request().Context()
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)

	jsonBytes, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not encode export json", nil)
	}
	w, err := zw.Create("export.json")
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not create zip entry", nil)
	}
	if _, err := w.Write(jsonBytes); err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not write export json", nil)
	}

	atts, err := s.deps.Store.ListAttachmentsForAccount(ctx, store.ListAttachmentsForAccountParams{
		UserID: userID, AccountID: accountID,
	})
	if err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not list attachments", nil)
	}
	for _, att := range atts {
		r, err := s.deps.Storage.Get(att.StorageKey)
		if err != nil {
			continue
		}
		ext := extensionForContentType(att.ContentType)
		name := path.Join("attachments", att.TradeID, att.ID+ext)
		entry, err := zw.Create(name)
		if err != nil {
			_ = r.Close()
			continue
		}
		_, _ = io.Copy(entry, r)
		_ = r.Close()
	}

	if err := zw.Close(); err != nil {
		return Fail(http.StatusInternalServerError, "internal", "could not finalize zip", nil)
	}
	filename := exporter.ExportFilename("tradermemos-export", accountName, "zip")
	c.Response().Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	return c.Blob(http.StatusOK, "application/zip", buf.Bytes())
}

func extensionForContentType(ct string) string {
	switch strings.ToLower(ct) {
	case "image/png":
		return ".png"
	case "image/webp":
		return ".webp"
	case "image/jpeg", "image/jpg":
		return ".jpg"
	default:
		return ""
	}
}

func (s *Server) buildJournalExportRows(ctx context.Context, userID string, f Filters) ([]exporter.JournalRow, error) {
	trades, err := s.loadClosedTrades(ctx, userID, f)
	if err != nil {
		return nil, err
	}

	journals, err := s.deps.Store.ListTradeJournalsForUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	journalByTrade := make(map[string]store.TradeJournal, len(journals))
	for _, j := range journals {
		journalByTrade[j.TradeID] = j
	}

	tagRows, err := s.deps.Store.ListTradeTagsForUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	tagsByTrade := make(map[string][]store.Tag)
	for _, r := range tagRows {
		tagsByTrade[r.TradeID] = append(tagsByTrade[r.TradeID], store.Tag{
			ID: r.ID, UserID: r.UserID, Name: r.Name, Color: r.Color,
			Description: r.Description, Kind: r.Kind,
		})
	}

	setups, err := s.deps.Store.ListSetups(ctx, userID)
	if err != nil {
		return nil, err
	}
	setupName := make(map[string]string, len(setups))
	for _, st := range setups {
		setupName[st.ID] = st.Name
	}

	cashRows, err := s.deps.Store.ListCashTransactions(ctx, store.ListCashTransactionsParams{
		UserID: userID, AccountID: f.accountNarg(),
	})
	if err != nil {
		return nil, err
	}
	dividendsByTrade := map[string]float64{}
	for _, c := range cashRows {
		if c.Type != "dividend" || !c.TradeID.Valid {
			continue
		}
		dividendsByTrade[c.TradeID.String] += c.Amount
	}

	out := make([]exporter.JournalRow, 0, len(trades))
	for _, t := range trades {
		j := journalByTrade[t.ID]
		setup := ""
		if j.SetupID.Valid {
			setup = setupName[j.SetupID.String]
		}
		optionRight := ""
		if t.InstrumentType == "option" {
			fills, ferr := s.deps.Store.ListExecutionsForTrade(ctx, t.ID)
			if ferr == nil {
				optionRight = optionRightFromFills(fills)
			}
		}
		row, ok := exporter.BuildJournalRow(exporter.JournalInput{
			Trade:       t,
			Journal:     j,
			Tags:        tagsByTrade[t.ID],
			Setup:       setup,
			Dividends:   dividendsByTrade[t.ID],
			OptionRight: optionRight,
		})
		if ok {
			out = append(out, row)
		}
	}
	return out, nil
}

