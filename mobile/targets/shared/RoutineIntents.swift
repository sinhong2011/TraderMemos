import AppIntents
import Foundation

// Routine and missed-trade intents. Compiled into both targets (see
// TMShared.swift): the app target's copies back Siri, Shortcuts and Spotlight
// (TraderMemosShortcuts), the widget extension's back the interactive widget
// buttons and the Control Center controls. None of them open the app — they
// talk to the API directly, and the surfaces redraw from the result.

// MARK: - Routine items

struct RoutineItemEntity: AppEntity, Identifiable {
  static let typeDisplayRepresentation: TypeDisplayRepresentation = "Routine Item"
  static let defaultQuery = RoutineItemQuery()

  let id: String
  let title: String
  let stage: String
  let done: Bool

  var displayRepresentation: DisplayRepresentation {
    DisplayRepresentation(
      title: "\(title)",
      subtitle: done ? "Done" : "\(RoutineStage.label(stage))",
      image: .init(systemName: done ? "checkmark.circle.fill" : "circle")
    )
  }

  init(_ item: RoutineSnapshot.Item) {
    id = item.id
    title = item.title
    stage = item.stage
    done = item.done
  }
}

enum RoutineStage {
  static func label(_ stage: String) -> LocalizedStringResource {
    switch stage {
    case "during": return "During trading"
    case "post": return "After trading"
    default: return "Before trading"
    }
  }
}

/// Today's items, open ones first. Siri matches a spoken title against them.
struct RoutineItemQuery: EntityStringQuery {
  private func today() async -> [RoutineItemEntity] {
    let snap = await RoutineStore.fetchToday()
    let items = (snap?.items ?? []).map(RoutineItemEntity.init)
    return items.filter { !$0.done } + items.filter(\.done)
  }

  func entities(for identifiers: [String]) async throws -> [RoutineItemEntity] {
    let wanted = Set(identifiers)
    return await today().filter { wanted.contains($0.id) }
  }

  func entities(matching string: String) async throws -> [RoutineItemEntity] {
    let needle = string.lowercased()
    return await today().filter { $0.title.lowercased().contains(needle) }
  }

  func suggestedEntities() async throws -> [RoutineItemEntity] {
    await today()
  }
}

private func progressLine(_ snap: RoutineSnapshot?) -> String {
  guard let snap, snap.total > 0 else {
    return String(localized: "Nothing on today's routine.")
  }
  if let next = snap.next {
    return String(localized: "\(snap.done) of \(snap.total) done. Next up: \(next.title).")
  }
  return String(localized: "All \(snap.total) done for today.")
}

private func tickDialog(_ title: String, done: Bool, result: RoutineStore.TickResult) -> IntentDialog {
  let head = done
    ? String(localized: "Checked off \(title).")
    : String(localized: "Unchecked \(title).")
  switch result {
  case .saved(let snap):
    return IntentDialog("\(head) \(progressLine(snap))")
  case .queued:
    return IntentDialog(
      "\(head) \(String(localized: "Saved on this iPhone; it syncs when your server is reachable."))")
  }
}

/// Siri / Shortcuts: "Check off Mark key levels in TraderMemos".
struct CheckOffRoutineItemIntent: AppIntent {
  static let title: LocalizedStringResource = "Check Off Routine Item"
  static let description = IntentDescription("Tick an item on today's routine.")

  @Parameter(title: "Item")
  var item: RoutineItemEntity

  @Parameter(title: "Done", default: true)
  var done: Bool

  static var parameterSummary: some ParameterSummary {
    When(\.$done, .equalTo, true) {
      Summary("Check off \(\.$item)") { \.$done }
    } otherwise: {
      Summary("Uncheck \(\.$item)") { \.$done }
    }
  }

  func perform() async throws -> some IntentResult & ProvidesDialog {
    let result = try await RoutineStore.setCheck(day: TMShared.today(), id: item.id, done: done)
    TMShared.reloadSurfaces()
    return .result(dialog: tickDialog(item.title, done: done, result: result))
  }
}

/// Ticks the first open item — the Control Center button and "next item" Siri
/// phrase. Nothing to tick is an answer, not an error.
struct CheckOffNextRoutineItemIntent: AppIntent {
  static let title: LocalizedStringResource = "Check Off Next Routine Item"
  static let description = IntentDescription("Tick the next open item on today's routine.")

  func perform() async throws -> some IntentResult & ProvidesDialog {
    guard let snap = await RoutineStore.fetchToday() else { throw TMAPIError.signedOut }
    guard let next = snap.next else {
      return .result(dialog: IntentDialog(stringLiteral: progressLine(snap)))
    }
    let result = try await RoutineStore.setCheck(day: snap.day, id: next.id, done: true)
    TMShared.reloadSurfaces()
    return .result(dialog: tickDialog(next.title, done: true, result: result))
  }
}

/// "How's my routine in TraderMemos" — spoken progress, no app.
struct RoutineProgressIntent: AppIntent {
  static let title: LocalizedStringResource = "Routine Progress"
  static let description = IntentDescription("How much of today's routine is done, and what's next.")

  func perform() async throws -> some IntentResult & ReturnsValue<Int> & ProvidesDialog {
    guard let snap = await RoutineStore.fetchToday() else { throw TMAPIError.signedOut }
    return .result(value: snap.done, dialog: IntentDialog(stringLiteral: progressLine(snap)))
  }
}

/// The widget rows' checkbox. Plain values rather than an entity: the widget
/// already has the row, and a Button(intent:) is built from literals.
struct SetRoutineCheckIntent: AppIntent {
  static let title: LocalizedStringResource = "Set Routine Check"
  static let isDiscoverable = false

  @Parameter(title: "Day") var day: String
  @Parameter(title: "Item") var itemID: String
  @Parameter(title: "Done") var done: Bool

  init() {}

  init(day: String, itemID: String, done: Bool) {
    self.day = day
    self.itemID = itemID
    self.done = done
  }

  func perform() async throws -> some IntentResult {
    _ = try await RoutineStore.setCheck(day: day, id: itemID, done: done)
    TMShared.reloadSurfaces()
    return .result()
  }
}

// MARK: - Missed trades

enum MissedDirection: String, AppEnum {
  case long
  case short

  static let typeDisplayRepresentation: TypeDisplayRepresentation = "Side"
  static let caseDisplayRepresentations: [MissedDirection: DisplayRepresentation] = [
    .long: "Long",
    .short: "Short",
  ]
}

enum MissedReason: String, AppEnum {
  case hesitated
  case away
  case rules
  case other

  static let typeDisplayRepresentation: TypeDisplayRepresentation = "Reason"
  static let caseDisplayRepresentations: [MissedReason: DisplayRepresentation] = [
    .hesitated: "Hesitated",
    .away: "Away from screen",
    .rules: "Outside my rules",
    .other: "Other",
  ]
}

/// "Log a missed trade in TraderMemos" — Siri asks for the symbol and side;
/// the plan and reason are optional, as in the app's form.
struct LogMissedTradeIntent: AppIntent {
  static let title: LocalizedStringResource = "Log Missed Trade"
  static let description = IntentDescription(
    "Log a setup you saw and didn't take. It stays out of your trade stats.")

  // Tickers, not words: autocorrect turned "nvda" into a contact name in QA.
  @Parameter(
    title: "Symbol",
    inputOptions: String.IntentInputOptions(
      keyboardType: .asciiCapable,
      capitalizationType: .allCharacters,
      autocorrect: false,
      smartQuotes: false,
      smartDashes: false
    ),
    requestValueDialog: "Which symbol?"
  )
  var symbol: String

  @Parameter(title: "Side", requestValueDialog: "Long or short?")
  var direction: MissedDirection

  @Parameter(title: "Reason")
  var reason: MissedReason?

  @Parameter(title: "Entry") var entry: Double?
  @Parameter(title: "Stop") var stop: Double?
  @Parameter(title: "Target") var target: Double?

  static var parameterSummary: some ParameterSummary {
    Summary("Log missed \(\.$direction) on \(\.$symbol)") {
      \.$reason
      \.$entry
      \.$stop
      \.$target
    }
  }

  func perform() async throws -> some IntentResult & ProvidesDialog {
    let ticker = symbol.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
    guard !ticker.isEmpty else {
      throw $symbol.needsValueError("Which symbol?")
    }
    var api = try TMAPI()
    struct Created: Decodable { let id: String }
    let _: Created = try await api.send(
      "POST", "/missed-trades",
      body: [
        "symbol": ticker,
        "direction": direction.rawValue,
        "observed_at": ISO8601DateFormatter().string(from: .now),
        "reason": reason?.rawValue ?? "",
        "outcome": "unknown",
        "entry": entry,
        "stop": stop,
        "target": target,
        "notes": "",
      ])
    _ = await MissedStore.fetch()
    TMShared.reloadSurfaces()
    let side = direction == .long ? String(localized: "long") : String(localized: "short")
    return .result(dialog: "Logged \(ticker) \(side) as a missed trade.")
  }
}
