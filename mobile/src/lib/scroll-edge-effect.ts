import { createModifier, type ModifierConfig } from '@expo/ui/swift-ui/modifiers';

export type ScrollEdgeEffectStyle = 'automatic' | 'soft' | 'hard' | 'hidden';
export type ScrollEdge = 'top' | 'bottom' | 'leading' | 'trailing' | 'all';

/**
 * iOS 26+ scroll edge effect for SwiftUI-hosted scrollables (`Form`, `List`).
 *
 * The `scrollEdgeEffects` screen prop can't reach these: react-native-screens
 * resolves it by walking `subviews[0]` from the screen view before the SwiftUI
 * hierarchy has mounted its `UIScrollView`, so on Form screens the prop
 * silently does nothing and the iOS 26+ `hard` default paints a slab plus
 * hairline under the navigation bar. This modifier is applied by SwiftUI on
 * the hosted view itself, past both problems. Registered natively in
 * `modules/scroll-edge-style`; no-op below iOS 26.
 */
export function scrollEdgeEffectStyle(
  style: ScrollEdgeEffectStyle,
  edges: ScrollEdge[] = ['top'],
): ModifierConfig {
  return createModifier('scrollEdgeEffectStyle', { style, edges });
}
