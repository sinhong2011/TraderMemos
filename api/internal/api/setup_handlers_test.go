package api_test

import (
	"encoding/json"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSetupCRUDAndIsolation(t *testing.T) {
	s := testServer(t)
	tokA := registerAndLogin(t, s, "a@s.com")
	tokB := registerAndLogin(t, s, "b@s.com")

	rec := do(s, http.MethodPost, "/api/v1/setups", `{"name":"Breakout","description":"ORB"}`, tokA)
	require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())

	rec = do(s, http.MethodGet, "/api/v1/setups", "", tokB)
	var setups []map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &setups))
	require.Len(t, setups, 0)

	rec = do(s, http.MethodGet, "/api/v1/setups", "", tokA)
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &setups))
	require.Len(t, setups, 1)
}
