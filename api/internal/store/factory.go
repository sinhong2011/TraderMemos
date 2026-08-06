package store

import (
	"database/sql"

	"github.com/tradermemos/api/internal/db"
)

// NewForDriver returns a Querier for the given database driver.
// The returned store also implements TxRunner.
func NewForDriver(conn *sql.DB, driver string) Querier {
	if driver == db.DriverPostgres {
		return &pgStore{PG: NewPG(conn), conn: conn}
	}
	return &sqliteStore{Queries: New(conn), conn: conn}
}
