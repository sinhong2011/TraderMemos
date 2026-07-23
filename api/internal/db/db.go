package db

import (
	"database/sql"
	"fmt"

	_ "github.com/jackc/pgx/v5/stdlib"
	_ "modernc.org/sqlite"
)

// Open opens a database from a unified URL or bare SQLite path.
// See ParseURL for accepted forms.
func Open(databaseURL string) (*sql.DB, error) {
	info, err := ParseURL(databaseURL)
	if err != nil {
		return nil, err
	}
	switch info.Driver {
	case DriverSQLite:
		conn, err := sql.Open("sqlite", info.OpenDSN)
		if err != nil {
			return nil, err
		}
		conn.SetMaxOpenConns(1) // sqlite single-writer; serialize writes
		return conn, nil
	case DriverPostgres:
		conn, err := sql.Open("pgx", info.OpenDSN)
		if err != nil {
			return nil, err
		}
		conn.SetMaxOpenConns(10)
		conn.SetMaxIdleConns(5)
		if err := conn.Ping(); err != nil {
			_ = conn.Close()
			return nil, fmt.Errorf("postgres ping: %w", err)
		}
		return conn, nil
	default:
		return nil, fmt.Errorf("unsupported database driver %q", info.Driver)
	}
}
