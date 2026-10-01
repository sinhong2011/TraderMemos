package importer

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSuggestMapping(t *testing.T) {
	headers := []string{"Symbol", "B/S", "Qty", "Fill Price", "Trade Date", "Commission"}
	m := SuggestMapping(headers)
	require.Equal(t, "Symbol", m["symbol"])
	require.Equal(t, "B/S", m["side"])
	require.Equal(t, "Qty", m["quantity"])
	require.Equal(t, "Fill Price", m["price"])
	require.Equal(t, "Trade Date", m["executed_at"])
	require.Equal(t, "Commission", m["commission"])
}

func TestMergeSuggestedWithPresetDropsClaimedColumns(t *testing.T) {
	headers := []string{"Date", "Action", "Symbol", "Description", "Quantity", "Price", "Fees & Comm", "Amount"}
	suggested := SuggestMapping(headers)
	require.Equal(t, "Fees & Comm", suggested["fees"])
	require.Equal(t, "Fees & Comm", suggested["commission"])

	_, preset, _, ok := MatchBroker(headers)
	require.True(t, ok)

	merged := MergeSuggestedWithPreset(suggested, preset)
	require.Equal(t, "Fees & Comm", merged["fees"])
	require.NotEqual(t, "Fees & Comm", merged["commission"])
	require.Equal(t, "Action", merged["side"])
	require.Equal(t, "Price", merged["price"])
}
