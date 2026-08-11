//go:build !windows

package db

import (
	"fmt"
	"os"

	"golang.org/x/sys/unix"
)

func lockMigrateFile(f *os.File) error {
	if err := unix.Flock(int(f.Fd()), unix.LOCK_EX); err != nil {
		return fmt.Errorf("migrate lock: %w", err)
	}
	return nil
}

func unlockMigrateFile(f *os.File) error {
	return unix.Flock(int(f.Fd()), unix.LOCK_UN)
}
