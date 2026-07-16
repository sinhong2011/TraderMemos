import { type ComponentType } from "react";
import { usePrivacyMode } from "./displayPrefs";

/**
 * Subscribe to privacy mode inside a component that renders `fmtMoney*`.
 * Prefer calling `usePrivacyMode()` directly in money-displaying components —
 * React Compiler memoizes children, so a parent-only subscription will not remask.
 * This HOC is for route/page wrappers that format money in the same component body.
 */
export function privacyAware<P extends object>(Component: ComponentType<P>): ComponentType<P> {
  function PrivacyAwareRoute(props: P) {
    const privacyMode = usePrivacyMode();
    // Changing prop busts React Compiler memo on the wrapped component.
    const Comp = Component as ComponentType<P & { __privacyMode?: boolean }>;
    return <Comp {...props} __privacyMode={privacyMode} />;
  }
  PrivacyAwareRoute.displayName = `PrivacyAware(${Component.displayName ?? Component.name ?? "Route"})`;
  return PrivacyAwareRoute;
}
