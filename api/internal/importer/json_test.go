package importer

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestParseJSONUnifiedExport(t *testing.T) {
	body := []byte(`{
		"format_version": 1,
		"exported_at": "2026-07-22T00:00:00Z",
		"account_id": "a1",
		"account_name": "Main",
		"account": {
			"id": "a1",
			"name": "Main",
			"broker": "FUTU",
			"account_type": "cash",
			"base_currency": "USD",
			"starting_balance": 10000
		},
		"cash_transactions": [
			{"type":"deposit","amount":500,"currency":"USD","occurred_at":"2026-01-02T00:00:00Z","note":"top up"},
			{"type":"withdrawal","amount":100,"currency":"USD","occurred_at":"2026-01-03T00:00:00Z","note":"out"}
		],
		"trade_count": 1,
		"trades": [{
			"symbol": "AAPL",
			"instrument_type": "stock",
			"direction": "long",
			"status": "closed",
			"opened_at": "2026-01-01T10:00:00Z",
			"closed_at": "2026-01-01T11:00:00Z",
			"qty_opened": 100,
			"avg_entry_price": 10,
			"avg_exit_price": 12,
			"net_pnl": 200
		}]
	}`)
	got, err := ParseJSONImport(body)
	require.NoError(t, err)
	require.Equal(t, "journal_trades", got.Format)
	require.Len(t, got.Result.Executions, 2)
	require.NotNil(t, got.Account)
	require.Equal(t, "FUTU", got.Account.Broker)
	require.Equal(t, "Main", got.Account.Name)
	require.NotNil(t, got.Account.StartingBalance)
	require.Equal(t, 10000.0, *got.Account.StartingBalance)
	require.Len(t, got.Cash, 2)
	require.Equal(t, "deposit", got.Cash[0].Type)
	require.Equal(t, 500.0, got.Cash[0].Amount)
}

func TestParseJSONSetupsCatalog(t *testing.T) {
	body := []byte(`{
		"setups": [{
			"name": "ORB",
			"description": "Opening range",
			"thesis": "Break and hold",
			"symbol": "QQQ",
			"direction": "long",
			"target_price": 400,
			"stop_price": 390,
			"checklist": ["OR set", "Volume"]
		}],
		"account": {"name": "Main", "broker": "IBKR"}
	}`)
	got, err := ParseJSONImport(body)
	require.NoError(t, err)
	require.Equal(t, "account_backup", got.Format)
	require.Len(t, got.Setups, 1)
	require.Equal(t, "ORB", got.Setups[0].Name)
	require.Equal(t, "Break and hold", got.Setups[0].Thesis)
	require.Equal(t, "long", got.Setups[0].Direction)
	require.NotNil(t, got.Setups[0].TargetPrice)
	require.Equal(t, 400.0, *got.Setups[0].TargetPrice)
	require.Equal(t, []string{"OR set", "Volume"}, got.Setups[0].Checklist)
}

func TestParseJSONExecutionsExport(t *testing.T) {
	body := []byte(`{
		"exported_at": "2026-07-22T00:00:00Z",
		"account_id": "a1",
		"execution_count": 2,
		"executions": [
			{"symbol":"AAPL","side":"buy","quantity":100,"price":10,"executed_at":"2026-01-01T10:00:00Z","instrument_type":"stock"},
			{"symbol":"AAPL","side":"sell","quantity":100,"price":12,"executed_at":"2026-01-01T11:00:00Z","instrument_type":"stock"}
		]
	}`)
	got, err := ParseJSONImport(body)
	require.NoError(t, err)
	require.Equal(t, "executions", got.Format)
	require.Len(t, got.Result.Executions, 2)
	require.Equal(t, "buy", got.Result.Executions[0].Side)
}

func TestParseJSONTradesExport(t *testing.T) {
	closed := "2026-01-01T11:00:00Z"
	body := []byte(`{
		"trades": [{
			"symbol": "AAPL",
			"instrument_type": "stock",
			"direction": "long",
			"status": "closed",
			"opened_at": "2026-01-01T10:00:00Z",
			"closed_at": "` + closed + `",
			"qty_opened": 100,
			"avg_entry_price": 10,
			"avg_exit_price": 12,
			"net_pnl": 200,
			"notes": "winner",
			"setup": {"name": "ORB"},
			"tags": [{"name":"FOMO","kind":"mistake"}]
		}]
	}`)
	got, err := ParseJSONImport(body)
	require.NoError(t, err)
	require.Equal(t, "journal_trades", got.Format)
	require.Len(t, got.Result.Executions, 2)
	require.NotNil(t, got.Result.Executions[0].Annotation)
	require.Equal(t, "ORB", got.Result.Executions[0].Annotation.SetupName)
	require.Equal(t, "winner", got.Result.Executions[0].Annotation.Notes)
}

func TestParseJSONJournalRowArray(t *testing.T) {
	body := []byte(`[
		{
			"Date": "2026-01-02T11:00:00.000Z",
			"Symbol": "AAPL",
			"Status": "WIN",
			"Market": "STOCK",
			"Side": "LONG",
			"Qty": 100,
			"Entry": 10,
			"Exit": 12,
			"Open Date": "2026-01-02T10:00:00.000Z"
		}
	]`)
	got, err := ParseJSONImport(body)
	require.NoError(t, err)
	require.Equal(t, "journal_trades", got.Format)
	require.Len(t, got.Result.Executions, 2)
}

func TestParseJSONExecutionsArray(t *testing.T) {
	body := []byte(`[
		{"symbol":"MSFT","side":"buy","quantity":10,"price":100,"executed_at":"` + time.Now().UTC().Format(time.RFC3339) + `"}
	]`)
	got, err := ParseJSONImport(body)
	require.NoError(t, err)
	require.Equal(t, "executions", got.Format)
	require.Len(t, got.Result.Executions, 1)
}

func TestParseJSONTradesWithFills(t *testing.T) {
	body := []byte(`{
		"trades": [{
			"symbol": "AAPL",
			"instrument_type": "stock",
			"direction": "long",
			"fills": [
				{"symbol":"AAPL","side":"buy","quantity":50,"price":10,"executed_at":"2026-01-01T10:00:00Z"},
				{"symbol":"AAPL","side":"sell","quantity":50,"price":12,"executed_at":"2026-01-01T11:00:00Z"}
			]
		}]
	}`)
	got, err := ParseJSONImport(body)
	require.NoError(t, err)
	require.Equal(t, "journal_trades", got.Format)
	require.Len(t, got.Result.Executions, 2)
	require.Equal(t, 50.0, got.Result.Executions[0].Quantity)
}

func TestParseJSONOptionFillsCarryCallPutIntoJournalPreview(t *testing.T) {
	body := []byte(`{
		"trades": [{
			"symbol": "NVDA",
			"instrument_type": "option",
			"direction": "long",
			"status": "closed",
			"opened_at": "2026-01-01T10:00:00Z",
			"closed_at": "2026-01-01T11:00:00Z",
			"qty_opened": 3,
			"avg_entry_price": 2.3,
			"avg_exit_price": 2.43,
			"net_pnl": 36.84,
			"fills": [
				{"symbol":"NVDA","side":"buy","quantity":3,"price":2.3,"executed_at":"2026-01-01T10:00:00Z","instrument_type":"option","multiplier":100,"details":{"option_right":"call"}},
				{"symbol":"NVDA","side":"sell","quantity":3,"price":2.43,"executed_at":"2026-01-01T11:00:00Z","instrument_type":"option","multiplier":100,"details":{"option_right":"call"}}
			]
		}]
	}`)
	got, err := ParseJSONImport(body)
	require.NoError(t, err)
	require.Equal(t, "call", got.Result.Executions[0].OptionRight)
	require.Equal(t, "Call", got.Rows[0]["Call/Put"])

	_, samples := BuildJournalPreview(got.Rows)
	require.Len(t, samples, 1)
	require.Equal(t, "call", samples[0].OptionRight)
}

func TestParseJSONInvalid(t *testing.T) {
	_, err := ParseJSONImport([]byte(`{"foo":1}`))
	require.Error(t, err)
}
