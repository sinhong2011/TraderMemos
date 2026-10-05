# Spec — Review inbox & Weekly focus loop

Status: draft for owner review · 2026-10-05

Items 5 and 3 of the product brainstorm. Together they close the loop
**trade → review → rule → next session**: the inbox makes reviewing every trade a
habit, the weekly focus turns the week's review into 1–3 things to do differently,
and the next review checks whether they happened.

---

## 0. What exists today

| Need | Exists | Gap |
|---|---|---|
| Per-trade grade | `trade_journal.trade_quality` 1–5 → A+ A A- B C ("Execution rating", `web/src/lib/tradeGrades.ts`) | No `reviewed_at`; nothing lists ungraded trades |
| Per-trade lesson | "Review notes" section inside `trade_journal.notes` markdown | — |
| Mistake tags | `kind = 'mistake'` tags | — |
| Unreviewed push | `rule_unreviewed`: weekly "N closed trades older than D days have no journal notes" | No route; "reviewed" = any note or grade |
| Weekly review | Saturday 09:00 (market tz) job creates a `weekly_review` note with `## Focus for next week` | Focus is free text; nothing reads it or checks it next week |
| Quick journal (mobile) | Grade + Review notes + mistake tags for one trade | No queue, no "next" |

---

## 1. Review inbox

### 1.1 Definition
A closed trade is **reviewed** once it has an execution grade (`trade_quality` set).
The lesson and mistake tags are encouraged, not required — one tap must be enough
to clear a trade, or the inbox becomes a chore.

### 1.2 Scope
- The inbox lists unreviewed closed trades from the **last 14 days**, newest first.
- Older unreviewed trades are a collapsed **backlog** count ("212 older — review or
  dismiss") with a one-click "Mark all older as reviewed" that sets no grade but
  stamps them out of the queue (`review_dismissed_at`). Without this, a journal with
  history opens to an unclearable queue.

### 1.3 Data
- Migration: `trade_journal.reviewed_at TEXT NULL`, `review_dismissed_at TEXT NULL`
  (SQLite: add via table rebuild per `000039` idiom; Postgres: `ALTER TABLE`).
- `reviewed_at` is set server-side the first time `trade_quality` goes non-null and
  cleared if it is cleared.
- `GET /reviews/inbox?window_days=14` → `{ items: [trade + journal summary], backlog: n }`.
- `POST /reviews/dismiss-backlog` → stamps everything older than the window.
- `rule_unreviewed` switches to the same definition and gains `Data.route = "/review"`.

### 1.4 Web — `/review`
One trade at a time, keyboard-first:
- Header: "7 to review · 212 older".
- Trade card: symbol, side, P&L and R, entry→exit, setup, existing mistake tags, the
  small chart.
- **Grade**: five buttons A+ A A- B C, keys `1`–`5`.
- **Lesson**: one line, saved into the Review notes section.
- **Mistakes**: the mistake tag chips, toggle with click.
- **Save & next** (`Enter`), **Skip** (`→`), **Back** (`←`). Done state: "Inbox
  zero — N reviewed today".
- Entry points: a count badge on the rail's Today icon, a line on the Today page
  ("3 trades to review →"), and the mistake-tax "unreviewed" prompt.

### 1.5 Mobile (follow-up PR)
Quick journal gains a queue mode (`/quick-journal?queue=1`): after save it opens the
next inbox trade; the push route lands there.

---

## 2. Weekly focus loop

### 2.1 Capture — from the review note itself
The weekly review note already has `## Focus for next week`. When a `weekly_review`
note is saved, the server reads the **bullet lines under that heading** (max 3) and
stores them as next week's focus. Writing stays natural and both clients work on day
one; no new editor UI.

### 2.2 Data
- Table `weekly_focus(id, user_id, week_start, position, text, outcome NULL|kept|partly|missed, note_id, created_at)`;
  `week_start` is the Monday the focus applies to, in the market timezone.
- Re-saving the note replaces that week's items (outcomes kept for unchanged text).
- `GET /focus?week=current` → items; `PATCH /focus/:id {outcome}`.

### 2.3 Show it
- **Today page**: a slim "This week's focus" card above the routine — 1–3 lines, no
  ticks (focus is a behavior, not a task).
- **Mobile Home**: same card. Widget later.

### 2.4 Check it
- The next weekly review note is prefilled with `## Last week's focus` listing each
  item, and the review screen (web note editor side panel / mobile edit-note header)
  shows the items with **Kept / Partly / Missed**.
- Over time: "Focus kept 7 of 10 weeks" on the Reports Behavior tab (later).

---

## 3. Delivery plan
| PR | Scope |
|---|---|
| 1 | `reviewed_at`/`review_dismissed_at`, inbox + dismiss endpoints, `rule_unreviewed` alignment, web `/review` + entry points |
| 2 | `weekly_focus` table, note-save parsing, focus endpoints, Today card, "Last week's focus" in the generated note, outcome buttons (web) |
| 3 | Mobile: quick-journal queue mode, focus card, outcome buttons |

## 4. Owner decisions (2026-10-05)
1. Reviewed = **execution grade set**; lesson and mistake tags optional.
2. Inbox = **last 14 days**, older unreviewed trades as a dismissable backlog.
3. Focus capture = **parse the bullets** under "Focus for next week" in the weekly note.
4. Build order: **review inbox first**, then the focus loop.
