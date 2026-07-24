import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import Underline from "@tiptap/extension-underline";
import type { Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import { mediaApi, mediaSrc, parseMediaId } from "../../lib/api/media";
import { getToken } from "../../lib/api/client";
import { imageFileToUploadFile } from "./imageDataUrl";

const IMAGE_CLASS = "se-image max-h-80 max-w-full rounded-md";

/** TipTap Image that keeps `tm-media:` attrs but renders authed blob URLs. */
const SignalImage = Image.extend({
  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement("img");
      dom.className = IMAGE_CLASS;
      dom.alt = node.attrs.alt ?? "";
      let blobUrl: string | null = null;
      let currentSrc = String(node.attrs.src ?? "");
      let loadGen = 0;

      const applySrc = (src: string | null | undefined) => {
        const next = String(src ?? "");
        currentSrc = next;
        const gen = ++loadGen;
        if (blobUrl) {
          URL.revokeObjectURL(blobUrl);
          blobUrl = null;
        }
        const mediaId = parseMediaId(next);
        if (!mediaId) {
          if (next) dom.src = next;
          else dom.removeAttribute("src");
          return;
        }
        const token = getToken();
        void fetch(mediaApi.fileUrl(mediaId), {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
          .then((r) => {
            if (!r.ok) throw new Error(String(r.status));
            return r.blob();
          })
          .then((blob) => {
            if (gen !== loadGen) return;
            blobUrl = URL.createObjectURL(blob);
            dom.src = blobUrl;
          })
          .catch(() => {
            if (gen === loadGen) dom.removeAttribute("src");
          });
      };

      applySrc(currentSrc);

      return {
        dom,
        update(updated) {
          if (updated.type.name !== "image") return false;
          dom.alt = updated.attrs.alt ?? "";
          const nextSrc = String(updated.attrs.src ?? "");
          if (nextSrc !== currentSrc) applySrc(nextSrc);
          return true;
        },
        destroy() {
          loadGen += 1;
          if (blobUrl) URL.revokeObjectURL(blobUrl);
        },
      };
    };
  },
});

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
        class: "text-primary underline decoration-accent/40 underline-offset-2",
        rel: "noopener noreferrer",
        target: "_blank",
      },
    }),
    SignalImage.configure({
      // Legacy notes may still embed data URLs; new inserts use tm-media: refs.
      allowBase64: true,
      HTMLAttributes: {
        class: IMAGE_CLASS,
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
  const uploadFile = await imageFileToUploadFile(file);
  const fd = new FormData();
  fd.append("file", uploadFile);
  const media = await mediaApi.upload(fd);
  editor
    .chain()
    .focus()
    .setImage({ src: mediaSrc(media.id), alt: file.name })
    .run();
}
