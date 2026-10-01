import SwiftUI
import WidgetKit

// What passing on setups has cost (or saved) in R — the Missed trades
// screen's headline, on the Home and Lock Screens.

struct MissedEntry: TimelineEntry {
  let date: Date
  let summary: MissedSnapshot?
}

struct MissedProvider: TimelineProvider {
  func placeholder(in context: Context) -> MissedEntry {
    MissedEntry(date: .now, summary: .sample)
  }

  func getSnapshot(in context: Context, completion: @escaping (MissedEntry) -> Void) {
    completion(MissedEntry(date: .now, summary: context.isPreview ? .sample : MissedStore.snapshot()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<MissedEntry>) -> Void) {
    Task {
      let summary = await MissedStore.fetch()
      let next = Date().addingTimeInterval(60 * 60)
      completion(Timeline(entries: [MissedEntry(date: .now, summary: summary)], policy: .after(next)))
    }
  }
}

extension MissedSnapshot {
  var needsOutcome: String {
    unknown == 1 ? String(localized: "1 needs an outcome") : String(localized: "\(unknown) need an outcome")
  }
}

private let missedURL = URL(string: "tradermemos://missed-trades")!

struct MissedHomeView: View {
  let summary: MissedSnapshot

  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      Text("MISSED TRADES")
        .font(.system(size: 10, weight: .semibold))
        .kerning(0.7)
        .foregroundStyle(WidgetTheme.mutedForeground)
      Text(MissedStore.fmtR(summary.scored > 0 ? summary.net_r : 0))
        .font(.system(size: 28, weight: .semibold, design: .rounded))
        .monospacedDigit()
        .foregroundStyle(summary.scored > 0 ? WidgetTheme.pnl(summary.net_r) : WidgetTheme.mutedForeground)
        .lineLimit(1)
        .minimumScaleFactor(0.6)
      Text(summary.scored > 0 ? "would have made" : "no outcomes yet")
        .font(.system(size: 12, weight: .medium))
        .foregroundStyle(WidgetTheme.mutedForeground)
      Spacer(minLength: 0)
      Text("\(summary.count) logged")
        .font(.system(size: 12, weight: .medium))
        .foregroundStyle(WidgetTheme.foreground)
      if summary.unknown > 0 {
        Text(summary.needsOutcome)
          .font(.system(size: 12, weight: .medium))
          .foregroundStyle(WidgetTheme.warning)
          .lineLimit(1)
          .minimumScaleFactor(0.8)
      }
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

struct MissedRectangularView: View {
  let summary: MissedSnapshot

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      Text("Missed trades")
        .font(.system(size: 13, weight: .semibold))
        .widgetAccentable()
      Text(summary.scored > 0 ? "\(MissedStore.fmtR(summary.net_r)) would have made" : "No outcomes yet")
        .font(.system(size: 13, weight: .medium))
        .monospacedDigit()
      Text(summary.unknown > 0 ? summary.needsOutcome : "\(summary.count) logged")
        .font(.system(size: 12))
        .foregroundStyle(.secondary)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

struct MissedTradesWidgetView: View {
  @Environment(\.widgetFamily) private var family
  let entry: MissedEntry

  var body: some View {
    Group {
      if let summary = entry.summary, summary.count > 0 {
        switch family {
        case .accessoryRectangular: MissedRectangularView(summary: summary)
        default: MissedHomeView(summary: summary)
        }
      } else if family == .accessoryRectangular {
        Text(entry.summary == nil ? "Open TraderMemos" : "No missed trades logged")
          .font(.system(size: 13, weight: .medium))
      } else {
        VStack(spacing: 4) {
          Image(systemName: "binoculars")
            .font(.system(size: 20, weight: .medium))
            .foregroundStyle(WidgetTheme.mutedForeground)
          Text(entry.summary == nil ? "Open TraderMemos" : "No missed trades logged")
            .font(.system(size: 12, weight: .medium))
            .foregroundStyle(WidgetTheme.mutedForeground)
            .multilineTextAlignment(.center)
        }
      }
    }
    .widgetURL(missedURL)
    .containerBackground(for: .widget) {
      WidgetTheme.card
    }
  }
}

struct MissedTradesWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: TMShared.missedWidgetKind, provider: MissedProvider()) { entry in
      MissedTradesWidgetView(entry: entry)
    }
    .configurationDisplayName("Missed Trades")
    .description("What the setups you passed on would have made, in R.")
    .supportedFamilies([.systemSmall, .accessoryRectangular])
  }
}
