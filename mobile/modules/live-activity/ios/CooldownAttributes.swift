import ActivityKit
import Foundation

/**
 * The ActivityKit contract for the cooldown countdown. Canonical here, copied
 * into the widget extension by `plugins/with-widgets.js` on every prebuild —
 * same arrangement as `TradingSessionAttributes`. The JSON side lives in
 * `src/lib/cooldown-live-activity.ts`; change them in lockstep.
 *
 * The countdown itself is drawn by the system (`Text(timerInterval:)`), so
 * the activity needs no per-second updates: the app pushes one state when
 * the session starts, one when it reaches the gate, and ends it on release.
 */
struct CooldownAttributes: ActivityAttributes {
  struct ContentState: Codable, Hashable {
    /// When the timer ends. Past this the activity is stale and reads as the
    /// return gate waiting to be answered.
    let endsAt: Date
    /// "counting" | "gate" — mirrors the server's phase.
    let phase: String
  }

  /// Server session id, so the app can tell a survivor from a fresh session.
  let sessionID: String
  /// "manual" | "loss_streak" | "daily_loss" | "trade_limit".
  let trigger: String
  let startedAt: Date
}
