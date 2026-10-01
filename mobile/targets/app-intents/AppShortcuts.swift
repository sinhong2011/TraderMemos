import AppIntents
import UIKit

// App Intents wrapper over the quick-journal flow (roadmap #135). These run in
// the app process (they are compiled into the app target by
// plugins/with-app-intents.js), so opening a deep link through UIApplication is
// the whole job — expo-router owns everything past the URL, including the
// cold-launch path (see patches/ios-scene/AppDelegate.swift).

struct JournalLastTradeIntent: AppIntent {
  static let title: LocalizedStringResource = "Journal Last Trade"
  static let description = IntentDescription("Review your most recent trade — notes, execution grade and mistakes.")
  static let openAppWhenRun = true

  @MainActor
  func perform() async throws -> some IntentResult {
    // No id: the quick-journal screen resolves the latest trade itself.
    if let url = URL(string: "tradermemos://quick-journal?latest=1") {
      await UIApplication.shared.open(url)
    }
    return .result()
  }
}

struct LogTradeIntent: AppIntent {
  static let title: LocalizedStringResource = "Log a Trade"
  static let description = IntentDescription("Open the new trade form.")
  static let openAppWhenRun = true

  @MainActor
  func perform() async throws -> some IntentResult {
    if let url = URL(string: "tradermemos://new-trade") {
      await UIApplication.shared.open(url)
    }
    return .result()
  }
}

// Zero-setup shortcuts: these surface in the Shortcuts app, Spotlight, Siri
// (by phrase) and the Action Button picker without the user building anything.
struct TraderMemosShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: JournalLastTradeIntent(),
      phrases: [
        "Journal my last trade in \(.applicationName)",
        "Review my last trade in \(.applicationName)",
        "Journal a trade in \(.applicationName)",
      ],
      shortTitle: "Journal Last Trade",
      systemImageName: "square.and.pencil"
    )
    AppShortcut(
      intent: LogTradeIntent(),
      phrases: [
        "Log a trade in \(.applicationName)",
        "Add a trade in \(.applicationName)",
      ],
      shortTitle: "Log a Trade",
      systemImageName: "plus.circle"
    )
    // Routine and missed-trade intents live in targets/shared/ (also compiled
    // into the widget extension) and run without opening the app.
    AppShortcut(
      intent: CheckOffRoutineItemIntent(),
      phrases: [
        "Check off \(\.$item) in \(.applicationName)",
        "Tick \(\.$item) in \(.applicationName)",
        "Check off a routine item in \(.applicationName)",
      ],
      shortTitle: "Check Off Routine Item",
      systemImageName: "checkmark.circle"
    )
    AppShortcut(
      intent: CheckOffNextRoutineItemIntent(),
      phrases: [
        "Check off my next routine item in \(.applicationName)",
        "Next routine item in \(.applicationName)",
      ],
      shortTitle: "Next Routine Item",
      systemImageName: "checklist.checked"
    )
    AppShortcut(
      intent: RoutineProgressIntent(),
      phrases: [
        "How's my routine in \(.applicationName)",
        "Routine progress in \(.applicationName)",
      ],
      shortTitle: "Routine Progress",
      systemImageName: "checklist"
    )
    AppShortcut(
      intent: LogMissedTradeIntent(),
      phrases: [
        "Log a missed trade in \(.applicationName)",
        "I missed a trade in \(.applicationName)",
      ],
      shortTitle: "Log Missed Trade",
      systemImageName: "binoculars"
    )
  }
}
