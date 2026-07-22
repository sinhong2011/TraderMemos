package api

import (
	"database/sql"
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"github.com/tradermemos/api/internal/store"
)

func TestToExecutionDTO_parsesOptionDetails(t *testing.T) {
	raw, err := json.Marshal(map[string]string{
		"option_right": "put",
		"strike":       "360",
		"expiry":       "2026-07-24",
	})
	require.NoError(t, err)

	dto := toExecutionDTO(store.Execution{
		ID:             "e1",
		UserID:         "u1",
		AccountID:      "a1",
		Symbol:         "TSLA",
		InstrumentType: "option",
		Side:           "buy",
		Quantity:       2,
		Price:          6.04,
		ExecutedAt:     time.Date(2026, 7, 20, 14, 5, 40, 0, time.UTC),
		Multiplier:     100,
		Details:        sql.NullString{String: string(raw), Valid: true},
		DedupHash:      "h",
		CreatedAt:      time.Now().UTC(),
	})

	require.Equal(t, "put", dto.Details["option_right"])
	require.Equal(t, "360", dto.Details["strike"])
	require.Equal(t, "2026-07-24", dto.Details["expiry"])
	require.Nil(t, dto.ExternalID)
	require.Nil(t, dto.ImportBatchID)
}

func TestToExecutionDTO_emptyDetails(t *testing.T) {
	dto := toExecutionDTO(store.Execution{
		ID: "e2", Symbol: "AAPL", InstrumentType: "stock", Side: "buy",
		Quantity: 1, Price: 1, Multiplier: 1, DedupHash: "h",
		ExecutedAt: time.Now().UTC(), CreatedAt: time.Now().UTC(),
	})
	require.NotNil(t, dto.Details)
	require.Empty(t, dto.Details)
}
