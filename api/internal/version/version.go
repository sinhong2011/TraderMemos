package version

import (
	"os"
	"path/filepath"
	"strings"
)

// Version and Commit are set via -ldflags in release builds.
// When unset, Version falls back to repo root VERSION if present (local dev).
var (
	Version   = "dev"
	Commit    = ""
	BuildTime = ""
)

func init() {
	if Version != "dev" {
		return
	}
	if v := readRepoVersion(); v != "" {
		Version = v
	}
}

func readRepoVersion() string {
	dir, err := os.Getwd()
	if err != nil {
		return ""
	}
	for range 8 {
		data, err := os.ReadFile(filepath.Join(dir, "VERSION"))
		if err == nil {
			if v := strings.TrimSpace(string(data)); v != "" {
				return v
			}
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	return ""
}
