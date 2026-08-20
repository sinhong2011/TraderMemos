import ExpoModulesCore

/**
 * react-native-screens applies `scrollEdgeEffects` by walking a screen's
 * *first* descendant chain until it hits a `UIScrollView`
 * (`RNSScrollViewFinder`). On Reports that chain dead-ends in the floating
 * section switcher, and even past it the first scroll view is the pager's
 * *horizontal* queuing view — the vertical section lists never get the
 * effect, so content slides under the transparent header with no soft fade.
 *
 * This module lets a screen nominate the actual scrolling view: JS passes the
 * react tag of an `RCTScrollViewComponentView`, and the effect is set on the
 * `UIScrollView` inside it. No-op below iOS 26, where UIKit has no
 * scroll-edge effects at all.
 */
public class SoftScrollEdgeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SoftScrollEdge")

    AsyncFunction("applyTop") { (viewTag: Int) in
      guard let view = self.appContext?.findView(withTag: viewTag, ofType: UIView.self) else {
        return
      }
      guard let scrollView = Self.findScrollView(in: view) else { return }
      if #available(iOS 26.0, *) {
        scrollView.topEdgeEffect.style = .soft
      }
    }.runOnQueue(.main)
  }

  /// The tag lands on the RN component view; the UIScrollView is a subview.
  private static func findScrollView(in view: UIView) -> UIScrollView? {
    if let scrollView = view as? UIScrollView { return scrollView }
    for subview in view.subviews {
      if let found = findScrollView(in: subview) { return found }
    }
    return nil
  }
}
