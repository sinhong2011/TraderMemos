package logging

import (
	"log/slog"
	"os"
	"strings"

	"github.com/rs/zerolog"
	slogzerolog "github.com/samber/slog-zerolog/v2"
)

// New creates a zerolog-backed slog logger.
// Terminal output uses a colorized console writer; non-terminal uses JSON.
func New(level string) *slog.Logger {
	zl := newZerolog(level)
	lvl := parseSlogLevel(level)
	return slog.New(slogzerolog.Option{Level: lvl, Logger: &zl}.NewZerologHandler())
}

func newZerolog(level string) zerolog.Logger {
	lvl := parseZerologLevel(level)
	if isTerminal() {
		return zerolog.New(zerolog.ConsoleWriter{Out: os.Stderr}).
			Level(lvl).
			With().
			Timestamp().
			Logger()
	}
	return zerolog.New(os.Stderr).
		Level(lvl).
		With().
		Timestamp().
		Logger()
}

func parseZerologLevel(level string) zerolog.Level {
	switch strings.ToLower(strings.TrimSpace(level)) {
	case "debug":
		return zerolog.DebugLevel
	case "warn", "warning":
		return zerolog.WarnLevel
	case "error":
		return zerolog.ErrorLevel
	default:
		return zerolog.InfoLevel
	}
}

func parseSlogLevel(level string) slog.Level {
	switch strings.ToLower(strings.TrimSpace(level)) {
	case "debug":
		return slog.LevelDebug
	case "warn", "warning":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}

func isTerminal() bool {
	fi, err := os.Stderr.Stat()
	if err != nil {
		return false
	}
	return fi.Mode()&os.ModeCharDevice != 0
}
