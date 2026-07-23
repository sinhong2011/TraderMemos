package db

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestParseURL_SQLiteForms(t *testing.T) {
	cases := []struct {
		in   string
		path string
		url  string
	}{
		{"data/tradermemos.db", "data/tradermemos.db", "sqlite:data/tradermemos.db"},
		{"sqlite:data/tradermemos.db", "data/tradermemos.db", "sqlite:data/tradermemos.db"},
		{"sqlite:///data/tradermemos.db", "/data/tradermemos.db", "sqlite:///data/tradermemos.db"},
		{"file:data/x.db", "data/x.db", "sqlite:data/x.db"},
		{"file:///data/x.db", "/data/x.db", "sqlite:///data/x.db"},
		{"/data/tradermemos.db", "/data/tradermemos.db", "sqlite:///data/tradermemos.db"},
	}
	for _, tc := range cases {
		t.Run(tc.in, func(t *testing.T) {
			d, err := ParseURL(tc.in)
			require.NoError(t, err)
			require.Equal(t, DriverSQLite, d.Driver)
			require.Equal(t, tc.path, d.SQLitePath)
			require.Equal(t, tc.url, d.URL)
			require.Contains(t, d.OpenDSN, "file:"+tc.path)
			require.Contains(t, d.OpenDSN, "foreign_keys(1)")
		})
	}
}

func TestParseURL_Postgres(t *testing.T) {
	raw := "postgres://user:pass@host:5432/db?sslmode=require"
	d, err := ParseURL(raw)
	require.NoError(t, err)
	require.Equal(t, DriverPostgres, d.Driver)
	require.Equal(t, raw, d.OpenDSN)
	require.Equal(t, raw, d.URL)
	require.Empty(t, d.SQLitePath)
}

func TestParseURL_Errors(t *testing.T) {
	_, err := ParseURL("")
	require.Error(t, err)
	_, err = ParseURL("mysql://localhost/db")
	require.Error(t, err)
	_, err = ParseURL("sqlite://remote.example/data.db")
	require.Error(t, err)
}

func TestRedactDatabaseURL(t *testing.T) {
	got := RedactDatabaseURL("postgres://user:s3cret@host:5432/db?sslmode=require")
	require.NotContains(t, got, "s3cret")
	require.True(t, strings.Contains(got, "***") || strings.Contains(got, "%2A%2A%2A"))
	require.Equal(t, "sqlite:data/x.db", RedactDatabaseURL("sqlite:data/x.db"))
}

func TestOpen_BarePath(t *testing.T) {
	path := t.TempDir() + "/t.db"
	conn, err := Open(path)
	require.NoError(t, err)
	defer conn.Close()
	require.NoError(t, Migrate(conn))
}

func TestOpen_SQLiteURL(t *testing.T) {
	path := t.TempDir() + "/u.db"
	conn, err := Open(FormatSQLiteURL(path))
	require.NoError(t, err)
	defer conn.Close()
	require.NoError(t, Migrate(conn, DriverSQLite))
}
