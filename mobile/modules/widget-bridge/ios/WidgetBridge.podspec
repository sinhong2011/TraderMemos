Pod::Spec.new do |s|
  s.name           = 'WidgetBridge'
  s.version        = '1.0.0'
  s.summary        = 'App Group snapshot writer for the TraderMemos WidgetKit extension'
  s.description    = 'Writes the dashboard snapshot (today P&L, open positions, loss budget) into the shared App Group and asks WidgetKit to reload timelines.'
  s.author         = 'TraderMemos'
  s.homepage       = 'https://github.com/niskan516dev/TraderMemos'
  s.license        = 'MIT'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES'
  }
  s.source_files = '**/*.{h,m,mm,swift}'
end
