# tm-sync — local statement watcher

`tm-sync` is a single small binary that watches folders on your trading
machine for MetaTrader statement exports and syncs their fills to your
TraderMemos server. It is the self-hosted answer to broker auto-sync:
**no broker credential ever leaves your machine** — tm-sync only reads
report files the terminal already wrote, and talks to your own server
with a revocable personal access token.

Supported files (recognized by content, filenames don't matter):

- **MT5** — Trade History Report (`.xlsx` or `.html`), the Deals table
- **MT4** — Account Statement (`.html`), the Closed Transactions table

Re-syncing the same statement is always safe: the server dedups fills by
content hash, so overlapping reports and replays never double-import.

## Install

Download the binary for your platform from the
[latest release](https://github.com/sinhong2011/TraderMemos/releases)
(`tm-sync_<version>_windows_amd64.zip`, `…_darwin_arm64.tar.gz`, …), or build
from source:

```sh
cd api && go build ./cmd/tm-sync
```

## Setup

1. **Create a token**: TraderMemos → Settings → API tokens → New token
   (`tm_pat_…` — shown once).
2. **Write the config**:

   ```sh
   tm-sync init          # writes ~/.tm-sync.toml (0600)
   ```

   Fill in:

   ```toml
   api_url    = "https://your-tradermemos.example.com"
   token      = "tm_pat_…"
   account_id = "…"                      # Settings → Accounts

   [[watch]]
   dir = 'C:\Users\you\Documents\MetaTrader-Reports'
   # source_tz = "Europe/Athens"        # broker MT server zone; EET default
   ```

3. **Verify**: `tm-sync check` — confirms the server is reachable, the token
   works, and the account exists.

## Run

```sh
tm-sync scan   # sync everything in the watch dirs once, then exit
tm-sync run    # keep watching; syncs new/changed statements as they appear
```

`run` does an initial full scan, then reacts to file changes (with a periodic
rescan as a fallback). Point MT5's *File → Reports* export (or MT4's
*right-click history → Save as Report*) at a watched folder and your journal
stays current.

### Keep it running

- **Windows** (MT5's home): Task Scheduler → Create Task → run
  `tm-sync.exe run` at log on.
- **macOS / Linux**: a LaunchAgent or systemd user unit running `tm-sync run`.

## Timezones

MetaTrader statements carry the **broker server's wall clock** — for most
brokers that is EET (`Europe/Athens`), which is also tm-sync's default. If your
broker documents a different server timezone, set `source_tz` on the watch
rule. Getting this wrong shifts every fill by a fixed few hours (the classic
"my Friday trades show up on Saturday" symptom).
