/**
 * Last line of defence for render-time throws. Without it a bad shape from the
 * API — or a restored MMKV snapshot written by an older version — takes the
 * whole app to a white screen with no way back, since Expo Router's error
 * overlay only exists in development.
 *
 * Deliberately app-wide and deliberately dumb: it offers one action, "Try
 * again", which clears the captured error and re-renders the tree. That is
 * enough for the transient case; anything worse survives the reset and the
 * user sees the same screen again rather than a blank one.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';

import { ErrorState } from '@/components/error-state';

type Props = { children: ReactNode };
type State = { error: unknown };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // No crash reporter in the app yet; the console is what a dev build has.
    console.error('Unhandled render error', error, info.componentStack);
  }

  render() {
    if (this.state.error != null) {
      return <ErrorState error={this.state.error} onRetry={() => this.setState({ error: null })} />;
    }
    return this.props.children;
  }
}
