import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import Underline from "@tiptap/extension-underline";
import type { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import { imageFileToDataUrl } from "./imageDataUrl";

export function createSignalEditorExtensions(placeholder: string) {
  return [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      codeBlock: false,
    }),
    Underline,
    TaskList,
    TaskItem.configure({ nested: true }),
    Link.configure({
      openOnClick: false,
      autolink: true,
      HTMLAttributes: {
        class: "text-accent underline decoration-accent/40 underline-offset-2",
        rel: "noopener noreferrer",
        target: "_blank",
      },
    }),
    Image.configure({
      allowBase64: true,
      HTMLAttributes: {
        class: "se-image max-h-80 max-w-full rounded-control",
      },
    }),
    Placeholder.configure({ placeholder }),
    Markdown.configure({
      html: true,
      tightLists: true,
      bulletListMarker: "-",
      linkify: false,
      breaks: true,
      transformPastedText: true,
    }),
  ];
}

export function getEditorMarkdown(editor: Editor): string {
  const storage = editor.storage as { markdown?: { getMarkdown: () => string } };
  return (storage.markdown?.getMarkdown() ?? editor.getText()).trim();
}

export async function insertImageFromFile(editor: Editor, file: File): Promise<void> {
  const src = await imageFileToDataUrl(file);
  editor.chain().focus().setImage({ src, alt: file.name }).run();
}
