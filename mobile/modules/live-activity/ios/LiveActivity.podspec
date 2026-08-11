Pod::Spec.new do |s|
  s.name           = 'LiveActivity'
  s.version        = '1.0.0'
  s.summary        = 'ActivityKit bridge for the TraderMemos trading-session Live Activity'
  s.description    = 'Starts, updates, and ends the Lock Screen / Dynamic Island trading session driven by the same snapshot data as the widgets.'
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
