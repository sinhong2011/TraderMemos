/**
 * Host reachability plus first-user status, for the Sign in / Set up screens.
 *
 * `ping` (`/healthz`) only proves the process answers. A zero-user server is
 * up but not ready to sign in — that distinction is `GET /setup/status`.
 * A missing/old `/setup/status` (404, proxy HTML) degrades to plain
 * reachable so we never block sign-in on the new call.
 */

import { ping, setupStatus } from '@/api/client';

export type ProbeState = 'checking' | 'reachable' | 'needs_setup' | 'unreachable';

export type ServerProbe = {
  url: string;
  state: ProbeState;
  minPasswordLength: number;
};

/** Matches `auth.MinPasswordLen` when the status endpoint cannot be read. */
export const DEFAULT_MIN_PASSWORD_LENGTH = 10;

/**
 * @param onStatusError What to report when `/setup/status` itself fails
 *   (old server, proxy, 404). Login degrades to `reachable` so sign-in is
 *   never blocked. Setup degrades to `needs_setup` so a first-user is not
 *   bounced back to Sign in.
 */
export async function probeServer(
  url: string,
  onStatusError: 'reachable' | 'needs_setup' = 'reachable',
): Promise<Pick<ServerProbe, 'state' | 'minPasswordLength'>> {
  const reachable = await ping(url);
  if (!reachable) {
    return { state: 'unreachable', minPasswordLength: DEFAULT_MIN_PASSWORD_LENGTH };
  }
  try {
    const status = await setupStatus(url);
    return {
      state: status.needs_setup ? 'needs_setup' : 'reachable',
      minPasswordLength: status.min_password_length || DEFAULT_MIN_PASSWORD_LENGTH,
    };
  } catch {
    return { state: onStatusError, minPasswordLength: DEFAULT_MIN_PASSWORD_LENGTH };
  }
}
