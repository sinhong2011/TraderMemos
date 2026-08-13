package db

import (
	"testing"

	"github.com/golang-migrate/migrate/v4/source/iofs"
)

// Two branches that each add a migration off the same parent land on the same
// version number, and golang-migrate refuses to build the source at all —
// which takes the server down on the next deploy, not on the next merge.
func TestMigrationSourcesLoad(t *testing.T) {
	for _, tc := range []struct {
		name string
		dir  string
	}{
		{name: "sqlite", dir: "migrations"},
		{name: "postgres", dir: "migrations_pg"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			fs := migrationsFS
			if tc.dir == "migrations_pg" {
				fs = migrationsPGFS
			}
			src, err := iofs.New(fs, tc.dir)
			if err != nil {
				t.Fatalf("%s: %v", tc.dir, err)
			}
			defer src.Close()
		})
	}
}
