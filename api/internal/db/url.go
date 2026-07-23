package db

import (
	"fmt"
	"net/url"
	"strings"
)

const (
	DriverSQLite   = "sqlite"
	DriverPostgres = "postgres"
)

// Database describes a parsed TM_DATABASE_URL (or legacy path).
type Database struct {
	// Driver is DriverSQLite or DriverPostgres.
	Driver string
	// URL is a normalized form suitable for logging (password redacted for postgres later).
	URL string
	// SQLitePath is the filesystem path when Driver is sqlite.
	SQLitePath string
	// OpenDSN is the DSN passed to database/sql (sqlite file: DSN or postgres URL).
	OpenDSN string
}

// ParseURL parses a unified database URL.
//
// Supported today:
//
//	sqlite:data/tradermemos.db
//	sqlite:///data/tradermemos.db
//	file:data/tradermemos.db
//	file:///data/tradermemos.db
//	/data/tradermemos.db          (bare path → sqlite)
//	data/tradermemos.db           (bare path → sqlite)
//
// Accepted for future wiring (Open rejects until implemented):
//
//	postgres://…  postgresql://…
func ParseURL(raw string) (Database, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return Database{}, fmt.Errorf("empty database url")
	}

	// Bare filesystem path (no scheme).
	if !hasScheme(raw) {
		return sqliteFromPath(raw), nil
	}

	u, err := url.Parse(raw)
	if err != nil {
		return Database{}, fmt.Errorf("parse database url: %w", err)
	}

	switch strings.ToLower(u.Scheme) {
	case "sqlite", "sqlite3", "file":
		path, err := sqlitePathFromURL(u)
		if err != nil {
			return Database{}, err
		}
		return sqliteFromPath(path), nil
	case "postgres", "postgresql":
		return Database{
			Driver:  DriverPostgres,
			URL:     raw,
			OpenDSN: raw,
		}, nil
	default:
		return Database{}, fmt.Errorf("unsupported database url scheme %q (use sqlite:… or postgres://…)", u.Scheme)
	}
}

// FormatSQLiteURL builds the canonical sqlite: URL for a filesystem path.
func FormatSQLiteURL(path string) string {
	path = strings.TrimSpace(path)
	if path == "" {
		return ""
	}
	if strings.HasPrefix(path, "/") {
		return "sqlite://" + path
	}
	return "sqlite:" + path
}

func hasScheme(s string) bool {
	i := strings.Index(s, ":")
	if i <= 0 {
		return false
	}
	for _, c := range s[:i] {
		if (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '+' || c == '.' || c == '-' {
			continue
		}
		return false
	}
	return true
}

func sqlitePathFromURL(u *url.URL) (string, error) {
	if u.Opaque != "" {
		return u.Opaque, nil
	}
	// sqlite:///abs/path → Host="", Path="/abs/path"
	// sqlite://localhost/abs → Host="localhost" (unusual); join host + path
	if u.Host != "" && u.Host != "localhost" && u.Host != "127.0.0.1" {
		return "", fmt.Errorf("sqlite url must be sqlite:relative/path or sqlite:///absolute/path, got host %q", u.Host)
	}
	path := u.Path
	if path == "" || path == "/" {
		return "", fmt.Errorf("sqlite url missing path")
	}
	return path, nil
}

func sqliteFromPath(path string) Database {
	return Database{
		Driver:     DriverSQLite,
		URL:        FormatSQLiteURL(path),
		SQLitePath: path,
		OpenDSN:    sqliteOpenDSN(path),
	}
}

func sqliteOpenDSN(path string) string {
	return "file:" + path + "?_pragma=foreign_keys(1)&_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)"
}
