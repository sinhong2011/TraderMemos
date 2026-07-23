import { EditorContent, useEditor } from "@tiptap/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { FormatToolbar } from "./editor/FormatToolbar";
import {
  createSignalEditorExtensions,
  getEditorMarkdown,
  insertImageFromFile,
} from "./editor/tiptapExtensions";
import { Kbd } from "./ui/kbd";
import "./editor/signal-editor.css";

export interface SignalEditorProps {
  /** Markdown source of truth. Remount via `key` when swapping documents. */
  value?: string;
  onChange?: (markdown: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  id?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  className?: string;
  contentClassName?: string;
  minHeight?: number;
  autoFocus?: boolean;
  readOnly?: boolean;
  showHints?: boolean;
}

export function SignalEditor({
  value = "",
  onChange,
  onBlur,
  placeholder = "Write…",
  id,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
  className,
  contentClassName,
  minHeight = 180,
  autoFocus = false,
  readOnly = false,
  showHints = !readOnly,
}: SignalEditorProps) {
  const [uploadError, setUploadError] = useState<string | null>(null);
  const editorRef = useRef<ReturnType<typeof useEditor>>(null);

  const editor = useEditor({
    immediatelyRender: false,
    editable: !readOnly,
    extensions: createSignalEditorExtensions(placeholder),
    content: value,
    autofocus: autoFocus && !readOnly ? "end" : false,
    editorProps: {
      attributes: {
        id: id ?? "",
        "aria-label": ariaLabel ?? "Editor",
        ...(ariaInvalid ? { "aria-invalid": "true" } : {}),
        class: cn(
          "se-content prose-signal px-3 py-2.5 text-[13px] leading-relaxed text-text outline-none",
          contentClassName,
        ),
        style: `min-height: ${minHeight}px`,
      },
      handlePaste: (_view, event) => {
        if (readOnly) return false;
        const items = event.clipboardData?.items;
        if (!items) return false;
        const files: File[] = [];
        for (const item of items) {
          if (item.type.startsWith("image/")) {
            const file = item.getAsFile();
            if (file) files.push(file);
          }
        }
        if (files.length === 0) return false;
        event.preventDefault();
        const ed = editorRef.current;
        if (!ed) return true;
        void (async () => {
          for (const file of files) {
            try {
              await insertImageFromFile(ed, file);
              setUploadError(null);
            } catch (e) {
              setUploadError(e instanceof Error ? e.message : "Could not paste image");
            }
          }
        })();
        return true;
      },
      handleDrop: (_view, event) => {
        if (readOnly) return false;
        const files = [...(event.dataTransfer?.files ?? [])].filter((f) =>
          f.type.startsWith("image/"),
        );
        if (files.length === 0) return false;
        event.preventDefault();
        const ed = editorRef.current;
        if (!ed) return true;
        void (async () => {
          for (const file of files) {
            try {
              await insertImageFromFile(ed, file);
              setUploadError(null);
            } catch (e) {
              setUploadError(e instanceof Error ? e.message : "Could not drop image");
            }
          }
        })();
        return true;
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange?.(getEditorMarkdown(ed));
    },
    onBlur: () => {
      onBlur?.();
    },
  });

  editorRef.current = editor;

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!readOnly);
  }, [editor, readOnly]);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-control border border-border bg-bg-input transition-colors duration-150",
        !readOnly &&
          "hover:bg-bg-input-hover focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-border-strong",
        readOnly && "border-transparent bg-transparent",
        className,
      )}
    >
      {!readOnly ? (
        <FormatToolbar editor={editor} onUploadError={(message) => setUploadError(message)} />
      ) : null}
      <EditorContent editor={editor} />
      {uploadError ? (
        <p className="px-3 pb-2 text-[10px] text-loss" role="alert">
          {uploadError}
        </p>
      ) : null}
      {showHints ? (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 pt-1 pb-2 text-[10px] text-text-dim">
          <span className="inline-flex items-center gap-1">
            <Kbd>#</Kbd> heading
          </span>
          <span className="text-border-strong" aria-hidden>
            ·
          </span>
          <span className="inline-flex items-center gap-1">
            <Kbd>-</Kbd> list
          </span>
          <span className="text-border-strong" aria-hidden>
            ·
          </span>
          <span className="inline-flex items-center gap-1">
            <Kbd>[]</Kbd> checklist
          </span>
          <span className="text-border-strong" aria-hidden>
            ·
          </span>
          <span>paste or drop images</span>
        </p>
      ) : null}
    </div>
  );
}
