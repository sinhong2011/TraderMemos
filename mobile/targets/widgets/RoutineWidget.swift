import AppIntents
import SwiftUI
import WidgetKit

// Today's routine on the Home and Lock Screens. Unlike TodayWidget this one
// fetches: a tick made on the web shows up here without opening the app, and
// the checkbox rows write straight back (SetRoutineCheckIntent).

struct RoutineEntry: TimelineEntry {
  let date: Date
  /// nil = signed out, or offline with no snapshot for today.
  let routine: RoutineSnapshot?
}

struct RoutineProvider: TimelineProvider {
  func placeholder(in context: Context) -> RoutineEntry {
    RoutineEntry(date: .now, routine: .sample)
  }

  func getSnapshot(in context: Context, completion: @escaping (RoutineEntry) -> Void) {
    if context.isPreview {
      completion(RoutineEntry(date: .now, routine: .sample))
      return
    }
    completion(RoutineEntry(date: .now, routine: RoutineStore.cachedToday()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<RoutineEntry>) -> Void) {
    Task {
      let routine = await RoutineStore.fetchToday()
      let now = Date()
      // Re-ask the server every half hour (ticks made elsewhere), and always
      // at market midnight, when the routine becomes a new day's.
      let midnight = TMShared.nextDayStart(after: now)
      let next = min(now.addingTimeInterval(30 * 60), midnight)
      completion(Timeline(entries: [RoutineEntry(date: now, routine: routine)], policy: .after(next)))
    }
  }
}

// MARK: - Pieces

private let routineURL = URL(string: "tradermemos://daily-checklist")!

struct RoutineCheckRow: View {
  let day: String
  let item: RoutineSnapshot.Item
  var size: CGFloat = 13

  var body: some View {
    Button(intent: SetRoutineCheckIntent(day: day, itemID: item.id, done: !item.done)) {
      HStack(spacing: 7) {
        Image(systemName: item.done ? "checkmark.circle.fill" : "circle")
          .font(.system(size: size + 3, weight: .medium))
          .foregroundStyle(item.done ? WidgetTheme.primary : WidgetTheme.mutedForeground)
        Text(item.title)
          .font(.system(size: size, weight: .medium))
          .foregroundStyle(item.done ? WidgetTheme.mutedForeground : WidgetTheme.foreground)
          .strikethrough(item.done, color: WidgetTheme.mutedForeground)
          .lineLimit(1)
        Spacer(minLength: 0)
      }
      .contentShape(Rectangle())
    }
    .buttonStyle(.plain)
  }
}

struct RoutineProgressBar: View {
  let routine: RoutineSnapshot

  var body: some View {
    GeometryReader { geo in
      ZStack(alignment: .leading) {
        Capsule().fill(WidgetTheme.track)
        Capsule()
          .fill(routine.next == nil ? WidgetTheme.profit : WidgetTheme.primary)
          .frame(width: max(routine.done > 0 ? 4 : 0, geo.size.width * fraction))
      }
    }
    .frame(height: 5)
  }

  private var fraction: Double {
    routine.total == 0 ? 0 : Double(routine.done) / Double(routine.total)
  }
}

struct RoutineHeader: View {
  let routine: RoutineSnapshot

  var body: some View {
    HStack(alignment: .firstTextBaseline) {
      Text("ROUTINE")
        .font(.system(size: 10, weight: .semibold))
        .kerning(0.7)
        .foregroundStyle(WidgetTheme.mutedForeground)
      Spacer(minLength: 4)
      Text("\(routine.done)/\(routine.total)")
        .font(.system(size: 12, weight: .semibold, design: .rounded))
        .monospacedDigit()
        .foregroundStyle(routine.next == nil ? WidgetTheme.profit : WidgetTheme.foreground)
    }
  }
}

/// The rows that fit: open ones first so the next thing to do is never cut.
private func visibleRows(_ routine: RoutineSnapshot, limit: Int) -> [RoutineSnapshot.Item] {
  let open = routine.items.filter { !$0.done }
  let done = routine.items.filter(\.done)
  return Array((open + done).prefix(limit))
}

struct RoutineEmptyView: View {
  let text: LocalizedStringKey

  var body: some View {
    VStack(spacing: 4) {
      Image(systemName: "checklist")
        .font(.system(size: 20, weight: .medium))
        .foregroundStyle(WidgetTheme.mutedForeground)
      Text(text)
        .font(.system(size: 12, weight: .medium))
        .foregroundStyle(WidgetTheme.mutedForeground)
        .multilineTextAlignment(.center)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity)
  }
}

// MARK: - Families

struct RoutineHomeView: View {
  @Environment(\.widgetFamily) private var family
  let routine: RoutineSnapshot

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      RoutineHeader(routine: routine)
      RoutineProgressBar(routine: routine)
      if routine.next == nil {
        Spacer(minLength: 0)
        Label("All done", systemImage: "checkmark.seal.fill")
          .font(.system(size: 14, weight: .semibold))
          .foregroundStyle(WidgetTheme.profit)
        Spacer(minLength: 0)
      } else {
        VStack(alignment: .leading, spacing: family == .systemLarge ? 9 : 7) {
          ForEach(visibleRows(routine, limit: rowLimit)) { item in
            RoutineCheckRow(day: routine.day, item: item)
          }
        }
        Spacer(minLength: 0)
      }
    }
  }

  private var rowLimit: Int {
    switch family {
    case .systemLarge: return 10
    case .systemMedium: return 3
    default: return 3
    }
  }
}

struct RoutineRectangularView: View {
  let routine: RoutineSnapshot

  var body: some View {
    VStack(alignment: .leading, spacing: 2) {
      Text("Routine \(routine.done)/\(routine.total)")
        .font(.system(size: 13, weight: .semibold))
        .widgetAccentable()
      if let next = routine.next {
        Button(intent: SetRoutineCheckIntent(day: routine.day, itemID: next.id, done: true)) {
          Label(next.title, systemImage: "circle")
            .font(.system(size: 13, weight: .medium))
            .lineLimit(1)
        }
        .buttonStyle(.plain)
      } else {
        Text("All done").font(.system(size: 13, weight: .medium))
      }
      Gauge(value: Double(routine.done), in: 0...Double(max(routine.total, 1))) { EmptyView() }
        .gaugeStyle(.accessoryLinearCapacity)
    }
    .frame(maxWidth: .infinity, alignment: .leading)
  }
}

struct RoutineCircularView: View {
  let routine: RoutineSnapshot

  var body: some View {
    Gauge(value: Double(routine.done), in: 0...Double(max(routine.total, 1))) {
      Image(systemName: "checklist")
    } currentValueLabel: {
      Text("\(routine.done)/\(routine.total)")
        .font(.system(size: 12, weight: .semibold, design: .rounded))
        .monospacedDigit()
        .minimumScaleFactor(0.6)
    }
    .gaugeStyle(.accessoryCircularCapacity)
  }
}

struct RoutineWidgetView: View {
  @Environment(\.widgetFamily) private var family
  let entry: RoutineEntry

  var body: some View {
    Group {
      if let routine = entry.routine, routine.total > 0 {
        switch family {
        case .accessoryRectangular: RoutineRectangularView(routine: routine)
        case .accessoryCircular: RoutineCircularView(routine: routine)
        case .accessoryInline:
          Text(routine.next.map { "\(routine.done)/\(routine.total) · \($0.title)" } ?? "Routine done")
        default: RoutineHomeView(routine: routine)
        }
      } else {
        switch family {
        case .accessoryInline: Text(entry.routine == nil ? "Open TraderMemos" : "No routine today")
        case .accessoryCircular: Image(systemName: "checklist").font(.system(size: 16, weight: .medium))
        case .accessoryRectangular:
          Text(entry.routine == nil ? "Open TraderMemos" : "Nothing on today's routine")
            .font(.system(size: 13, weight: .medium))
        default:
          RoutineEmptyView(text: entry.routine == nil ? "Open TraderMemos" : "Nothing on today's routine")
        }
      }
    }
    .widgetURL(routineURL)
    .containerBackground(for: .widget) {
      WidgetTheme.card
    }
  }
}

struct RoutineWidget: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: TMShared.routineWidgetKind, provider: RoutineProvider()) { entry in
      RoutineWidgetView(entry: entry)
    }
    .configurationDisplayName("Daily Routine")
    .description("Tick off today's routine without opening the app.")
    .supportedFamilies([
      .systemSmall,
      .systemMedium,
      .systemLarge,
      .accessoryRectangular,
      .accessoryCircular,
      .accessoryInline,
    ])
  }
}
