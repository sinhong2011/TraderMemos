package store

import (
	"database/sql"

	"github.com/tradermemos/api/internal/db"
)

// NewForDriver returns a Querier for the given database driver.
func NewForDriver(conn *sql.DB, driver string) Querier {
	if driver == db.DriverPostgres {
		return NewPG(conn)
	}
	return New(conn)
}
