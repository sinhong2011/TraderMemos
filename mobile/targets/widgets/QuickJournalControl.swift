import AppIntents
import SwiftUI
import WidgetKit

// Control Center / Lock Screen / Action Button control (iOS 18+) bound to the
// quick-journal flow. Runs in the widget extension, so it cannot touch
// UIApplication — the OpensIntent result hands the URL to the system, which
// foregrounds the app and delivers it as a normal deep link.

@available(iOS 18.0, *)
struct QuickJournalControl: ControlWidget {
  static let kind = "com.tradermemos.app.widgets.quickjournal"

  var body: some ControlWidgetConfiguration {
    StaticControlConfiguration(kind: Self.kind) {
      ControlWidgetButton(action: OpenQuickJournalIntent()) {
        Label("Journal Last Trade", systemImage: "square.and.pencil")
      }
    }
    .displayName("Journal Last Trade")
    .description("Review your most recent trade.")
  }
}

@available(iOS 18.0, *)
struct OpenQuickJournalIntent: AppIntent {
  static let title: LocalizedStringResource = "Journal Last Trade"
  static let openAppWhenRun = true

  func perform() async throws -> some IntentResult & OpensIntent {
    .result(opensIntent: OpenURLIntent(URL(string: "tradermemos://quick-journal?latest=1")!))
  }
}
