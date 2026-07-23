import { cn } from "../lib/cn";
import { SignalEditor } from "./SignalEditor";

/** Read-only rich note body via the same TipTap pipeline as SignalEditor. */
export function MarkdownBody({ markdown, className }: { markdown: string; className?: string }) {
  if (!markdown.trim()) {
    return <p className={cn("text-[13px] text-text-dim", className)}>No content</p>;
  }

  return (
    <SignalEditor
      value={markdown}
      readOnly
      showHints={false}
      minHeight={0}
      className={cn("bg-transparent hover:bg-transparent", className)}
      contentClassName="px-0 py-0"
    />
  );
}
