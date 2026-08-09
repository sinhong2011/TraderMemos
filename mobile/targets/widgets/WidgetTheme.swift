import SwiftUI
import UIKit

/**
 * The app's semantic palette (src/styles/unistyles.ts light/dark), resolved
 * as dynamic colors so the widget follows the system scheme the way the app
 * does. Hex values are the same resolved tokens the RN theme carries — keep
 * in sync with unistyles.ts, which itself mirrors web/src/global.css.
 */
enum WidgetTheme {
  static let card = dynamic(light: 0xFFFFFF, dark: 0x1B1B1B)
  static let foreground = dynamic(light: 0x262626, dark: 0xF5F5F5)
  static let mutedForeground = dynamic(light: 0x686868, dark: 0x818181)
  static let track = Color(
    light: Color(white: 0, opacity: 0.08),
    dark: Color(white: 1, opacity: 0.08)
  )
  static let primary = Color(hex: 0x1264B2)
  static let profit = dynamic(light: 0x098926, dark: 0x54BF5C)
  static let loss = dynamic(light: 0xE7000B, dark: 0xFF6467)
  static let flat = dynamic(light: 0x737373, dark: 0xA1A1A1)
  /// Warning tone for a loss budget past 70% — dark theme's amber accent works
  /// on both grounds for a fill (it is a text color only in dark).
  static let warning = Color(hex: 0xF59E0B)

  static func pnl(_ value: Double) -> Color {
    if value > 0 { return profit }
    if value < 0 { return loss }
    return flat
  }

  private static func dynamic(light: UInt32, dark: UInt32) -> Color {
    Color(light: Color(hex: light), dark: Color(hex: dark))
  }
}

extension Color {
  init(hex: UInt32) {
    self.init(
      .sRGB,
      red: Double((hex >> 16) & 0xFF) / 255,
      green: Double((hex >> 8) & 0xFF) / 255,
      blue: Double(hex & 0xFF) / 255,
      opacity: 1
    )
  }

  init(light: Color, dark: Color) {
    self.init(uiColor: UIColor { traits in
      traits.userInterfaceStyle == .dark ? UIColor(dark) : UIColor(light)
    })
  }
}
