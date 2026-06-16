package auth

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestJWTRoundTrip(t *testing.T) {
	m := NewJWT("secret")
	tok, err := m.Mint("user-123", time.Minute)
	require.NoError(t, err)
	uid, err := m.Parse(tok)
	require.NoError(t, err)
	require.Equal(t, "user-123", uid)
}

func TestJWTExpired(t *testing.T) {
	m := NewJWT("secret")
	tok, _ := m.Mint("u", -time.Minute)
	_, err := m.Parse(tok)
	require.Error(t, err)
}
