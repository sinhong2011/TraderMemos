package auth

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestJWTRoundTrip(t *testing.T) {
	m := NewJWT("secret")
	tok, err := m.Mint("user-123", time.Minute, TokenAccess, "")
	require.NoError(t, err)
	uid, err := m.Parse(tok, TokenAccess)
	require.NoError(t, err)
	require.Equal(t, "user-123", uid)
}

func TestJWTExpired(t *testing.T) {
	m := NewJWT("secret")
	tok, _ := m.Mint("u", -time.Minute, TokenAccess, "")
	_, err := m.Parse(tok, TokenAccess)
	require.Error(t, err)
}

func TestJWTRejectsWrongTyp(t *testing.T) {
	m := NewJWT("secret")
	tok, err := m.Mint("u", time.Minute, TokenRefresh, "")
	require.NoError(t, err)
	_, err = m.Parse(tok, TokenAccess)
	require.Error(t, err)
}
