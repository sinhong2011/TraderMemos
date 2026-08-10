import ExpoModulesCore
import ExpoUI
import SwiftUI

/**
 * Registers a `scrollEdgeEffectStyle` view modifier with @expo/ui.
 *
 * react-native-screens' `scrollEdgeEffects` screen prop configures the effect on
 * the *content scroll view*, which it locates by walking `subviews[0]` from the
 * screen view (RNSScrollViewFinder) at prop-update/attach time. A SwiftUI `Form`
 * hosted through `@expo/ui` keeps its `UIScrollView` deep inside a hosting view
 * that is neither first-child-reachable nor mounted yet at that moment, so the
 * prop silently never lands and iOS 26+'s default `hard` edge paints a slab and
 * hairline under the navigation bar. The only layer that can reach that scroll
 * view is SwiftUI itself — this modifier applies `.scrollEdgeEffectStyle` /
 * `.scrollEdgeEffectHidden` directly on the hosted view.
 */
public class ScrollEdgeStyleModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ScrollEdgeStyle")

    OnCreate {
      ViewModifierRegistry.register("scrollEdgeEffectStyle") { params, _, _ in
        ScrollEdgeEffectStyleModifier(
          style: params["style"] as? String ?? "automatic",
          edges: Self.edgeSet(from: params["edges"] as? [String])
        )
      }
    }

    OnDestroy {
      ViewModifierRegistry.unregister("scrollEdgeEffectStyle")
    }
  }

  static func edgeSet(from names: [String]?) -> Edge.Set {
    guard let names, !names.isEmpty else {
      return .top
    }
    var edges: Edge.Set = []
    for name in names {
      switch name {
      case "top": edges.insert(.top)
      case "bottom": edges.insert(.bottom)
      case "leading": edges.insert(.leading)
      case "trailing": edges.insert(.trailing)
      case "all": edges.insert(.all)
      default: break
      }
    }
    return edges
  }
}

struct ScrollEdgeEffectStyleModifier: ViewModifier {
  let style: String
  let edges: Edge.Set

  @ViewBuilder
  func body(content: Content) -> some View {
    if #available(iOS 26.0, *) {
      switch style {
      case "hidden":
        content.scrollEdgeEffectHidden(true, for: edges)
      case "hard":
        content.scrollEdgeEffectStyle(.hard, for: edges)
      case "soft":
        content.scrollEdgeEffectStyle(.soft, for: edges)
      default:
        content.scrollEdgeEffectStyle(.automatic, for: edges)
      }
    } else {
      content
    }
  }
}
