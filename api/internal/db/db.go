package db

import (
	"database/sql"
	"fmt"

	_ "modernc.org/sqlite"
)

// Open opens a database from a unified URL or bare SQLite path.
// See ParseURL for accepted forms. Postgres URLs parse but are not implemented yet.
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
		return nil, fmt.Errorf("postgres driver not implemented yet; use a sqlite: URL (e.g. sqlite:data/tradermemos.db)")
	default:
		return nil, fmt.Errorf("unsupported database driver %q", info.Driver)
	}
}
