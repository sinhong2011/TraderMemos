import { Kbd, KbdGroup } from "./ui/kbd";

/**
 * Render a hotkey label as keycaps.
 *
 * Split chord labels like `G D` into adjacent caps; keep `⌘K` as one chip.
 * Shared by the command palette and the quick-add menu so the same binding
 * looks the same wherever it is advertised.
 */
export function ShortcutKeys({ children, className }: { children: string; className?: string }) {
  const parts = children.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return <Kbd className={className}>{children}</Kbd>;
  }
  return (
    <KbdGroup className={className ? `gap-0.5 ${className}` : "gap-0.5"}>
      {parts.map((part, i) => (
        <Kbd key={`${part}-${i}`}>{part}</Kbd>
      ))}
    </KbdGroup>
  );
}
