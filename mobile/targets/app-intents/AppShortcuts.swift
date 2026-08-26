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

// MARK: - Cooldown

/// Reads the widget snapshot the app keeps in the App Group (see
/// `src/lib/widget-snapshot.ts` / `WidgetBridgeModule.snapshotKey`). The
/// intent runs without the app, so this is the only cooldown state it can
/// see — and it is exactly the state the widget shows.
private enum CooldownSnapshot {
  static let appGroup = "group.com.tradermemos.app"
  static let key = "todaySnapshot.v2"

  /// True while a cooldown locks trade entry: the timer running, or ended
  /// with the return gate unanswered (the app clears the field on release).
  static var isLocked: Bool {
    guard
      let defaults = UserDefaults(suiteName: appGroup),
      let json = defaults.string(forKey: key),
      let data = json.data(using: .utf8),
      let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    else { return false }
    return object["cooldownEndsAt"] is Double
  }
}

/// The building block for a "when my broker app opens" automation: returns
/// whether a cooldown is locking the trader, without opening the app, so the
/// Shortcut can branch on it.
struct IsCooldownActiveIntent: AppIntent {
  static let title: LocalizedStringResource = "Am I Cooling Down?"
  static let description = IntentDescription(
    "Returns whether a TraderMemos cooldown is locking trade entry right now. Use it in an automation that runs when your broker app opens."
  )
  static let openAppWhenRun = false

  func perform() async throws -> some IntentResult & ReturnsValue<Bool> {
    .result(value: CooldownSnapshot.isLocked)
  }
}

/// The other half of that automation: put the cooldown screen in front of
/// the broker app. Also a fine Action Button target on its own.
struct OpenCooldownIntent: AppIntent {
  static let title: LocalizedStringResource = "Open Cooldown"
  static let description = IntentDescription("Open the cooldown screen — the running timer, or start a new one.")
  static let openAppWhenRun = true

  @MainActor
  func perform() async throws -> some IntentResult {
    if let url = URL(string: "tradermemos://cooldown") {
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
      intent: OpenCooldownIntent(),
      phrases: [
        "Start a cooldown in \(.applicationName)",
        "Cool down in \(.applicationName)",
        "Open my cooldown in \(.applicationName)",
      ],
      shortTitle: "Cooldown",
      systemImageName: "wind"
    )
    AppShortcut(
      intent: IsCooldownActiveIntent(),
      phrases: [
        "Am I cooling down in \(.applicationName)",
      ],
      shortTitle: "Am I Cooling Down?",
      systemImageName: "timer"
    )
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
  }
}
