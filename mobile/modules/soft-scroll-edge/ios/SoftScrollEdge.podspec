Pod::Spec.new do |s|
  s.name           = 'SoftScrollEdge'
  s.version        = '1.0.0'
  s.summary        = 'Applies the iOS 26 soft scroll-edge effect to a specific scroll view'
  s.description    = "Screens whose first descendant chain doesn't reach the scrolling view (Reports: a floating switcher plus a pager) never get react-native-screens' scrollEdgeEffects applied. This module sets topEdgeEffect.style = .soft on the exact scroll view a screen nominates."
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
