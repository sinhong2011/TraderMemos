import SwiftUI
import WidgetKit

@main
struct TraderMemosWidgets: WidgetBundle {
  var body: some Widget {
    TodayWidget()
    TradingSessionLiveActivity()
    if #available(iOS 18.0, *) {
      QuickJournalControl()
    }
  }
}
