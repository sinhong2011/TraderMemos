//go:build windows

package db

import (
	"fmt"
	"os"

	"golang.org/x/sys/windows"
)

func lockMigrateFile(f *os.File) error {
	h := windows.Handle(f.Fd())
	var ol windows.Overlapped
	if err := windows.LockFileEx(h, windows.LOCKFILE_EXCLUSIVE_LOCK, 0, 1, 0, &ol); err != nil {
		return fmt.Errorf("migrate lock: %w", err)
	}
	return nil
}

func unlockMigrateFile(f *os.File) error {
	h := windows.Handle(f.Fd())
	var ol windows.Overlapped
	return windows.UnlockFileEx(h, 0, 1, 0, &ol)
}
