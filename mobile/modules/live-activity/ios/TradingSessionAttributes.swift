import ActivityKit
import Foundation

/**
 * The ActivityKit contract between the app and the widget extension.
 *
 * This file is canonical here (compiled into the app through the
 * LiveActivity pod) and copied into the TraderMemosWidgets extension by
 * `plugins/with-widgets.js` on every prebuild — ActivityKit matches the two
 * targets on the type name and Codable shape, so the one source file keeps
 * them from drifting. The JSON side of the contract lives in
 * `src/lib/live-activity.ts`; change them in lockstep.
 *
 * Money is already FX-converted into the display currency, same rule as
 * `TodaySnapshot`: the extension formats, it never converts.
 */
struct TradingSessionAttributes: ActivityAttributes {
  struct ContentState: Codable, Hashable {
    let pnl: Double
    /// Trades opened today on the market clock.
    let tradesTaken: Int
    let openPositions: Int
    /// ISO 4217 code for every money field here.
    let currency: String
    /// Positive magnitude, from Settings → risk rules; nil when unset.
    let dailyLossLimit: Double?
    /// Positive magnitude, risk-per-trade (1R); nil when unset.
    let maxRiskPerTrade: Double?
    /// Privacy mode masks money, never the counts.
    let privacyMode: Bool
  }

  /// Market-timezone day key ("2026-08-09") this session belongs to. The
  /// session never crosses it — the app stales the activity at market
  /// midnight and ends it on the next launch.
  let dayKey: String
  /// IANA identifier the trading day is bucketed by (never the display tz).
  let marketTimezone: String
  /// When the user put the session on the Lock Screen.
  let startedAt: Date
}
