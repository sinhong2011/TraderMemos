import type { Editor } from "@tiptap/react";
import {
  Bold,
  CheckSquare,
  Heading2,
  ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  Strikethrough,
  Underline,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "../../lib/cn";
import { SignalInput } from "../SignalInput";
import { Button } from "../ui/button";
import { insertImageFromFile } from "./tiptapExtensions";

function FormatButton({
  active,
  label,
  onClick,
  disabled,
  children,
}: {
  active?: boolean;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      aria-label={label}
      aria-pressed={active}
      title={label}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "text-muted-foreground hover:bg-accent hover:text-foreground",
        active && "bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary",
      )}
    >
      {children}
    </Button>
  );
}

function useEditorTick(editor: Editor | null) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!editor) return;
    const bump = () => setTick((n) => n + 1);
    editor.on("selectionUpdate", bump);
    editor.on("transaction", bump);
    return () => {
      editor.off("selectionUpdate", bump);
      editor.off("transaction", bump);
    };
  }, [editor]);
}

export function FormatToolbar({
  editor,
  uploading,
  onUploadError,
}: {
  editor: Editor | null;
  uploading?: boolean;
  onUploadError?: (message: string) => void;
}) {
  useEditorTick(editor);
  const fileRef = useRef<HTMLInputElement>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("https://");
  const [busy, setBusy] = useState(false);

  if (!editor) return null;

  const applyLink = () => {
    const url = linkUrl.trim();
    if (!url || url === "https://") {
      setLinkOpen(false);
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    setLinkOpen(false);
    setLinkUrl("https://");
  };

  const onLinkClick = () => {
    if (editor.isActive("link")) {
      editor.chain().focus().unsetLink().run();
      setLinkOpen(false);
      return;
    }
    const prev = editor.getAttributes("link").href;
    if (typeof prev === "string" && prev) setLinkUrl(prev);
    setLinkOpen((open) => !open);
  };

  const onPickImage = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      await insertImageFromFile(editor, file);
    } catch (e) {
      onUploadError?.(e instanceof Error ? e.message : "Could not add image");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col gap-1.5 px-2 pt-2 pb-1">
      <div
        role="toolbar"
        aria-label="Text formatting"
        className="flex flex-wrap items-center gap-0.5"
      >
        <FormatButton
          active={editor.isActive("bold")}
          label="Bold"
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold size={13} strokeWidth={2} />
        </FormatButton>
        <FormatButton
          active={editor.isActive("italic")}
          label="Italic"
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic size={13} strokeWidth={2} />
        </FormatButton>
        <FormatButton
          active={editor.isActive("underline")}
          label="Underline"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <Underline size={13} strokeWidth={2} />
        </FormatButton>
        <FormatButton
          active={editor.isActive("strike")}
          label="Strikethrough"
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough size={13} strokeWidth={2} />
        </FormatButton>
        <span className="mx-0.5 h-4 w-px bg-border" aria-hidden />
        <FormatButton
          active={editor.isActive("heading", { level: 2 })}
          label="Heading"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 size={13} strokeWidth={2} />
        </FormatButton>
        <FormatButton
          active={editor.isActive("bulletList")}
          label="Bullet list"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List size={13} strokeWidth={2} />
        </FormatButton>
        <FormatButton
          active={editor.isActive("orderedList")}
          label="Numbered list"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered size={13} strokeWidth={2} />
        </FormatButton>
        <FormatButton
          active={editor.isActive("taskList")}
          label="Checklist"
          onClick={() => editor.chain().focus().toggleTaskList().run()}
        >
          <CheckSquare size={13} strokeWidth={2} />
        </FormatButton>
        <span className="mx-0.5 h-4 w-px bg-border" aria-hidden />
        <FormatButton
          active={editor.isActive("link") || linkOpen}
          label="Link"
          onClick={onLinkClick}
        >
          <Link2 size={13} strokeWidth={2} />
        </FormatButton>
        <FormatButton
          label="Add image"
          disabled={busy || uploading}
          onClick={() => fileRef.current?.click()}
        >
          <ImageIcon size={13} strokeWidth={2} />
        </FormatButton>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          aria-label="Upload image"
          onChange={(e) => void onPickImage(e.target.files?.[0])}
        />
      </div>

      {linkOpen ? (
        <div className="flex items-center gap-1.5 pb-1">
          <SignalInput
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyLink();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setLinkOpen(false);
              }
            }}
            placeholder="https://"
            aria-label="Link URL"
            className="h-8 text-[12px]"
            autoFocus
          />
          <Button type="button" size="xs" onClick={applyLink}>
            Add
          </Button>
          <Button type="button" size="xs" variant="ghost" onClick={() => setLinkOpen(false)}>
            Cancel
          </Button>
        </div>
      ) : null}
    </div>
  );
}
