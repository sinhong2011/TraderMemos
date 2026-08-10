import ExpoModulesCore
import WidgetKit

/**
 * The app side of the widget pipeline: the RN layer serializes a
 * `TodaySnapshot` (see `targets/widgets/TodaySnapshot.swift` and
 * `src/lib/widget-snapshot.ts` — the two must agree) and hands it here; this
 * module drops it into the shared App Group defaults and pokes WidgetKit.
 *
 * The widget extension never talks to the API. It renders whatever snapshot
 * the app last wrote — the same offline-first posture as the MMKV query
 * persister: stale numbers over no numbers, with day-rollover handled by the
 * widget comparing the snapshot's market-day key against its own clock.
 */
public class WidgetBridgeModule: Module {
  /// Must match the App Group the config plugin grants to both targets.
  static let appGroup = "group.com.tradermemos.app"
  /// Versioned so a future shape change can't feed old widgets garbage.
  static let snapshotKey = "todaySnapshot.v1"

  public func definition() -> ModuleDefinition {
    Name("WidgetBridge")

    Function("setSnapshot") { (json: String) in
      guard let defaults = UserDefaults(suiteName: Self.appGroup) else { return }
      defaults.set(json, forKey: Self.snapshotKey)
      WidgetCenter.shared.reloadAllTimelines()
    }

    // Sign-out: a Lock Screen widget must not keep showing P&L for a session
    // that no longer exists.
    Function("clearSnapshot") {
      guard let defaults = UserDefaults(suiteName: Self.appGroup) else { return }
      defaults.removeObject(forKey: Self.snapshotKey)
      WidgetCenter.shared.reloadAllTimelines()
    }
  }
}
