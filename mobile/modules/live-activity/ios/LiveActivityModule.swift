import ActivityKit
import ExpoModulesCore

/**
 * The app side of the trading-session Live Activity: `src/lib/live-activity.ts`
 * serializes a `SessionPayload` (attributes + content state + stale instant)
 * and this module drives ActivityKit with it. The UI lives in the widget
 * extension (`targets/widgets/TradingSessionLiveActivity.swift`).
 *
 * No push channel: the activity only moves while the app process runs, which
 * is the same posture as the widget snapshot — the `staleDate` at market
 * midnight is what keeps an abandoned Lock Screen honest.
 */
public class LiveActivityModule: Module {
  /// The JSON contract with `src/lib/live-activity.ts` — change in lockstep.
  /// Dates travel as epoch milliseconds: JS `toISOString()` carries fractional
  /// seconds that `JSONDecoder`'s .iso8601 strategy refuses to parse.
  private struct SessionPayload: Codable {
    let schema: Int
    let dayKey: String
    let marketTimezone: String
    /// Epoch ms after which the activity renders as stale (market midnight).
    let staleAt: Double?
    let state: TradingSessionAttributes.ContentState
  }

  private static func decode(_ json: String) -> SessionPayload? {
    guard let data = json.data(using: .utf8) else { return nil }
    return try? JSONDecoder().decode(SessionPayload.self, from: data)
  }

  private static func content(for payload: SessionPayload) -> ActivityContent<TradingSessionAttributes.ContentState> {
    let staleDate = payload.staleAt.map { Date(timeIntervalSince1970: $0 / 1000) }
    return ActivityContent(state: payload.state, staleDate: staleDate)
  }

  /// The JSON contract with `src/lib/cooldown-live-activity.ts`. Epoch ms
  /// for the dates, as above.
  private struct CooldownPayload: Codable {
    let schema: Int
    let sessionID: String
    let trigger: String
    let startedAt: Double
    let endsAt: Double
    let phase: String
  }

  private static func decodeCooldown(_ json: String) -> CooldownPayload? {
    guard let data = json.data(using: .utf8) else { return nil }
    return try? JSONDecoder().decode(CooldownPayload.self, from: data)
  }

  private static func cooldownContent(for payload: CooldownPayload) -> ActivityContent<CooldownAttributes.ContentState> {
    let endsAt = Date(timeIntervalSince1970: payload.endsAt / 1000)
    // Stale the moment the timer ends: the face flips to "answer the gate"
    // without the app having to be alive to say so.
    return ActivityContent(
      state: CooldownAttributes.ContentState(endsAt: endsAt, phase: payload.phase),
      staleDate: endsAt
    )
  }

  public func definition() -> ModuleDefinition {
    Name("LiveActivity")

    // False when the user switched Live Activities off for the app in
    // Settings — the menu item hides rather than failing on tap.
    Function("isSupported") { () -> Bool in
      ActivityAuthorizationInfo().areActivitiesEnabled
    }

    Function("isActive") { () -> Bool in
      !Activity<TradingSessionAttributes>.activities.isEmpty
    }

    Function("startSession") { (json: String) -> Bool in
      guard let payload = Self.decode(json) else { return false }
      // Never two sessions: a survivor from a killed process would otherwise
      // sit next to the new one on the Lock Screen forever.
      let orphans = Activity<TradingSessionAttributes>.activities
      if !orphans.isEmpty {
        Task {
          for activity in orphans {
            await activity.end(nil, dismissalPolicy: .immediate)
          }
        }
      }
      let attributes = TradingSessionAttributes(
        dayKey: payload.dayKey,
        marketTimezone: payload.marketTimezone,
        startedAt: Date()
      )
      do {
        _ = try Activity.request(attributes: attributes, content: Self.content(for: payload))
        return true
      } catch {
        return false
      }
    }

    Function("updateSession") { (json: String) in
      guard let payload = Self.decode(json) else { return }
      let content = Self.content(for: payload)
      Task {
        for activity in Activity<TradingSessionAttributes>.activities {
          await activity.update(content)
        }
      }
    }

    // Explicit stop, sign-out, and the market-day rollover all remove the
    // session outright — a dead session must not linger dimmed for hours.
    Function("endSession") {
      Task {
        for activity in Activity<TradingSessionAttributes>.activities {
          await activity.end(nil, dismissalPolicy: .immediate)
        }
      }
    }

    // MARK: Cooldown

    /// The server session id the live cooldown belongs to, or nil.
    Function("activeCooldownID") { () -> String? in
      Activity<CooldownAttributes>.activities.first?.attributes.sessionID
    }

    Function("startCooldown") { (json: String) -> Bool in
      guard let payload = Self.decodeCooldown(json) else { return false }
      let orphans = Activity<CooldownAttributes>.activities
      if !orphans.isEmpty {
        Task {
          for activity in orphans {
            await activity.end(nil, dismissalPolicy: .immediate)
          }
        }
      }
      let attributes = CooldownAttributes(
        sessionID: payload.sessionID,
        trigger: payload.trigger,
        startedAt: Date(timeIntervalSince1970: payload.startedAt / 1000)
      )
      do {
        _ = try Activity.request(attributes: attributes, content: Self.cooldownContent(for: payload))
        return true
      } catch {
        return false
      }
    }

    Function("updateCooldown") { (json: String) in
      guard let payload = Self.decodeCooldown(json) else { return }
      let content = Self.cooldownContent(for: payload)
      Task {
        for activity in Activity<CooldownAttributes>.activities {
          await activity.update(content)
        }
      }
    }

    // Release (or sign-out) takes the countdown off the Lock Screen at once.
    Function("endCooldown") {
      Task {
        for activity in Activity<CooldownAttributes>.activities {
          await activity.end(nil, dismissalPolicy: .immediate)
        }
      }
    }
  }
}
