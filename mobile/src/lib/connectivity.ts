/**
 * Server reachability — "is the API answering right now", which for a
 * self-hosted app is a different question from "does the phone have internet".
 * A user on full LTE is offline as far as TraderMemos is concerned the moment
 * they leave the LAN their server sits on, and NetInfo would happily report
 * five bars throughout. So there is no connectivity library here: the signal
 * comes from the requests the app is already making (`netFetch` in
 * `api/client.ts` reports both outcomes) plus a `/healthz` poll that runs only
 * while we believe the server is down.
 *
 * Deliberately *not* wired to TanStack's `onlineManager`. Marking the client
 * offline pauses mutations, so every Save button in the app would spin
 * forever instead of failing with something the user can read and retry.
 */

import { AppState } from 'react-native';
import { create } from 'zustand';

/** Probe backoff, in ms. The last value repeats for as long as we stay down. */
const PROBE_DELAYS = [2_000, 5_000, 10_000, 30_000] as const;

type ConnectivityState = {
  /** False from the first failed request until something answers again. */
  reachable: boolean;
  /** Server we could not reach — the banner names the host. */
  serverUrl: string | null;
  /**
   * Bumped on every unreachable → reachable transition. Screens don't watch
   * this; the root layout does, to refetch what went stale while we were down.
   */
  recoveredAt: number;
};

export const useConnectivityStore = create<ConnectivityState>(() => ({
  reachable: true,
  serverUrl: null,
  recoveredAt: 0,
}));

let probeTimer: ReturnType<typeof setTimeout> | null = null;
let probeAttempt = 0;

function stopProbe() {
  if (probeTimer != null) clearTimeout(probeTimer);
  probeTimer = null;
  probeAttempt = 0;
}

/**
 * Bare `fetch`, not the client's `netFetch`: the probe must not report its own
 * failures back into this module or a down server would re-arm itself forever.
 */
async function probeOnce(serverUrl: string): Promise<boolean> {
  try {
    const response = await fetch(new URL('/healthz', serverUrl).toString());
    return response.ok;
  } catch {
    return false;
  }
}

function scheduleProbe() {
  if (probeTimer != null) return;
  const delay = PROBE_DELAYS[Math.min(probeAttempt, PROBE_DELAYS.length - 1)];
  probeAttempt += 1;
  probeTimer = setTimeout(() => {
    probeTimer = null;
    const { reachable, serverUrl } = useConnectivityStore.getState();
    if (reachable || serverUrl == null) return stopProbe();
    void probeOnce(serverUrl).then((ok) => {
      if (ok) reportReachable();
      else scheduleProbe();
    });
  }, delay);
}

/**
 * A request failed to get any response. Idempotent — the first failure of a
 * burst (every query on a screen fails at once) starts the poll; the rest are
 * no-ops.
 */
export function reportUnreachable(serverUrl: string) {
  const state = useConnectivityStore.getState();
  if (!state.reachable && state.serverUrl === serverUrl) return;
  useConnectivityStore.setState({ reachable: false, serverUrl });
  stopProbe();
  scheduleProbe();
}

/** Something answered. Called on every response, so it must stay cheap. */
export function reportReachable() {
  if (useConnectivityStore.getState().reachable) return;
  stopProbe();
  useConnectivityStore.setState({ reachable: true, recoveredAt: Date.now() });
}

/**
 * Coming back from the background is the most likely moment for the server to
 * have become reachable again (rejoined wifi, VPN reconnected), and it is also
 * when the backoff is most likely to be sitting on its 30s step.
 */
AppState.addEventListener('change', (status) => {
  if (status !== 'active') return;
  const { reachable, serverUrl } = useConnectivityStore.getState();
  if (reachable || serverUrl == null) return;
  stopProbe();
  void probeOnce(serverUrl).then((ok) => {
    if (ok) reportReachable();
    else scheduleProbe();
  });
});

/** True while the app believes the server is unreachable. */
export function useServerUnreachable(): boolean {
  return useConnectivityStore((state) => !state.reachable);
}

/** Host of the server we're failing to reach — banner and error copy. */
export function useServerHost(): string | null {
  return useConnectivityStore((state) => {
    if (state.serverUrl == null) return null;
    try {
      return new URL(state.serverUrl).host;
    } catch {
      return state.serverUrl;
    }
  });
}
