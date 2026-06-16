package storage

import (
	"bytes"
	"io"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestLocalDiskRoundTrip(t *testing.T) {
	s := NewLocalDisk(t.TempDir())
	key := "user1/att1.png"
	require.NoError(t, s.Put(key, bytes.NewReader([]byte("PNGDATA"))))
	r, err := s.Get(key)
	require.NoError(t, err)
	defer r.Close()
	b, _ := io.ReadAll(r)
	require.Equal(t, "PNGDATA", string(b))
	require.NoError(t, s.Delete(key))
	_, err = s.Get(key)
	require.Error(t, err)
}
