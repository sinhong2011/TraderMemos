package auth

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestPasswordHashVerify(t *testing.T) {
	h, err := HashPassword("hunter2")
	require.NoError(t, err)
	require.True(t, VerifyPassword(h, "hunter2"))
	require.False(t, VerifyPassword(h, "wrong"))
}

func TestValidatePassword(t *testing.T) {
	require.ErrorIs(t, ValidatePassword("short"), ErrPasswordTooShort)
	require.NoError(t, ValidatePassword("hunter2pass"))
}

