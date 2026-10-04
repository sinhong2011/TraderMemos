import ExpoModulesCore
import Security
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

    // --- Routine & missed trades (src/lib/widget-routine.ts) ---------------
    //
    // These surfaces write back on their own (targets/shared/TMShared.swift),
    // so they get the session too. Keys, keychain service/account and JSON
    // shapes below are that file's contract.

    Function("setCredentials") { (serverUrl: String, accessToken: String, refreshToken: String) in
      let json: [String: String] = [
        "serverUrl": serverUrl, "accessToken": accessToken, "refreshToken": refreshToken,
      ]
      guard let data = try? JSONSerialization.data(withJSONObject: json) else { return }
      let update: [String: Any] = [kSecValueData as String: data]
      if SecItemUpdate(Self.keychainQuery as CFDictionary, update as CFDictionary) == errSecItemNotFound {
        var add = Self.keychainQuery
        add[kSecValueData as String] = data
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        SecItemAdd(add as CFDictionary, nil)
      }
    }

    /// Sign-out: credentials, both snapshots and any unsent widget ticks go.
    Function("clearRoutine") {
      SecItemDelete(Self.keychainQuery as CFDictionary)
      let defaults = UserDefaults(suiteName: Self.appGroup)
      for key in [Self.routineKey, Self.missedKey, Self.pendingKey] {
        defaults?.removeObject(forKey: key)
      }
      Self.reloadRoutineSurfaces()
    }

    Function("setRoutine") { (json: String) in
      UserDefaults(suiteName: Self.appGroup)?.set(Data(json.utf8), forKey: Self.routineKey)
      Self.reloadRoutineSurfaces()
      Self.refreshShortcutParameters(json)
    }

    Function("setMissed") { (json: String) in
      UserDefaults(suiteName: Self.appGroup)?.set(Data(json.utf8), forKey: Self.missedKey)
      WidgetCenter.shared.reloadTimelines(ofKind: "MissedTradesWidget")
    }

    /// The zone the routine's day is keyed by (the market timezone — the app's
    /// routineDay()). TMShared.today() reads it; a change re-keys the routine
    /// widget and controls at once rather than at their next timeline.
    Function("setMarketTimezone") { (timeZone: String) in
      guard let defaults = UserDefaults(suiteName: Self.appGroup),
            defaults.string(forKey: Self.marketTimezoneKey) != timeZone
      else { return }
      defaults.set(timeZone, forKey: Self.marketTimezoneKey)
      Self.reloadRoutineSurfaces()
    }

    /// Ticks made in a widget or by Siri that never reached the server, as a
    /// JSON array of {day, id, done}; handing them over removes them.
    Function("takePendingChecks") { () -> String in
      let defaults = UserDefaults(suiteName: Self.appGroup)
      guard let data = defaults?.data(forKey: Self.pendingKey) else { return "[]" }
      defaults?.removeObject(forKey: Self.pendingKey)
      return String(data: data, encoding: .utf8) ?? "[]"
    }
  }

  static let routineKey = "routineSnapshot.v1"
  static let missedKey = "missedSnapshot.v1"
  static let pendingKey = "routinePendingChecks.v1"
  static let marketTimezoneKey = "marketTimezone.v1"

  static let keychainQuery: [String: Any] = [
    kSecClass as String: kSecClassGenericPassword,
    kSecAttrService as String: "com.tradermemos.shared",
    kSecAttrAccount as String: "session.v1",
    // App groups double as keychain access groups.
    kSecAttrAccessGroup as String: appGroup,
  ]

  /// Siri's "Check off <item>" phrases match against the items it last
  /// fetched; re-fetch when the set of items (not their ticks) changes. The
  /// updater lives in the app target (targets/app-intents/AppShortcuts.swift),
  /// out of this pod's reach, so it is looked up by its Objective-C name.
  static func refreshShortcutParameters(_ json: String) {
    struct Snapshot: Decodable {
      struct Item: Decodable { let id: String; let title: String }
      let items: [Item]
    }
    guard let snapshot = try? JSONDecoder().decode(Snapshot.self, from: Data(json.utf8)),
          let updater = NSClassFromString("TMShortcutParameterUpdater") as? NSObject.Type
    else { return }
    let signature = snapshot.items.map { "\($0.id)=\($0.title)" }.joined(separator: "|")
    _ = updater.perform(NSSelectorFromString("update:"), with: signature)
  }

  static func reloadRoutineSurfaces() {
    WidgetCenter.shared.reloadTimelines(ofKind: "RoutineWidget")
    if #available(iOS 18.0, *) {
      ControlCenter.shared.reloadAllControls()
    }
  }
}
