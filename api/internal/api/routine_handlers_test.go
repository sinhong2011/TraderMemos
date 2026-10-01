package api_test

import (
	"encoding/json"
	"net/http"
	"sync"
	"testing"

	"github.com/stretchr/testify/require"
)

type routineItemJSON struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	Stage    string `json:"stage"`
	Weekdays []int  `json:"weekdays"`
	Done     bool   `json:"done"`
}

type routineDayJSON struct {
	Day   string            `json:"day"`
	Items []routineItemJSON `json:"items"`
	Total int               `json:"total"`
	Done  int               `json:"done"`
}

type routineHistoryJSON struct {
	Days []struct {
		Day   string `json:"day"`
		Total int    `json:"total"`
		Done  int    `json:"done"`
	} `json:"days"`
	CompletionRate *float64 `json:"completion_rate"`
	Streak         int      `json:"streak"`
	ByStage        map[string]struct {
		Total int `json:"total"`
		Done  int `json:"done"`
	} `json:"by_stage"`
}

func decode[T any](t *testing.T, body []byte) T {
	t.Helper()
	var out T
	require.NoError(t, json.Unmarshal(body, &out), string(body))
	return out
}

// 2026-09-28 is a Monday.

// The first routines read turns the checklist template into pre-session items
// and imports the ticks the checklist wrote into daily logs as history.
func TestRoutinesSeedFromChecklistAndBackfillDailyLogs(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "routine-seed@example.com")

	rec := do(s, http.MethodPut, "/api/v1/settings/checklist-template",
		`{"items":["Confirm market bias","Check news events"]}`, tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	rec = do(s, http.MethodPost, "/api/v1/notes",
		`{"type":"daily_log","occurred_at":"2026-09-29","body":"Checklist:\n- [x] confirm market bias\n- [ ] Check news events\n- [x] Not on the template"}`, tok)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	// A plain note's ticks are not checklist runs.
	rec = do(s, http.MethodPost, "/api/v1/notes",
		`{"type":"note","occurred_at":"2026-09-30","body":"- [x] Check news events"}`, tok)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())

	rec = do(s, http.MethodGet, "/api/v1/routines?day=2026-10-01", "", tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	list := decode[struct {
		Items []routineItemJSON `json:"items"`
	}](t, rec.Body.Bytes())
	require.Len(t, list.Items, 2)
	require.Equal(t, "Confirm market bias", list.Items[0].Title)
	require.Equal(t, "pre", list.Items[0].Stage)
	require.Equal(t, []int{1, 2, 3, 4, 5}, list.Items[0].Weekdays)

	// Seeding again (a second read) must not duplicate.
	rec = do(s, http.MethodGet, "/api/v1/routines?day=2026-10-01", "", tok)
	require.Len(t, decode[struct {
		Items []routineItemJSON `json:"items"`
	}](t, rec.Body.Bytes()).Items, 2)

	rec = do(s, http.MethodGet, "/api/v1/routines/day/2026-09-29", "", tok)
	day := decode[routineDayJSON](t, rec.Body.Bytes())
	require.Equal(t, 2, day.Total, "items start on the first imported day")
	require.Equal(t, 1, day.Done)
	require.True(t, day.Items[0].Done)

	rec = do(s, http.MethodGet, "/api/v1/routines/day/2026-09-30", "", tok)
	require.Equal(t, 0, decode[routineDayJSON](t, rec.Body.Bytes()).Done)
}

func TestRoutineLifecycle(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "routine-life@example.com")

	// No template: nothing seeded.
	rec := do(s, http.MethodGet, "/api/v1/routines?day=2026-09-28", "", tok)
	require.Equal(t, http.StatusOK, rec.Code)
	require.JSONEq(t, `{"items":[]}`, rec.Body.String())

	create := func(body string) routineItemJSON {
		rec := do(s, http.MethodPost, "/api/v1/routines", body, tok)
		require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
		return decode[routineItemJSON](t, rec.Body.Bytes())
	}
	review := create(`{"title":"Journal the day","stage":"post","weekdays":[1,2,3,4,5],"day":"2026-09-28"}`)
	bias := create(`{"title":"Bias","stage":"pre","weekdays":[0,1,2,3,4,5,6],"day":"2026-09-28"}`)

	for _, bad := range []string{
		`{"title":"","stage":"pre","weekdays":[1]}`,
		`{"title":"x","stage":"lunch","weekdays":[1]}`,
		`{"title":"x","stage":"pre","weekdays":[9]}`,
		`{"title":"x","stage":"pre","weekdays":[1],"day":"28/09/2026"}`,
	} {
		rec := do(s, http.MethodPost, "/api/v1/routines", bad, tok)
		require.Equal(t, http.StatusBadRequest, rec.Code, bad)
	}

	// Pre sorts before post regardless of creation order.
	rec = do(s, http.MethodGet, "/api/v1/routines/day/2026-09-28", "", tok)
	day := decode[routineDayJSON](t, rec.Body.Bytes())
	require.Equal(t, []string{"Bias", "Journal the day"}, []string{day.Items[0].Title, day.Items[1].Title})

	tick := func(day, id string, done bool) routineDayJSON {
		body := `{"done":false}`
		if done {
			body = `{"done":true}`
		}
		rec := do(s, http.MethodPut, "/api/v1/routines/day/"+day+"/items/"+id, body, tok)
		require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
		return decode[routineDayJSON](t, rec.Body.Bytes())
	}
	require.Equal(t, 1, tick("2026-09-28", bias.ID, true).Done)
	require.Equal(t, 1, tick("2026-09-28", bias.ID, true).Done, "ticking twice is idempotent")
	require.Equal(t, 2, tick("2026-09-28", review.ID, true).Done)
	require.Equal(t, 1, tick("2026-09-29", bias.ID, true).Done)
	require.Equal(t, 0, tick("2026-09-29", bias.ID, false).Done)
	require.Equal(t, 0, tick("2026-09-29", bias.ID, false).Done, "unticking twice is idempotent")

	// Saturday: the weekday-only review is off the list.
	rec = do(s, http.MethodGet, "/api/v1/routines/day/2026-10-03", "", tok)
	require.Equal(t, 1, decode[routineDayJSON](t, rec.Body.Bytes()).Total)

	// Archiving the review from 09-30 retires it from then on but keeps 09-28.
	rec = do(s, http.MethodDelete, "/api/v1/routines/"+review.ID+"?day=2026-09-30", "", tok)
	require.Equal(t, http.StatusNoContent, rec.Code)
	rec = do(s, http.MethodGet, "/api/v1/routines?day=2026-09-30", "", tok)
	require.Len(t, decode[struct {
		Items []routineItemJSON `json:"items"`
	}](t, rec.Body.Bytes()).Items, 1)
	rec = do(s, http.MethodGet, "/api/v1/routines/day/2026-09-28", "", tok)
	require.Equal(t, 2, decode[routineDayJSON](t, rec.Body.Bytes()).Done, "history keeps the archived item's tick")
	rec = do(s, http.MethodPatch, "/api/v1/routines/"+review.ID, `{"title":"x"}`, tok)
	require.Equal(t, http.StatusNotFound, rec.Code, "archived items are read-only")

	rec = do(s, http.MethodGet, "/api/v1/routines/history?from=2026-09-28&to=2026-09-30", "", tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	h := decode[routineHistoryJSON](t, rec.Body.Bytes())
	require.Len(t, h.Days, 3)
	require.Equal(t, 2, h.Days[0].Done)
	require.Equal(t, 2, h.Days[1].Total, "Tuesday: bias + review")
	require.Equal(t, 0, h.Days[1].Done)
	require.Equal(t, 1, h.Days[2].Total, "Wednesday: review archived")
	require.Equal(t, 0, h.Streak, "Tuesday unfinished; Wednesday (today) in progress")
	require.InDelta(t, 2.0/5.0, *h.CompletionRate, 1e-9)
	require.Equal(t, 2, h.ByStage["post"].Total)
	require.Equal(t, 1, h.ByStage["post"].Done)

	// A title edit is in place: same id.
	rec = do(s, http.MethodPatch, "/api/v1/routines/"+bias.ID, `{"title":"Market bias"}`, tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	require.Equal(t, bias.ID, decode[routineItemJSON](t, rec.Body.Bytes()).ID)

	// Narrowing bias to weekends from Saturday 10-03 must not reach back: it
	// ends on 10-03 and a successor carries the new schedule plus that day's tick.
	tick("2026-10-03", bias.ID, true)
	rec = do(s, http.MethodPatch, "/api/v1/routines/"+bias.ID, `{"weekdays":[0,6],"day":"2026-10-03"}`, tok)
	require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
	successor := decode[routineItemJSON](t, rec.Body.Bytes())
	require.NotEqual(t, bias.ID, successor.ID)
	require.Equal(t, "Market bias", successor.Title)
	rec = do(s, http.MethodGet, "/api/v1/routines/day/2026-10-03", "", tok)
	sat := decode[routineDayJSON](t, rec.Body.Bytes())
	require.Equal(t, 1, sat.Total)
	require.Equal(t, 1, sat.Done, "the day's tick moved to the successor")
	require.Equal(t, successor.ID, sat.Items[0].ID)
	rec = do(s, http.MethodGet, "/api/v1/routines/day/2026-09-29", "", tok)
	require.Equal(t, 2, decode[routineDayJSON](t, rec.Body.Bytes()).Total, "Tuesday still had bias")
	rec = do(s, http.MethodGet, "/api/v1/routines/day/2026-10-05", "", tok)
	require.Equal(t, 0, decode[routineDayJSON](t, rec.Body.Bytes()).Total, "off on the next Monday")

	rec = do(s, http.MethodGet, "/api/v1/routines/history?from=2025-01-01&to=2026-09-30", "", tok)
	require.Equal(t, http.StatusBadRequest, rec.Code, "range too long")
}

func TestRoutinesAreScopedToTheirOwner(t *testing.T) {
	s := testServer(t)
	a := registerAndLogin(t, s, "routine-a@example.com")
	b := registerAndLogin(t, s, "routine-b@example.com")
	rec := do(s, http.MethodPost, "/api/v1/routines", `{"title":"Mine","stage":"pre","weekdays":[1]}`, a)
	require.Equal(t, http.StatusCreated, rec.Code)
	id := decode[routineItemJSON](t, rec.Body.Bytes()).ID

	require.Equal(t, http.StatusNotFound, do(s, http.MethodPatch, "/api/v1/routines/"+id, `{"title":"x"}`, b).Code)
	require.Equal(t, http.StatusNotFound, do(s, http.MethodDelete, "/api/v1/routines/"+id, "", b).Code)
	require.Equal(t, http.StatusNotFound,
		do(s, http.MethodPut, "/api/v1/routines/day/2026-09-28/items/"+id, `{"done":true}`, b).Code)
}

// A page's first load asks for items, the day and history at once; every one
// of them must see the whole seed, not a list caught halfway through it.
func TestRoutineSeedIsWholeUnderConcurrentFirstReads(t *testing.T) {
	s := testServer(t)
	tok := registerAndLogin(t, s, "routine-race@example.com")
	rec := do(s, http.MethodPut, "/api/v1/settings/checklist-template",
		`{"items":["A","B","C","D","E","F"]}`, tok)
	require.Equal(t, http.StatusOK, rec.Code)
	rec = do(s, http.MethodPost, "/api/v1/notes",
		`{"type":"daily_log","occurred_at":"2026-09-29","body":"- [x] A\n- [x] F"}`, tok)
	require.Equal(t, http.StatusCreated, rec.Code)

	const n = 8
	days := make(chan routineDayJSON, n)
	var wg sync.WaitGroup
	for range n {
		wg.Add(1)
		go func() {
			defer wg.Done()
			rec := do(s, http.MethodGet, "/api/v1/routines/day/2026-09-29", "", tok)
			days <- decode[routineDayJSON](t, rec.Body.Bytes())
		}()
	}
	wg.Wait()
	close(days)
	for d := range days {
		require.Equal(t, 6, d.Total)
		require.Equal(t, 2, d.Done)
	}
}
