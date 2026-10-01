# MetaTrader 5 EA — live deal sync

`TraderMemosSync.mq5` is an Expert Advisor that runs inside your MetaTrader 5
terminal and pushes the account's deals to your TraderMemos server as they
happen. It is the self-hosted answer to broker auto-sync:

- **No broker credential leaves your machine.** The EA reads the history the
  terminal already has; it talks only to your own server, with a revocable
  personal access token.
- **Nothing to export by hand.** New deals are pushed within seconds; deals
  closed while the terminal was off are picked up the next time it starts.
- **It never trades.** The EA only reads history. It places, changes and
  closes no orders.

Re-sending deals is always safe. The server dedups fills, and a sync with
nothing new leaves no trace in import history. A deal synced by the EA and
the same deal later imported from a Trade History Report land on **one**
fill, because both go through the same conversion.

MT4 has no EA yet. For MT4 accounts, import the account Statement (`.html`)
from **Import** in the app.

## Install

1. **Create a token**: TraderMemos → Settings → API tokens → New token
   (`tm_pat_…`, shown once). Copy the account ID from Settings → Accounts.
2. **Copy the EA**: in MT5, *File → Open Data Folder*, then put
   [`TraderMemosSync.mq5`](../integrations/metatrader/TraderMemosSync.mq5)
   into `MQL5/Experts/`. Take the file from the release tag that matches your
   server version. Open it in MetaEditor (F4) and press *Compile* (F7).
3. **Allow the server URL**: *Tools → Options → Expert Advisors* → tick
   *Allow WebRequest for listed URL* and add your TraderMemos URL
   (for example `https://journal.example.com`).
4. **Attach it**: drag *TraderMemosSync* from the Navigator onto any one
   chart. Fill in the inputs and enable *Algo Trading*.

| Input | Meaning |
|---|---|
| `InpServerUrl` | Your TraderMemos URL, the same one you allowed above |
| `InpToken` | The `tm_pat_…` token |
| `InpAccountId` | The TraderMemos account the deals belong to |
| `InpSourceTimezone` | IANA zone of the broker's server clock (default `Europe/Athens`) |
| `InpBackfillDays` | How much history the first run sends (default 90) |
| `InpSyncMinutes` | Safety resync interval (default 5) |

The *Experts* tab logs every sync that inserted deals, plus any warning or
error. One chart per account is enough. A second copy only re-sends deals the
server already has.

## Timezone

MetaTrader reports deal times on the **broker server's clock**. For most
brokers that is EET/EEST (`Europe/Athens`), which is the default. Statement
imports use the same default, which keeps the two paths consistent.

Each sync also sends the terminal's current broker-clock offset. If it does
not match `InpSourceTimezone`, the server keeps the fills and the *Experts*
tab shows a warning like:

> broker server clock is UTC+5 but Europe/Athens is UTC+3 right now

When you see that warning, set `InpSourceTimezone` to the zone your broker
documents. Getting it wrong shifts every fill by a fixed few hours. The
classic symptom is "my Friday trades show up on Saturday". Fills already
synced with the wrong zone can be undone from Settings → Import history.

## How it syncs

- On start, the first sync sends `InpBackfillDays` of history. Later syncs
  send deals since the last successful sync, minus a one-day overlap. The
  sync point is kept per MT5 login in the terminal's global variables
  (`TM_SYNC_<login>_<account>`). Delete that variable to backfill again.
- A new deal (`TRADE_TRANSACTION_DEAL_ADD`) triggers a sync on the next
  5-second tick. A failed sync is retried a minute later. A sync also runs
  every `InpSyncMinutes` as a safety net.
- Only buy/sell deals are sent. Balance, credit and commission rows are not
  fills.
- API: `POST /api/v1/sync/mt5` (see the API reference).
