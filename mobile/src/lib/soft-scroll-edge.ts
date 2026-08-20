import { requireOptionalNativeModule } from 'expo-modules-core';
import { useCallback } from 'react';
import { findNodeHandle, Platform } from 'react-native';

type SoftScrollEdge = {
  applyTop(viewTag: number): Promise<void>;
};

let cached: SoftScrollEdge | null | undefined;
function native(): SoftScrollEdge | null {
  if (cached !== undefined) return cached;
  // Optional, not required: Android, iOS < 26, and dev builds made before the
  // module shipped must degrade to a no-op, not throw.
  cached =
    Platform.OS === 'ios' ? requireOptionalNativeModule<SoftScrollEdge>('SoftScrollEdge') : null;
  return cached;
}

/**
 * Ref callback nominating a ScrollView for the iOS 26 soft top scroll-edge
 * effect. Needed wherever react-native-screens' own `scrollEdgeEffects`
 * cannot reach the scrolling view — its finder walks only the screen's first
 * descendant chain, so a list behind a floating bar or inside a pager
 * (Reports) never gets the effect and content slides under the transparent
 * header with no fade.
 */
export function useSoftTopEdge(): (node: unknown) => void {
  return useCallback((node: unknown) => {
    if (node == null) return;
    const mod = native();
    if (mod == null) return;
    // Ref instances vary by wrapper (Animated components hand back their own
    // shape) — findNodeHandle resolves them all; the cast just spans them.
    const tag = findNodeHandle(node as Parameters<typeof findNodeHandle>[0]);
    if (tag != null) void mod.applyTop(tag);
  }, []);
}
