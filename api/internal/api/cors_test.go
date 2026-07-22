package api

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestOriginAllowed(t *testing.T) {
	allow := []string{
		"https://app.example.com",
		"https://*.vercel.app",
		"http://localhost:5173",
	}
	require.True(t, OriginAllowed("https://app.example.com", allow))
	require.True(t, OriginAllowed("https://tradermemos-abc.vercel.app", allow))
	require.True(t, OriginAllowed("http://localhost:5173", allow))
	require.False(t, OriginAllowed("https://vercel.app", allow))
	require.False(t, OriginAllowed("https://evil.com", allow))
	require.False(t, OriginAllowed("http://tradermemos-abc.vercel.app", allow))
	require.True(t, OriginAllowed("https://anything.test", []string{"*"}))
	require.True(t, OriginAllowed("https://tradermemos.username.workers.dev", []string{"https://*.workers.dev"}))
	require.True(t, OriginAllowed("https://tradermemos.pages.dev", []string{"https://*.pages.dev"}))
	require.False(t, OriginAllowed("", allow))
	require.False(t, OriginAllowed("https://app.example.com", nil))
}
