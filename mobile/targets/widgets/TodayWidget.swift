import SwiftUI
import WidgetKit

struct TodayEntry: TimelineEntry {
  let date: Date
  /// nil until the app has written a snapshot (fresh install / signed out).
  let state: TodayState?
}

struct TodayProvider: TimelineProvider {
  func placeholder(in context: Context) -> TodayEntry {
    TodayEntry(date: .now, state: .sample)
  }

  func getSnapshot(in context: Context, completion: @escaping (TodayEntry) -> Void) {
    if context.isPreview {
      completion(TodayEntry(date: .now, state: .sample))
      return
    }
    completion(entry(at: .now))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<TodayEntry>) -> Void) {
    let now = Date()
    var entries = [entry(at: now)]
    // The app's reloadAllTimelines() is the real refresh signal; the one
    // transition the widget must make on its own is the market-day rollover,
    // when today's P&L resets to zero without anyone opening the app.
    if let snapshot = TodaySnapshot.load(),
       let rollover = TodayState.nextRollover(for: snapshot, after: now) {
      entries.append(TodayEntry(date: rollover, state: TodayState.resolve(snapshot, at: rollover)))
      completion(Timeline(entries: entries, policy: .after(rollover)))
    } else {
      completion(Timeline(entries: entries, policy: .never))
    }
  }

  private func entry(at date: Date) -> TodayEntry {
    guard let snapshot = TodaySnapshot.load() else {
      return TodayEntry(date: date, state: nil)
    }
    return TodayEntry(date: date, state: TodayState.resolve(snapshot, at: date))
  }
}

extension TodayState {
  static let sample = TodayState(
    pnl: 412.5,
    openPositions: 2,
    currency: "USD",
    privacyMode: false,
    dailyLossLimit: 500,
    maxRiskPerTrade: 125
  )
}

// MARK: - Shared pieces

/// Loss-budget bar, the widget-sized DailyLossCard track: primary fill,
/// amber past 70%, red once the limit is hit.
struct BudgetBar: View {
  let state: TodayState

  var body: some View {
    if let used = state.budgetUsed {
      GeometryReader { geo in
        ZStack(alignment: .leading) {
          Capsule().fill(WidgetTheme.track)
          Capsule()
            .fill(fill(used: used))
            .frame(width: max(used > 0 ? 4 : 0, geo.size.width * used))
        }
      }
      .frame(height: 5)
    }
  }

  private func fill(used: Double) -> Color {
    if state.budgetBreached { return WidgetTheme.loss }
    if used >= 0.7 { return WidgetTheme.warning }
    return WidgetTheme.primary
  }
}

/// "2 open · 1.4R left" — the counts row under the P&L figure.
struct PositionsAndRLine: View {
  let state: TodayState

  var body: some View {
    Text(text)
      .font(.system(size: 12, weight: .medium))
      .foregroundStyle(WidgetTheme.mutedForeground)
      .lineLimit(1)
      .minimumScaleFactor(0.8)
  }

  private var text: String {
    var parts = [String(localized: "\(state.openPositions) open")]
    if state.budgetBreached {
      parts.append(String(localized: "limit hit"))
    } else if let r = state.rRemaining {
      parts.append(String(localized: "\(WidgetFormat.r(r)) left"))
    } else if let remaining = state.budgetRemaining {
      parts.append(
        String(
          localized:
            "\(WidgetFormat.money(remaining, currency: state.currency, masked: state.privacyMode)) left"
        )
      )
    }
    return parts.joined(separator: " · ")
  }
}

struct EmptyStateView: View {
  var body: some View {
    VStack(spacing: 4) {
      Image(systemName: "chart.line.uptrend.xyaxis")
        .font(.system(size: 20, weight: .medium))
        .foregroundStyle(WidgetTheme.mutedForeground)
      Text("Open TraderMemos")
        .font(.system(size: 12, weight: .medium))
        .foregroundStyle(WidgetTheme.mutedForeground)
        .multilineTextAlignment(.center)
    }
  }
}

// MARK: - Home Screen

struct HomeWidgetView: View {
  @Environment(\.widgetFamily) private var family
  let state: TodayState

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      Text("TODAY")
        .font(.system(size: 10, weight: .semibold))
        .kerning(0.7)
        .foregroundStyle(WidgetTheme.mutedForeground)

      Text(WidgetFormat.pnl(state.pnl, currency: state.currency, masked: state.privacyMode))
        .font(.system(size: family == .systemMedium ? 30 : 24, weight: .semibold, design: .rounded))
        .monospacedDigit()
        .foregroundStyle(WidgetTheme.pnl(state.pnl))
        .lineLimit(1)
        .minimumScaleFactor(0.6)

      Spacer(minLength: 0)

      if family == .systemMedium, let limit = state.dailyLossLimit {
        HStack(alignment: .firstTextBaseline) {
          Text("Daily loss limit")
            .font(.system(size: 12, weight: .medium))
            .foregroundStyle(WidgetTheme.foreground)
          Spacer()
          Text(WidgetFormat.money(limit, currency: state.currency, masked: state.privacyMode))
            .font(.system(size: 12, weight: .medium))
            .monospacedDigit()
            .foregroundStyle(WidgetTheme.mutedForeground)
        }
      }
      BudgetBar(state: state)
      PositionsAndRLine(state: state)
    }
  }
}

// MARK: - Lock Screen accessories

struct RectangularView: View {
  let state: TodayState

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      Text("TraderMemos")
        .font(.system(size: 11, weight: .semibold))
        .widgetAccentable()
      Text(WidgetFormat.pnl(state.pnl, currency: state.currency, masked: state.privacyMode))
        .font(.system(size: 16, weight: .semibold, design: .rounded))
        .monospacedDigit()
      PositionsAndRLine(state: state)
        .foregroundStyle(.secondary)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

struct CircularView: View {
  let state: TodayState

  var body: some View {
    if let used = state.budgetUsed {
      Gauge(value: used) {
        Text("R")
      } currentValueLabel: {
        Text(centerText)
          .font(.system(size: 12, weight: .semibold, design: .rounded))
          .monospacedDigit()
          .minimumScaleFactor(0.6)
      }
      .gaugeStyle(.accessoryCircularCapacity)
    } else {
      // No loss limit configured — show the day's direction instead.
      VStack(spacing: 0) {
        Image(systemName: state.pnl >= 0 ? "arrow.up" : "arrow.down")
          .font(.system(size: 12, weight: .bold))
        Text(WidgetFormat.pnl(state.pnl, currency: state.currency, masked: state.privacyMode))
          .font(.system(size: 11, weight: .semibold, design: .rounded))
          .monospacedDigit()
          .minimumScaleFactor(0.5)
          .lineLimit(1)
      }
    }
  }

  private var centerText: String {
    if state.budgetBreached { return "0" }
    if let r = state.rRemaining { return WidgetFormat.r(r) }
    return "\(Int(((state.budgetUsed ?? 0) * 100).rounded()))%"
  }
}

struct InlineView: View {
  let state: TodayState

  var body: some View {
    Text(text)
  }

  private var text: String {
    let pnl = WidgetFormat.pnl(state.pnl, currency: state.currency, masked: state.privacyMode)
    let arrow = state.pnl >= 0 ? "▲" : "▼"
    return "\(arrow) \(pnl) · \(String(localized: "\(state.openPositions) open"))"
  }
}

// MARK: - Widget

struct TodayWidgetView: View {
  @Environment(\.widgetFamily) private var family
  let entry: TodayEntry

  var body: some View {
    Group {
      if let state = entry.state {
        switch family {
        case .accessoryRectangular: RectangularView(state: state)
        case .accessoryCircular: CircularView(state: state)
        case .accessoryInline: InlineView(state: state)
        default: HomeWidgetView(state: state)
        }
      } else {
        switch family {
        case .accessoryInline: Text("TraderMemos — open the app")
        case .accessoryCircular:
          Image(systemName: "chart.line.uptrend.xyaxis").font(.system(size: 16, weight: .medium))
        default: EmptyStateView()
        }
      }
    }
    .containerBackground(for: .widget) {
      WidgetTheme.card
    }
  }
}

struct TodayWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "TodayWidget", provider: TodayProvider()) { entry in
      TodayWidgetView(entry: entry)
    }
    .configurationDisplayName("Today")
    .description("Today's P&L, open positions, and what's left of the daily loss budget.")
    .supportedFamilies([
      .systemSmall,
      .systemMedium,
      .accessoryRectangular,
      .accessoryCircular,
      .accessoryInline,
    ])
  }
}
