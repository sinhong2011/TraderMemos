package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/BurntSushi/toml"
)

// Config is ~/.tm-sync.toml. The token is a TraderMemos personal access token
// (Settings → API tokens) — it authenticates against your own server, so no
// broker credential is ever involved.
type Config struct {
	// APIURL is the TraderMemos server base URL (e.g. "https://tm.example.com").
	APIURL string `toml:"api_url"`
	// Token is a personal access token ("tm_pat_…").
	Token string `toml:"token"`
	// AccountID receives the imported fills.
	AccountID string `toml:"account_id"`
	// Watch lists directories to monitor for MetaTrader statements.
	Watch []WatchRule `toml:"watch"`
}

// WatchRule is one watched directory. Files are recognized by content sniff
// (MT5 Trade History Report .xlsx/.html, MT4 Statement .html), so no filename
// pattern is needed — non-statement files are ignored.
type WatchRule struct {
	Dir string `toml:"dir"`
	// SourceTZ is the IANA zone the broker's MetaTrader server runs in.
	// Empty means the MetaTrader convention (EET / Europe/Athens) — never UTC.
	SourceTZ string `toml:"source_tz"`
}

const sampleConfig = `# tm-sync — watches MetaTrader statement exports and syncs fills to TraderMemos.
# Your broker credentials never leave this machine: tm-sync only reads exported
# statement files and talks to your own TraderMemos server.

api_url = "http://localhost:8787"

# Personal access token: TraderMemos → Settings → API tokens → New token.
token = "tm_pat_replace-me"

# Target account id: TraderMemos → Settings → Accounts (or GET /api/v1/accounts).
account_id = "replace-me"

# One [[watch]] block per directory. MT5: File → Reports → save the Trade
# History Report into this folder (.xlsx or .html). MT4: right-click account
# history → Save as Report.
[[watch]]
dir = 'C:\Users\you\Documents\MetaTrader-Reports'
# IANA zone of the broker's MT server clock. Default: Europe/Athens (EET) —
# the MetaTrader convention. Only change it if your broker documents otherwise.
# source_tz = "Europe/Athens"
`

func defaultConfigPath() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return ".tm-sync.toml"
	}
	return filepath.Join(home, ".tm-sync.toml")
}

func loadConfig(path string) (Config, error) {
	var cfg Config
	if _, err := toml.DecodeFile(path, &cfg); err != nil {
		return cfg, err
	}
	if err := cfg.validate(); err != nil {
		return cfg, err
	}
	return cfg, nil
}

func (c Config) validate() error {
	if strings.TrimSpace(c.APIURL) == "" {
		return fmt.Errorf("api_url is required")
	}
	if strings.TrimSpace(c.Token) == "" {
		return fmt.Errorf("token is required (create one under Settings → API tokens)")
	}
	if strings.TrimSpace(c.AccountID) == "" {
		return fmt.Errorf("account_id is required")
	}
	if len(c.Watch) == 0 {
		return fmt.Errorf("at least one [[watch]] directory is required")
	}
	for i, w := range c.Watch {
		if strings.TrimSpace(w.Dir) == "" {
			return fmt.Errorf("watch[%d]: dir is required", i)
		}
		if w.SourceTZ != "" {
			if _, err := time.LoadLocation(w.SourceTZ); err != nil {
				return fmt.Errorf("watch[%d]: invalid source_tz %q (want IANA name like Europe/Athens)", i, w.SourceTZ)
			}
		}
	}
	return nil
}

// writeSampleConfig creates path with the annotated template; it refuses to
// overwrite an existing file. 0600 because the file will hold the PAT.
func writeSampleConfig(path string) error {
	if _, err := os.Stat(path); err == nil {
		return fmt.Errorf("%s already exists — edit it instead", path)
	}
	return os.WriteFile(path, []byte(sampleConfig), 0o600)
}
