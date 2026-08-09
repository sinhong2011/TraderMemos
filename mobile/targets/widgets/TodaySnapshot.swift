import Foundation

/**
 * The JSON contract with the app. Written by `src/lib/widget-snapshot.ts`
 * through `modules/widget-bridge`; any field change must move in lockstep on
 * both sides and bump the key suffix in `WidgetBridgeModule.snapshotKey`.
 *
 * Money fields are already FX-converted into the user's display currency —
 * the widget only formats, it never converts.
 */
struct TodaySnapshot: Codable {
  let schema: Int
  /// ISO8601, when the app last wrote this snapshot.
  let generatedAt: String
  /// Market-timezone day key ("2026-08-09") the P&L below belongs to.
  let dayKey: String
  /// IANA identifier the trading day is bucketed by (never the display tz).
  let marketTimezone: String
  /// ISO 4217 code for every money field here.
  let currency: String
  let todayNetPnl: Double
  let openPositions: Int
  /// Positive magnitude, from Settings → risk rules; nil when unset.
  let dailyLossLimit: Double?
  /// Positive magnitude, risk-per-trade (1R); nil when unset.
  let maxRiskPerTrade: Double?
  /// Privacy mode masks money, never the counts.
  let privacyMode: Bool

  static let appGroup = "group.com.tradermemos.app"
  static let key = "todaySnapshot.v1"

  static func load() -> TodaySnapshot? {
    guard
      let defaults = UserDefaults(suiteName: appGroup),
      let json = defaults.string(forKey: key),
      let data = json.data(using: .utf8)
    else { return nil }
    return try? JSONDecoder().decode(TodaySnapshot.self, from: data)
  }
}

/**
 * The snapshot resolved against a wall-clock instant. Two jobs beyond
 * pass-through: the market-day rollover (a snapshot written yesterday must
 * render as a fresh day, not yesterday's P&L) and the derived loss-budget
 * arithmetic shared by every widget family.
 */
struct TodayState {
  let pnl: Double
  let openPositions: Int
  let currency: String
  let privacyMode: Bool
  let dailyLossLimit: Double?
  let maxRiskPerTrade: Double?

  /// Loss spent against the budget today (0 when green).
  var lossSpent: Double { pnl < 0 ? -pnl : 0 }
  /// 0–1 share of the daily loss budget consumed, nil without a limit.
  var budgetUsed: Double? {
    guard let cap = dailyLossLimit, cap > 0 else { return nil }
    return min(1, lossSpent / cap)
  }
  var budgetBreached: Bool {
    guard let cap = dailyLossLimit, cap > 0 else { return false }
    return lossSpent >= cap
  }
  /// Currency left before the daily loss limit, nil without a limit.
  var budgetRemaining: Double? {
    guard let cap = dailyLossLimit, cap > 0 else { return nil }
    return max(0, cap - lossSpent)
  }
  /// Full 1R risks left inside the remaining budget, nil without both rules.
  var rRemaining: Double? {
    guard let remaining = budgetRemaining, let r = maxRiskPerTrade, r > 0 else { return nil }
    return remaining / r
  }

  static func resolve(_ snapshot: TodaySnapshot, at date: Date) -> TodayState {
    let stale = snapshot.dayKey != Self.dayKey(at: date, timeZone: snapshot.marketTimezone)
    return TodayState(
      // A new market day starts from zero; limits and rules carry over. Open
      // positions also carry — they are positions, not a daily figure.
      pnl: stale ? 0 : snapshot.todayNetPnl,
      openPositions: snapshot.openPositions,
      currency: snapshot.currency,
      privacyMode: snapshot.privacyMode,
      dailyLossLimit: snapshot.dailyLossLimit,
      maxRiskPerTrade: snapshot.maxRiskPerTrade
    )
  }

  /// Next market-midnight after `date` — the moment today's P&L resets.
  static func nextRollover(for snapshot: TodaySnapshot, after date: Date) -> Date? {
    guard let tz = TimeZone(identifier: snapshot.marketTimezone) else { return nil }
    var calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = tz
    let startOfDay = calendar.startOfDay(for: date)
    return calendar.date(byAdding: .day, value: 1, to: startOfDay)
  }

  static func dayKey(at date: Date, timeZone identifier: String) -> String {
    let formatter = DateFormatter()
    formatter.calendar = Calendar(identifier: .gregorian)
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.timeZone = TimeZone(identifier: identifier) ?? .current
    formatter.dateFormat = "yyyy-MM-dd"
    return formatter.string(from: date)
  }
}

enum WidgetFormat {
  /// "+$1,234" / "−$56.50" — signed, trailing cents only when they carry
  /// information, matching the app's formatPnl.
  static func pnl(_ value: Double, currency: String, masked: Bool) -> String {
    if masked { return "•••" }
    let formatted = money(abs(value), currency: currency)
    if value < 0 { return "−\(formatted)" }
    if value > 0 { return "+\(formatted)" }
    return formatted
  }

  static func money(_ value: Double, currency: String, masked: Bool = false) -> String {
    if masked { return "•••" }
    let formatter = NumberFormatter()
    formatter.numberStyle = .currency
    formatter.currencyCode = currency
    // Whole units once the number is big enough that cents are noise — the
    // small widget has ~9 digits of room.
    let wants = abs(value) >= 1000 || value == value.rounded()
    formatter.maximumFractionDigits = wants ? 0 : 2
    formatter.minimumFractionDigits = 0
    return formatter.string(from: NSNumber(value: value)) ?? String(value)
  }

  /// "1.4R" with a single decimal only below 10.
  static func r(_ value: Double) -> String {
    value >= 10 ? String(format: "%.0fR", value) : String(format: "%.1fR", value)
  }
}
