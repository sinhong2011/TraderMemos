import SwiftUI
import WidgetKit

@main
struct TraderMemosWidgets: WidgetBundle {
  var body: some Widget {
    TodayWidget()
    RoutineWidget()
    MissedTradesWidget()
    TradingSessionLiveActivity()
    if #available(iOS 18.0, *) {
      QuickJournalControl()
      NextRoutineItemControl()
      LogMissedTradeControl()
    }
  }
}
