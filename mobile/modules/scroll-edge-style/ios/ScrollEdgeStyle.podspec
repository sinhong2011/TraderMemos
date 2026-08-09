Pod::Spec.new do |s|
  s.name           = 'ScrollEdgeStyle'
  s.version        = '1.0.0'
  s.summary        = 'scrollEdgeEffectStyle SwiftUI modifier for @expo/ui'
  s.description    = 'Registers a scrollEdgeEffectStyle modifier in the @expo/ui ViewModifierRegistry so SwiftUI Form/List screens can control the iOS 26+ scroll edge effect.'
  s.author         = 'TraderMemos'
  s.homepage       = 'https://github.com/niskan516dev/TraderMemos'
  s.license        = 'MIT'
  s.platforms      = { :ios => '16.4' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.dependency 'ExpoUI'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES'
  }
  s.source_files = '**/*.{h,m,mm,swift}'
end
