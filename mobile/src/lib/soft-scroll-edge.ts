import { requireOptionalNativeModule } from 'expo-modules-core';
import { useCallback } from 'react';
import { findNodeHandle, Platform } from 'react-native';

type SoftScrollEdge = {
  /** Resolves true once the scroll view was found and associated. */
  applyTop(viewTag: number): Promise<boolean>;
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

let lastTag: number | null = null;

/**
 * Nominate a ScrollView as the one the navigation bar observes: the iOS 26
 * soft top scroll-edge effect plus the native large-title collapse. Needed
 * wherever UIKit's and react-native-screens' own discovery cannot reach the
 * scrolling view — both walk the screen's first descendant chain, so a list
 * behind a floating bar or inside a pager (Reports) never drives the header.
 *
 * Screens with several scroll views (one per pager page) call this again
 * from their scroll handler — the bar then follows whichever list the user
 * actually drags. Repeat calls for the current nominee are deduped here.
 */
export function nominateSoftTopEdge(node: unknown): void {
  if (node == null) return;
  const mod = native();
  if (mod == null) return;
  // Ref instances vary by wrapper (Animated components hand back their own
  // shape) — findNodeHandle resolves them all; the cast just spans them.
  const tag = findNodeHandle(node as Parameters<typeof findNodeHandle>[0]);
  if (tag == null || tag === lastTag) return;
  void mod.applyTop(tag).then((applied) => {
    // Only a successful association counts as "current": a nomination that
    // ran before the pager attached this page must stay retryable, or the
    // scroll-time repeats would be deduped into never associating at all.
    if (applied) lastTag = tag;
  });
}

/**
 * `nominateSoftTopEdge` as a mount-time ref callback. Deferred a frame: the
 * ref fires while the pager page is still detaching/attaching, and the
 * native side needs the view to already sit under the screen's controller.
 */
export function useSoftTopEdge(): (node: unknown) => void {
  return useCallback((node: unknown) => {
    if (node == null) return;
    requestAnimationFrame(() => nominateSoftTopEdge(node));
  }, []);
}
