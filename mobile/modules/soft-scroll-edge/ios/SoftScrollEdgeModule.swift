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

    // Returns whether the association landed — a call made before the pager
    // page is attached finds no controller, and the JS side must know to
    // retry rather than dedupe the nomination away.
    AsyncFunction("applyTop") { (viewTag: Int) -> Bool in
      guard let view = self.appContext?.findView(withTag: viewTag, ofType: UIView.self),
            let scrollView = Self.findScrollView(in: view)
      else {
        return false
      }
      if #available(iOS 26.0, *) {
        scrollView.topEdgeEffect.style = .soft
      }
      // Tell the *navigation* bar to observe this scroll view. UIKit's own
      // discovery stops at the pager's horizontal queuing view, so without
      // this the large title never collapses and the bar never transitions.
      // The association must land on the view controller sitting directly in
      // the navigation controller (the RNS screen) — the pager's child view
      // controllers are what the responder chain hits first.
      var responder: UIResponder? = scrollView.next
      while let current = responder {
        if let controller = current as? UIViewController, controller.parent is UINavigationController {
          controller.setContentScrollView(scrollView, for: .top)
          return true
        }
        responder = current.next
      }
      return false
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
