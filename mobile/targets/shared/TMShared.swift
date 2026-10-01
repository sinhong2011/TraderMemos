import Foundation
import Security
import WidgetKit

// Shared between the app target (Siri / Shortcuts intents, compiled in by
// plugins/with-app-intents.js) and the widget extension (interactive widgets
// and Control Center controls, plugins/with-widgets.js). Both copies come from
// targets/shared/ at prebuild, so they cannot drift.
//
// Unlike the Today widget, these surfaces write: a tick from the Home Screen
// or Siri goes straight to the API, without the app. The app hands over its
// server URL and token pair through the shared keychain item below
// (modules/widget-bridge writes it — keep the service, account and JSON shape
// in lockstep); the API's refresh tokens are stateless JWTs, so this side can
// mint its own access tokens without signing the app out.

enum TMShared {
  /// The App Group both targets carry. It doubles as the keychain access
  /// group: iOS lets every app group act as one, so no extra entitlement.
  static let appGroup = "group.com.tradermemos.app"

  static var defaults: UserDefaults? { UserDefaults(suiteName: appGroup) }

  static let routineWidgetKind = "RoutineWidget"
  static let missedWidgetKind = "MissedTradesWidget"

  /// Today as the routine's day key: the device's local date, the same rule
  /// as the app's todayNoteDay().
  static func today(_ date: Date = .now) -> String {
    let formatter = DateFormatter()
    formatter.calendar = Calendar(identifier: .gregorian)
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.timeZone = .current
    formatter.dateFormat = "yyyy-MM-dd"
    return formatter.string(from: date)
  }

  /// Every surface that shows the routine or the misses, refreshed together.
  static func reloadSurfaces() {
    WidgetCenter.shared.reloadTimelines(ofKind: routineWidgetKind)
    WidgetCenter.shared.reloadTimelines(ofKind: missedWidgetKind)
    if #available(iOS 18.0, *) {
      ControlCenter.shared.reloadAllControls()
    }
  }
}

// MARK: - Credentials

struct SharedCredentials: Codable {
  let serverUrl: String
  var accessToken: String
  var refreshToken: String
}

enum SharedKeychain {
  static let service = "com.tradermemos.shared"
  static let account = "session.v1"

  private static var baseQuery: [String: Any] {
    [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: service,
      kSecAttrAccount as String: account,
      kSecAttrAccessGroup as String: TMShared.appGroup,
    ]
  }

  static func load() -> SharedCredentials? {
    var query = baseQuery
    query[kSecReturnData as String] = true
    query[kSecMatchLimit as String] = kSecMatchLimitOne
    var result: AnyObject?
    guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
          let data = result as? Data
    else { return nil }
    return try? JSONDecoder().decode(SharedCredentials.self, from: data)
  }

  static func save(_ credentials: SharedCredentials) {
    guard let data = try? JSONEncoder().encode(credentials) else { return }
    let update: [String: Any] = [kSecValueData as String: data]
    if SecItemUpdate(baseQuery as CFDictionary, update as CFDictionary) == errSecItemNotFound {
      var add = baseQuery
      add[kSecValueData as String] = data
      // Widgets and Siri run while the phone is locked; after-first-unlock is
      // the class that lets them read it then.
      add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
      SecItemAdd(add as CFDictionary, nil)
    }
  }

  static func clear() {
    SecItemDelete(baseQuery as CFDictionary)
  }
}

// MARK: - API

enum TMAPIError: Error, CustomLocalizedStringResourceConvertible {
  case signedOut
  case offline
  case server(String)

  var localizedStringResource: LocalizedStringResource {
    switch self {
    case .signedOut: return "Open TraderMemos and sign in first."
    case .offline: return "Couldn't reach your TraderMemos server."
    case .server(let message): return "\(message)"
    }
  }
}

struct TMAPI {
  private var credentials: SharedCredentials

  init() throws {
    guard let credentials = SharedKeychain.load() else { throw TMAPIError.signedOut }
    self.credentials = credentials
  }

  private static let session: URLSession = {
    let config = URLSessionConfiguration.ephemeral
    // A widget gets seconds, not minutes, to build its timeline.
    config.timeoutIntervalForRequest = 8
    config.timeoutIntervalForResource = 12
    return URLSession(configuration: config)
  }()

  private func url(_ path: String) throws -> URL {
    let base = credentials.serverUrl.hasSuffix("/")
      ? String(credentials.serverUrl.dropLast()) : credentials.serverUrl
    guard let url = URL(string: base + "/api/v1" + path) else { throw TMAPIError.offline }
    return url
  }

  /// One authenticated round trip; a 401 refreshes once and replays.
  mutating func send<T: Decodable>(
    _ method: String, _ path: String, body: [String: Any?]? = nil
  ) async throws -> T {
    var (data, status) = try await raw(method, path, body: body)
    if status == 401 {
      try await refresh()
      (data, status) = try await raw(method, path, body: body)
    }
    if status == 401 { throw TMAPIError.signedOut }
    guard (200..<300).contains(status) else {
      throw TMAPIError.server(Self.message(from: data) ?? "Request failed (\(status))")
    }
    return try JSONDecoder().decode(T.self, from: data)
  }

  private func raw(_ method: String, _ path: String, body: [String: Any?]?) async throws -> (Data, Int) {
    var request = URLRequest(url: try url(path))
    request.httpMethod = method
    request.setValue("Bearer \(credentials.accessToken)", forHTTPHeaderField: "Authorization")
    if let body {
      request.setValue("application/json", forHTTPHeaderField: "Content-Type")
      let json = body.mapValues { $0 ?? NSNull() }
      request.httpBody = try JSONSerialization.data(withJSONObject: json)
    }
    do {
      let (data, response) = try await Self.session.data(for: request)
      return (data, (response as? HTTPURLResponse)?.statusCode ?? 0)
    } catch {
      throw TMAPIError.offline
    }
  }

  private mutating func refresh() async throws {
    var request = URLRequest(url: try url("/auth/refresh"))
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    request.httpBody = try JSONSerialization.data(withJSONObject: ["refresh_token": credentials.refreshToken])
    let data: Data
    let status: Int
    do {
      let (body, response) = try await Self.session.data(for: request)
      data = body
      status = (response as? HTTPURLResponse)?.statusCode ?? 0
    } catch {
      throw TMAPIError.offline
    }
    if status == 401 || status == 403 {
      // The refresh token itself is dead (expired, or the password changed):
      // nothing here can recover it. The app writes a fresh pair on its next
      // sign-in.
      SharedKeychain.clear()
      throw TMAPIError.signedOut
    }
    struct Pair: Decodable {
      let access_token: String
      let refresh_token: String
    }
    guard (200..<300).contains(status), let pair = try? JSONDecoder().decode(Pair.self, from: data) else {
      throw TMAPIError.offline
    }
    credentials.accessToken = pair.access_token
    credentials.refreshToken = pair.refresh_token
    SharedKeychain.save(credentials)
  }

  private static func message(from data: Data) -> String? {
    struct Envelope: Decodable {
      struct Body: Decodable { let message: String? }
      let error: Body?
    }
    return (try? JSONDecoder().decode(Envelope.self, from: data))?.error?.message
  }
}

// MARK: - Routine

/// The routine day as the widgets keep it — written by the app
/// (src/lib/widget-routine.ts) and refreshed here after every fetch or tick.
struct RoutineSnapshot: Codable {
  struct Item: Codable, Identifiable {
    let id: String
    let title: String
    let stage: String
    var done: Bool
  }

  var schema: Int = 1
  let day: String
  var items: [Item]

  var done: Int { items.filter(\.done).count }
  var total: Int { items.count }
  var next: Item? { items.first { !$0.done } }

  static let sample = RoutineSnapshot(
    day: TMShared.today(),
    items: [
      Item(id: "1", title: "Confirm market bias", stage: "pre", done: true),
      Item(id: "2", title: "Check news events", stage: "pre", done: true),
      Item(id: "3", title: "Mark key S/R levels", stage: "pre", done: false),
      Item(id: "4", title: "Set stop loss targets", stage: "pre", done: false),
      Item(id: "5", title: "Review the session", stage: "post", done: false),
    ]
  )
}

/// A tick that couldn't reach the server. The app replays these through its
/// outbox when it next comes to the foreground; the widget retries them first
/// thing on its next fetch.
struct PendingCheck: Codable, Equatable {
  let day: String
  let id: String
  let done: Bool
}

enum RoutineStore {
  static let snapshotKey = "routineSnapshot.v1"
  static let pendingKey = "routinePendingChecks.v1"

  static func snapshot() -> RoutineSnapshot? {
    guard let data = TMShared.defaults?.data(forKey: snapshotKey) else { return nil }
    return try? JSONDecoder().decode(RoutineSnapshot.self, from: data)
  }

  static func save(_ snapshot: RoutineSnapshot) {
    guard let data = try? JSONEncoder().encode(snapshot) else { return }
    TMShared.defaults?.set(data, forKey: snapshotKey)
  }

  static func pending() -> [PendingCheck] {
    guard let data = TMShared.defaults?.data(forKey: pendingKey) else { return [] }
    return (try? JSONDecoder().decode([PendingCheck].self, from: data)) ?? []
  }

  private static func setPending(_ checks: [PendingCheck]) {
    if checks.isEmpty {
      TMShared.defaults?.removeObject(forKey: pendingKey)
    } else if let data = try? JSONEncoder().encode(checks) {
      TMShared.defaults?.set(data, forKey: pendingKey)
    }
  }

  /// Latest intent wins for one item on one day, as in the app's outbox.
  private static func queue(_ check: PendingCheck) {
    var checks = pending().filter { !($0.day == check.day && $0.id == check.id) }
    checks.append(check)
    setPending(checks)
  }

  /// Today's routine for display: the cached snapshot (only if it is today's)
  /// with queued ticks applied.
  static func cachedToday() -> RoutineSnapshot? {
    let today = TMShared.today()
    guard var snap = snapshot(), snap.day == today else { return nil }
    for check in pending() where check.day == today {
      if let index = snap.items.firstIndex(where: { $0.id == check.id }) {
        snap.items[index].done = check.done
      }
    }
    return snap
  }

  private struct DayDTO: Decodable {
    struct Item: Decodable {
      let id: String
      let title: String
      let stage: String
      let done: Bool
    }
    let day: String
    let items: [Item]
  }

  private static func snapshot(from dto: DayDTO) -> RoutineSnapshot {
    RoutineSnapshot(
      day: dto.day,
      items: dto.items.map { .init(id: $0.id, title: $0.title, stage: $0.stage, done: $0.done) }
    )
  }

  /// Today from the server — queued ticks flushed first so they aren't
  /// overwritten — falling back to the cache when the server can't be reached.
  static func fetchToday() async -> RoutineSnapshot? {
    let today = TMShared.today()
    guard var api = try? TMAPI() else { return nil }
    for check in pending() {
      do {
        let _: DayDTO = try await api.send(
          "PUT", "/routines/day/\(check.day)/items/\(check.id)", body: ["done": check.done])
        setPending(pending().filter { $0 != check })
      } catch TMAPIError.server {
        // Rejected outright (an item since removed): retrying can't help.
        setPending(pending().filter { $0 != check })
      } catch {
        return cachedToday()
      }
    }
    do {
      let dto: DayDTO = try await api.send("GET", "/routines/day/\(today)")
      let snap = snapshot(from: dto)
      save(snap)
      return snap
    } catch {
      return cachedToday()
    }
  }

  enum TickResult {
    case saved(RoutineSnapshot)
    /// Saved on this device only; it syncs when the app or widget next can.
    case queued(RoutineSnapshot?)
  }

  /// Ticks (or unticks) one item. The cached snapshot flips first so the
  /// widget redraws in the new state even before the round trip lands.
  static func setCheck(day: String, id: String, done: Bool) async throws -> TickResult {
    if var snap = snapshot(), snap.day == day,
       let index = snap.items.firstIndex(where: { $0.id == id }) {
      snap.items[index].done = done
      save(snap)
    }
    var api = try TMAPI()
    do {
      let dto: DayDTO = try await api.send(
        "PUT", "/routines/day/\(day)/items/\(id)", body: ["done": done])
      let snap = snapshot(from: dto)
      if day == TMShared.today() { save(snap) }
      return .saved(snap)
    } catch TMAPIError.offline {
      queue(PendingCheck(day: day, id: id, done: done))
      return .queued(cachedToday())
    }
  }
}

// MARK: - Missed trades

/// The all-time missed-trade summary the widget shows — the same headline as
/// the Missed trades screen.
struct MissedSnapshot: Codable {
  var schema: Int = 1
  let count: Int
  let scored: Int
  let net_r: Double
  /// Logged with no outcome yet.
  let unknown: Int

  static let sample = MissedSnapshot(count: 6, scored: 4, net_r: 4.33, unknown: 2)
}

enum MissedStore {
  static let snapshotKey = "missedSnapshot.v1"

  static func snapshot() -> MissedSnapshot? {
    guard let data = TMShared.defaults?.data(forKey: snapshotKey) else { return nil }
    return try? JSONDecoder().decode(MissedSnapshot.self, from: data)
  }

  static func save(_ snapshot: MissedSnapshot) {
    guard let data = try? JSONEncoder().encode(snapshot) else { return }
    TMShared.defaults?.set(data, forKey: snapshotKey)
  }

  private struct SummaryDTO: Decodable {
    let count: Int
    let scored: Int
    let net_r: Double
    let outcomes: [String: Int]
  }

  static func fetch() async -> MissedSnapshot? {
    guard var api = try? TMAPI() else { return snapshot() }
    do {
      let dto: SummaryDTO = try await api.send("GET", "/missed-trades/summary")
      let snap = MissedSnapshot(
        count: dto.count, scored: dto.scored, net_r: dto.net_r, unknown: dto.outcomes["unknown"] ?? 0)
      save(snap)
      return snap
    } catch {
      return snapshot()
    }
  }

  /// "+2.5R" / "-1R" / "0R" — the app's fmtR.
  static func fmtR(_ r: Double) -> String {
    let magnitude = abs(r)
    var digits = magnitude == magnitude.rounded() ? String(Int(magnitude)) : String(format: "%.2f", magnitude)
    if digits.contains("."), digits.hasSuffix("0") { digits.removeLast() }
    let sign = r > 0 ? "+" : r < 0 ? "-" : ""
    return "\(sign)\(digits)R"
  }
}
