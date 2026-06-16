package money

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestRound2(t *testing.T) {
	require.Equal(t, 12.35, Round2(12.345))
	require.Equal(t, -0.01, Round2(-0.005))
	require.Equal(t, 100.0, Round2(99.999999))
}
