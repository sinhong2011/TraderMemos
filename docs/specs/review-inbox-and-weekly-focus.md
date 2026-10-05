# Spec — Review inbox & Weekly focus loop

Status: built (web) · 2026-10-05

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
  dismiss") with a one-click dismiss that sets no grade but stops counting them.
  Without this, a journal with history opens to an unclearable queue.

### 1.3 Data — no migration
- "Reviewed" is read straight off `trade_journal.trade_quality`; no `reviewed_at`
  column.
- The backlog dismissal is one timestamp, `reviewBacklogCutoff`, in
  `user_preferences`: unreviewed trades closed before it are no longer counted.
- `GET /reviews/inbox?window_days=14` → `{ items, backlog, window_days }`.
- `POST /reviews/dismiss-backlog` → sets the cutoff to the window's start.
- `rule_unreviewed` alignment (same definition, `Data.route = "/review"`) is still
  open.

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
The weekly review note already has `## Focus for next week`. Its **bullet lines
under that heading** (max 3) are next week's focus. Writing stays natural and both
clients work on day one; no new editor UI.

### 2.2 Data — read from the note, no table
Shipped without a `weekly_focus` table or migration: the note is the source of
truth, parsed on read (`alerts.ParseFocus`, `alerts.PreviousFocus`).
- The focus for the week starting Monday *M* (market timezone) is the newest
  `weekly_review` note created before *M*, from the previous week.
- `GET /focus/current` → `{week_start, items, note_id, note_title}`; empty `items`
  when there is no note or no bullets. Editing the note changes the focus at once.

### 2.3 Show it
- **Today page**: a slim "This week's focus" card above the routine — 1–3 lines, no
  ticks (focus is a behavior, not a task), with a link to open the source note.
- **Mobile Home**: same card (follow-up). Widget later.

### 2.4 Check it
- The next generated weekly review note opens with `## Last week's focus` — each
  item as a `- [ ]` checklist line the trader ticks while reviewing.
- Kept / Partly / Missed outcomes and "Focus kept 7 of 10 weeks" on Reports are
  deferred; they would need stored outcomes (a table) and are not built yet.

---

## 3. Delivery plan
| PR | Scope |
|---|---|
| 1 | Inbox + dismiss endpoints (grade-based, preference cutoff), web `/review` + entry points — `rule_unreviewed` alignment still open |
| 2 | Note parsing on read, `GET /focus/current`, Today card, "Last week's focus" checklist in the generated note (web) |
| 3 | Mobile: quick-journal queue mode, focus card |

## 4. Owner decisions (2026-10-05)
1. Reviewed = **execution grade set**; lesson and mistake tags optional.
2. Inbox = **last 14 days**, older unreviewed trades as a dismissable backlog.
3. Focus capture = **parse the bullets** under "Focus for next week" in the weekly note.
4. Build order: **review inbox first**, then the focus loop.
