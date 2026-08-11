import ActivityKit
import SwiftUI
import WidgetKit

/**
 * The Lock Screen / Dynamic Island face of the trading session. Driven by the
 * app through `modules/live-activity`; `TradingSessionAttributes.swift` is
 * copied in from that module by the config plugin so both targets compile the
 * identical contract.
 *
 * The content state is a superset of the widget snapshot, so the derived
 * loss-budget arithmetic and the shared pieces (BudgetBar, WidgetFormat,
 * WidgetTheme) are reused as-is via `TodayState`.
 */

extension TradingSessionAttributes.ContentState {
  var todayState: TodayState {
    TodayState(
      pnl: pnl,
      openPositions: openPositions,
      currency: currency,
      privacyMode: privacyMode,
      dailyLossLimit: dailyLossLimit,
      maxRiskPerTrade: maxRiskPerTrade
    )
  }
}

extension WidgetFormat {
  /// "+$1.2K" — the Dynamic Island's compact slot has ~6 characters of room,
  /// so thousands collapse where the widgets would show the full figure.
  static func pnlCompact(_ value: Double, currency: String, masked: Bool) -> String {
    if masked { return "•••" }
    let magnitude = abs(value)
    guard magnitude >= 1000 else { return pnl(value, currency: currency, masked: false) }
    let formatter = NumberFormatter()
    formatter.numberStyle = .currency
    formatter.currencyCode = currency
    formatter.maximumFractionDigits = magnitude >= 100_000 ? 0 : 1
    formatter.minimumFractionDigits = 0
    let thousands = formatter.string(from: NSNumber(value: magnitude / 1000)) ?? "\(magnitude / 1000)"
    let sign = value < 0 ? "−" : "+"
    return "\(sign)\(thousands)K"
  }
}

// MARK: - Lock Screen

private struct LockScreenSessionView: View {
  let context: ActivityViewContext<TradingSessionAttributes>

  private var state: TodayState { context.state.todayState }

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      HStack(alignment: .firstTextBaseline) {
        Text("TraderMemos")
          .font(.system(size: 12, weight: .semibold))
          .foregroundStyle(WidgetTheme.mutedForeground)
        Spacer()
        if context.isStale {
          Text("Session ended")
            .font(.system(size: 12, weight: .medium))
            .foregroundStyle(WidgetTheme.mutedForeground)
        } else {
          Text("Session · \(context.attributes.startedAt, style: .time)")
            .font(.system(size: 12, weight: .medium))
            .foregroundStyle(WidgetTheme.mutedForeground)
        }
      }

      HStack(alignment: .firstTextBaseline) {
        Text(WidgetFormat.pnl(state.pnl, currency: state.currency, masked: state.privacyMode))
          .font(.system(size: 28, weight: .semibold, design: .rounded))
          .monospacedDigit()
          .foregroundStyle(WidgetTheme.pnl(state.pnl))
          .lineLimit(1)
          .minimumScaleFactor(0.6)
        Spacer()
        Text(String(localized: "\(context.state.tradesTaken) trades"))
          .font(.system(size: 13, weight: .medium))
          .monospacedDigit()
          .foregroundStyle(WidgetTheme.mutedForeground)
      }

      BudgetBar(state: state)
      PositionsAndRLine(state: state)
    }
    .padding(14)
    .opacity(context.isStale ? 0.6 : 1)
    .activityBackgroundTint(WidgetTheme.card)
    .activitySystemActionForegroundColor(WidgetTheme.foreground)
  }
}

// MARK: - Dynamic Island

private struct DirectionMark: View {
  let state: TodayState

  var body: some View {
    Image(systemName: state.pnl >= 0 ? "arrow.up.right" : "arrow.down.right")
      .font(.system(size: 14, weight: .bold))
      .foregroundStyle(WidgetTheme.pnl(state.pnl))
  }
}

struct TradingSessionLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: TradingSessionAttributes.self) { context in
      LockScreenSessionView(context: context)
    } dynamicIsland: { context in
      let state = context.state.todayState
      return DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          VStack(alignment: .leading, spacing: 2) {
            Text("TODAY")
              .font(.system(size: 10, weight: .semibold))
              .kerning(0.7)
              .foregroundStyle(WidgetTheme.mutedForeground)
            Text(WidgetFormat.pnl(state.pnl, currency: state.currency, masked: state.privacyMode))
              .font(.system(size: 22, weight: .semibold, design: .rounded))
              .monospacedDigit()
              .foregroundStyle(WidgetTheme.pnl(state.pnl))
              .lineLimit(1)
              .minimumScaleFactor(0.6)
          }
        }
        DynamicIslandExpandedRegion(.trailing) {
          VStack(alignment: .trailing, spacing: 2) {
            Text(String(localized: "\(context.state.tradesTaken) trades"))
              .font(.system(size: 12, weight: .medium))
              .monospacedDigit()
              .foregroundStyle(WidgetTheme.mutedForeground)
            Text(String(localized: "\(state.openPositions) open"))
              .font(.system(size: 12, weight: .medium))
              .monospacedDigit()
              .foregroundStyle(WidgetTheme.mutedForeground)
          }
        }
        DynamicIslandExpandedRegion(.bottom) {
          VStack(alignment: .leading, spacing: 4) {
            BudgetBar(state: state)
            PositionsAndRLine(state: state)
          }
        }
      } compactLeading: {
        DirectionMark(state: state)
      } compactTrailing: {
        Text(WidgetFormat.pnlCompact(state.pnl, currency: state.currency, masked: state.privacyMode))
          .font(.system(size: 13, weight: .semibold, design: .rounded))
          .monospacedDigit()
          .foregroundStyle(WidgetTheme.pnl(state.pnl))
      } minimal: {
        DirectionMark(state: state)
      }
      .keylineTint(WidgetTheme.primary)
    }
  }
}
