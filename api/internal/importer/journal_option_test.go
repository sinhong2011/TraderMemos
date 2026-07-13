package importer

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestParseOptionRightTokens(t *testing.T) {
	require.Equal(t, "call", parseOptionRightToken("LC"))
	require.Equal(t, "put", parseOptionRightToken("LP"))
	require.Equal(t, "call", parseOptionRightToken("LONG CALL"))
	require.Equal(t, "put", InferOptionRightFromText("setup:Pullback", "bought puts on weakness"))
}

func TestInferOptionRightFromTarget(t *testing.T) {
	target := 3.0
	require.Equal(t, "call", inferOptionRightFromTarget("LONG", 1.99, &target))
	target = 1.5
	require.Equal(t, "put", inferOptionRightFromTarget("LONG", 2.0, &target))
	require.Equal(t, "", inferOptionRightFromTarget("LONG", 2.0, nil))
}

func TestJournalParseOptionOverride(t *testing.T) {
	row := map[string]string{
		"Symbol": "NVDA", "Market": "OPTION", "Side": "LONG",
		"Qty": "3", "Entry": "2.30", "Exit": "2.43",
		"Open Date": "2026-07-10T15:19:46.000Z", "Date": "2026-07-10T15:31:16.000Z",
		"Return ($)": "36.84",
	}
	res := NewJournal().ParseRowsWithOptions([]map[string]string{row}, &JournalParseOptions{
		OptionRightByRow: map[int]string{1: "put"},
	})
	require.Len(t, res.Executions, 2)
	require.Equal(t, "put", res.Executions[0].OptionRight)
	require.Equal(t, "put", res.Executions[1].OptionRight)
}

func TestBuildJournalPreviewInfersCallFromTarget(t *testing.T) {
	_, samples := BuildJournalPreview([]map[string]string{{
		"Symbol": "QQQ", "Market": "OPTION", "Side": "LONG",
		"Qty": "3", "Entry": "1.99", "Exit": "2.41", "Target": "3",
		"Open Date": "2026-07-09T14:09:58.000Z", "Date": "2026-07-09T14:13:57.000Z",
		"Return ($)": "123.68",
	}})
	require.Len(t, samples, 1)
	require.Equal(t, "call", samples[0].OptionRight)
}
