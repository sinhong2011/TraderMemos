import AppIntents
import SwiftUI
import WidgetKit

// Control Center / Lock Screen / Action Button controls (iOS 18+) for the
// routine and the missed-trade log. Same shape as QuickJournalControl.

/// Shows the next open routine item and ticks it on press — no app.
@available(iOS 18.0, *)
struct NextRoutineItemControl: ControlWidget {
  static let kind = "com.tradermemos.app.widgets.nextroutineitem"

  var body: some ControlWidgetConfiguration {
    StaticControlConfiguration(kind: Self.kind, provider: Provider()) { value in
      ControlWidgetButton(action: CheckOffNextRoutineItemIntent()) {
        if let title = value.next {
          Label(title, systemImage: "circle")
        } else {
          Label(value.total > 0 ? "Routine done" : "Daily routine", systemImage: "checkmark.circle.fill")
        }
      }
    }
    .displayName("Next Routine Item")
    .description("Tick the next item on today's routine.")
  }

  struct Value {
    let next: String?
    let total: Int
  }

  struct Provider: ControlValueProvider {
    var previewValue: Value { Value(next: "Mark key S/R levels", total: 6) }

    func currentValue() async throws -> Value {
      let routine = await RoutineStore.fetchToday()
      return Value(next: routine?.next?.title, total: routine?.total ?? 0)
    }
  }
}

/// Opens the missed-trade form — the one entry that needs the app, since a
/// miss worth logging usually has a plan to type.
@available(iOS 18.0, *)
struct LogMissedTradeControl: ControlWidget {
  static let kind = "com.tradermemos.app.widgets.logmissedtrade"

  var body: some ControlWidgetConfiguration {
    StaticControlConfiguration(kind: Self.kind) {
      ControlWidgetButton(action: OpenMissedTradeFormIntent()) {
        Label("Log Missed Trade", systemImage: "binoculars")
      }
    }
    .displayName("Log Missed Trade")
    .description("Log a setup you saw and didn't take.")
  }
}

@available(iOS 18.0, *)
struct OpenMissedTradeFormIntent: AppIntent {
  static let title: LocalizedStringResource = "Log Missed Trade"
  static let openAppWhenRun = true
  static let isDiscoverable = false

  func perform() async throws -> some IntentResult & OpensIntent {
    .result(opensIntent: OpenURLIntent(URL(string: "tradermemos://missed-trade-form")!))
  }
}
