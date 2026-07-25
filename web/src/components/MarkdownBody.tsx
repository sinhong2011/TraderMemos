import { cn } from "@/lib/cn";
import { RichTextEditor } from "./RichTextEditor";

/** Read-only rich note body via the same TipTap pipeline as RichTextEditor. */
export function MarkdownBody({ markdown, className }: { markdown: string; className?: string }) {
  if (!markdown.trim()) {
    return <p className={cn("text-[13px] text-muted-foreground", className)}>No content</p>;
  }

  return (
    <RichTextEditor
      value={markdown}
      readOnly
      showHints={false}
      minHeight={0}
      className={cn("bg-transparent hover:bg-transparent", className)}
      contentClassName="px-0 py-0"
    />
  );
}
