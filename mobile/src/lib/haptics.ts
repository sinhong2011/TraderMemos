/**
 * Haptics, guarded.
 *
 * `expo-haptics` is a native module, so a dev build compiled before it was
 * added has the JS package but not the binary and every call throws. Feedback
 * is a garnish — a missing Taptic Engine must never break a transport button —
 * so each call is wrapped and a first failure disables the module for the rest
 * of the session rather than throwing once per tap.
 */

import * as Haptics from 'expo-haptics';

let available = true;

function guard(run: () => Promise<unknown>) {
  if (!available) return;
  try {
    void run().catch(() => {
      available = false;
    });
  } catch {
    available = false;
  }
}

/** One bar advanced — the lightest tick the engine has. */
export function tick() {
  guard(() => Haptics.selectionAsync());
}

/** Transport state changed (play, pause, restart). */
export function tap() {
  guard(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

/** The replay reached the final bar, or crossed the stop/target. */
export function landmark() {
  guard(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid));
}

/**
 * An operation finished and is reporting its verdict — a connection test, a
 * save. The notification pattern is distinct from the impact ones: it means
 * "here is the answer", not "your touch registered".
 */
export function notify(outcome: 'success' | 'warning' | 'error') {
  guard(() =>
    Haptics.notificationAsync(
      outcome === 'success'
        ? Haptics.NotificationFeedbackType.Success
        : outcome === 'warning'
          ? Haptics.NotificationFeedbackType.Warning
          : Haptics.NotificationFeedbackType.Error,
    ),
  );
}
