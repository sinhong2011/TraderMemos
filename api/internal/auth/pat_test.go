package auth

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestGeneratePATHasPrefix(t *testing.T) {
	tok, err := GeneratePAT()
	require.NoError(t, err)
	require.True(t, IsPAT(tok))
	require.True(t, strings.HasPrefix(tok, PATPrefix))
	require.Greater(t, len(tok), PATPrefixLen)
}

func TestHashPATStable(t *testing.T) {
	a := HashPAT("tm_pat_test")
	b := HashPAT("tm_pat_test")
	require.Equal(t, a, b)
	require.NotEqual(t, a, HashPAT("tm_pat_other"))
	require.Len(t, a, 64)
}

func TestDisplayPrefix(t *testing.T) {
	require.Equal(t, "tm_pat_ab12c", DisplayPrefix("tm_pat_ab12cdefgh"))
	require.Equal(t, "short", DisplayPrefix("short"))
}
