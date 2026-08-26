import ActivityKit
import SwiftUI
import WidgetKit

/**
 * The Lock Screen / Dynamic Island face of a cooldown. The system runs the
 * countdown (`Text(timerInterval:)`), and the activity goes stale at
 * `endsAt`, so the copy flips to "answer the return gate" even if the app
 * has been killed — the lock lives on the server, and this face only has to
 * stay honest about it.
 */

private enum CooldownCopy {
  static func trigger(_ key: String) -> String {
    switch key {
    case "loss_streak": return String(localized: "Loss streak limit hit")
    case "daily_loss": return String(localized: "Daily loss limit hit")
    case "trade_limit": return String(localized: "Trade cap hit")
    default: return String(localized: "You stepped away")
    }
  }
}

private struct CooldownTimer: View {
  let context: ActivityViewContext<CooldownAttributes>
  var size: CGFloat = 28

  var body: some View {
    if context.isStale || context.state.phase == "gate" {
      Text("Done")
        .font(.system(size: size, weight: .semibold, design: .rounded))
        .foregroundStyle(WidgetTheme.foreground)
    } else {
      Text(timerInterval: context.attributes.startedAt...context.state.endsAt, countsDown: true)
        .font(.system(size: size, weight: .semibold, design: .rounded))
        .monospacedDigit()
        .foregroundStyle(WidgetTheme.foreground)
    }
  }
}

private struct LockScreenCooldownView: View {
  let context: ActivityViewContext<CooldownAttributes>

  private var over: Bool { context.isStale || context.state.phase == "gate" }

  var body: some View {
    HStack(spacing: 14) {
      Image(systemName: "wind")
        .font(.system(size: 26, weight: .medium))
        .foregroundStyle(WidgetTheme.primary)
      VStack(alignment: .leading, spacing: 3) {
        Text(over ? "Cooldown over" : "Cooling down")
          .font(.system(size: 12, weight: .semibold))
          .foregroundStyle(WidgetTheme.mutedForeground)
        Text(over ? "Answer the return gate before trading." : CooldownCopy.trigger(context.attributes.trigger))
          .font(.system(size: 14, weight: .medium))
          .foregroundStyle(WidgetTheme.foreground)
          .lineLimit(2)
      }
      Spacer()
      CooldownTimer(context: context)
        .frame(minWidth: 72, alignment: .trailing)
    }
    .padding(14)
    .activityBackgroundTint(WidgetTheme.card)
    .activitySystemActionForegroundColor(WidgetTheme.foreground)
  }
}

struct CooldownLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: CooldownAttributes.self) { context in
      LockScreenCooldownView(context: context)
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          HStack(spacing: 8) {
            Image(systemName: "wind")
              .font(.system(size: 18, weight: .medium))
              .foregroundStyle(WidgetTheme.primary)
            VStack(alignment: .leading, spacing: 2) {
              Text("COOLDOWN")
                .font(.system(size: 10, weight: .semibold))
                .kerning(0.7)
                .foregroundStyle(WidgetTheme.mutedForeground)
              Text(CooldownCopy.trigger(context.attributes.trigger))
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(WidgetTheme.foreground)
                .lineLimit(1)
            }
          }
        }
        DynamicIslandExpandedRegion(.trailing) {
          CooldownTimer(context: context, size: 22)
        }
        DynamicIslandExpandedRegion(.bottom) {
          Text(context.isStale || context.state.phase == "gate"
               ? "Open TraderMemos to answer the return gate."
               : "The trade form stays locked until the gate is answered.")
            .font(.system(size: 12, weight: .medium))
            .foregroundStyle(WidgetTheme.mutedForeground)
        }
      } compactLeading: {
        Image(systemName: "wind")
          .font(.system(size: 14, weight: .bold))
          .foregroundStyle(WidgetTheme.primary)
      } compactTrailing: {
        CooldownTimer(context: context, size: 13)
          .frame(maxWidth: 52)
      } minimal: {
        Image(systemName: "wind")
          .font(.system(size: 14, weight: .bold))
          .foregroundStyle(WidgetTheme.primary)
      }
      .keylineTint(WidgetTheme.primary)
    }
  }
}
