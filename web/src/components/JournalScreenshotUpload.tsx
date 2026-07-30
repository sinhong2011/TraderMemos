import { ImageIcon, Loader2, Upload, X } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import Lightbox from "yet-another-react-lightbox";
import Captions from "yet-another-react-lightbox/plugins/captions";
import Counter from "yet-another-react-lightbox/plugins/counter";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/captions.css";
import "yet-another-react-lightbox/plugins/counter.css";
import { capScreenshots } from "@/lib/journalPrefs";
import { fmtBytes } from "@/lib/formatBytes";
import { useAuthedAttachmentUrls } from "@/lib/hooks/useAuthedAttachmentUrls";
import { cn } from "@/lib/cn";
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
  AttachmentTrigger,
} from "./Attachment";

export interface ScreenshotAttachmentItem {
  key: string;
  name: string;
  sizeBytes: number;
  /** Local file pending upload — preview URL is managed inside this component. */
  file?: File;
  /** Server attachment id — fetched with auth for lightbox + thumbnail. */
  attachmentId?: string;
  /** Custom preview for server-backed attachments (e.g. AuthedImage). */
  preview?: ReactNode;
  previewHref?: string;
  state?: "idle" | "uploading" | "processing" | "error" | "done";
  onRemove?: () => void;
}

export interface JournalScreenshotUploadProps {
  items: ScreenshotAttachmentItem[];
  onAddFiles?: (files: File[]) => void;
  disabled?: boolean;
  uploading?: boolean;
  maxCount?: number | null;
  accept?: string;
  multiple?: boolean;
  inputTestId?: string;
  addLabel?: string;
  addDescription?: string;
  className?: string;
}

export function fileCacheKey(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

/** Stable blob URLs — only revoked when a file leaves the list or the field unmounts. */
function useFileObjectUrls(filesRef: RefObject<readonly File[]>, fileKeys: string) {
  const cacheRef = useRef<Map<string, string>>(new Map());
  const [, bump] = useState(0);

  useEffect(() => {
    const files = filesRef.current ?? [];
    const active = new Set(files.map(fileCacheKey));
    for (const file of files) {
      const key = fileCacheKey(file);
      if (!cacheRef.current.has(key)) {
        cacheRef.current.set(key, URL.createObjectURL(file));
      }
    }
    for (const [key, url] of [...cacheRef.current.entries()]) {
      if (!active.has(key)) {
        URL.revokeObjectURL(url);
        cacheRef.current.delete(key);
      }
    }
    bump((n) => n + 1);
  }, [fileKeys, filesRef]);

  useEffect(
    () => () => {
      for (const url of cacheRef.current.values()) URL.revokeObjectURL(url);
      cacheRef.current.clear();
    },
    [],
  );

  return cacheRef.current;
}

function FilePreview({ file, src }: { file: File; src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <ImageIcon className="size-6 text-muted-foreground" aria-hidden />;
  }
  return (
    <img
      src={src}
      alt={file.name}
      className="h-full w-full object-cover"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

export function fileToScreenshotItem(file: File, onRemove: () => void): ScreenshotAttachmentItem {
  return {
    key: fileCacheKey(file),
    name: file.name,
    sizeBytes: file.size,
    file,
    state: "idle",
    onRemove,
  };
}

export function JournalScreenshotUpload({
  items,
  onAddFiles,
  disabled = false,
  uploading = false,
  maxCount = null,
  accept = "image/*",
  multiple = true,
  inputTestId = "journal-screenshot-input",
  addLabel = "Add screenshots",
  addDescription = "PNG, JPG · click to browse",
  className,
}: JournalScreenshotUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const atLimit = maxCount != null && items.length >= maxCount;
  const pickerDisabled = disabled || uploading || atLimit || !onAddFiles;
  const pendingFilesRef = useRef<File[]>([]);
  pendingFilesRef.current = items.flatMap((item) => (item.file ? [item.file] : []));
  const pendingFileKeys = pendingFilesRef.current.map(fileCacheKey).sort().join("|");
  const fileUrls = useFileObjectUrls(pendingFilesRef, pendingFileKeys);
  const attachmentIds = useMemo(
    () => items.flatMap((item) => (item.attachmentId ? [item.attachmentId] : [])),
    [items],
  );
  const attachmentUrls = useAuthedAttachmentUrls(attachmentIds);
  const [lightboxIndex, setLightboxIndex] = useState(-1);
  const [pendingLightboxKey, setPendingLightboxKey] = useState<string | null>(null);

  function ingest(files: FileList | File[] | null | undefined) {
    if (!files?.length || !onAddFiles) return;
    const images = [...files].filter((f) => f.type.startsWith("image/") || accept === "image/*");
    if (images.length === 0) return;
    const capped = capScreenshots(
      images,
      maxCount != null ? Math.max(maxCount - items.length, 0) : null,
    );
    if (capped.length > 0) onAddFiles(capped);
  }

  function previewSrc(item: ScreenshotAttachmentItem): string | null {
    if (item.file) return fileUrls.get(fileCacheKey(item.file)) ?? null;
    if (item.previewHref) return item.previewHref;
    if (item.attachmentId) return attachmentUrls.get(item.attachmentId) ?? null;
    return null;
  }

  const lightboxSlides = items.flatMap((item) => {
    let src: string | null = null;
    if (item.file) src = fileUrls.get(fileCacheKey(item.file)) ?? null;
    else if (item.previewHref) src = item.previewHref;
    else if (item.attachmentId) src = attachmentUrls.get(item.attachmentId) ?? null;
    return src ? [{ key: item.key, src, title: item.name }] : [];
  });

  function openLightbox(itemKey: string) {
    const idx = lightboxSlides.findIndex((slide) => slide.key === itemKey);
    if (idx >= 0) {
      setLightboxIndex(idx);
      setPendingLightboxKey(null);
      return;
    }
    setPendingLightboxKey(itemKey);
  }

  useEffect(() => {
    if (!pendingLightboxKey) return;
    const idx = lightboxSlides.findIndex((slide) => slide.key === pendingLightboxKey);
    if (idx >= 0) {
      setLightboxIndex(idx);
      setPendingLightboxKey(null);
    }
  }, [pendingLightboxKey, lightboxSlides]);

  function canPreview(item: ScreenshotAttachmentItem) {
    return Boolean(item.file || item.previewHref || item.attachmentId);
  }

  function renderPreview(item: ScreenshotAttachmentItem) {
    const src = previewSrc(item);
    if (item.file && src) {
      return <FilePreview file={item.file} src={src} />;
    }
    if (src) {
      return (
        <img src={src} alt={item.name} className="h-full w-full object-cover" decoding="async" />
      );
    }
    if (item.preview) return item.preview;
    return <ImageIcon aria-hidden />;
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={pickerDisabled}
        aria-label="Upload journal screenshots"
        data-testid={inputTestId}
        className="hidden"
        onChange={(e) => {
          ingest(e.target.files);
          e.target.value = "";
        }}
      />

      {onAddFiles ? (
        <Attachment
          state={uploading ? "uploading" : "idle"}
          className={cn(
            "w-full",
            !pickerDisabled && "cursor-pointer hover:bg-accent",
            pickerDisabled && "opacity-55",
          )}
          onClick={() => {
            if (!pickerDisabled) inputRef.current?.click();
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (!pickerDisabled) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (!pickerDisabled) ingest(e.dataTransfer.files);
          }}
          data-drag-over={dragOver || undefined}
        >
          <AttachmentMedia>
            {uploading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Upload className="size-4" aria-hidden />
            )}
          </AttachmentMedia>
          <AttachmentContent>
            <AttachmentTitle>{uploading ? "Uploading…" : addLabel}</AttachmentTitle>
            <AttachmentDescription>
              {atLimit && maxCount != null ? `Maximum ${maxCount} screenshots` : addDescription}
            </AttachmentDescription>
          </AttachmentContent>
        </Attachment>
      ) : null}

      {items.length > 0 ? (
        <AttachmentGroup className="w-full">
          {items.map((item) => (
            <Attachment
              key={item.key}
              orientation="vertical"
              state={item.state ?? "done"}
              className={cn("w-28", canPreview(item) && "cursor-zoom-in")}
            >
              <AttachmentMedia
                variant={item.file || item.preview || previewSrc(item) ? "image" : "icon"}
              >
                {renderPreview(item)}
              </AttachmentMedia>
              {canPreview(item) ? (
                <AttachmentTrigger
                  aria-label={`Preview ${item.name}`}
                  onClick={() => openLightbox(item.key)}
                />
              ) : null}
              <AttachmentContent>
                <AttachmentTitle>{item.name}</AttachmentTitle>
                <AttachmentDescription>{fmtBytes(item.sizeBytes)}</AttachmentDescription>
              </AttachmentContent>
              {item.onRemove ? (
                <AttachmentActions>
                  <AttachmentAction
                    aria-label={`Remove ${item.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      item.onRemove?.();
                    }}
                  >
                    <X size={14} strokeWidth={2} aria-hidden />
                  </AttachmentAction>
                </AttachmentActions>
              ) : null}
            </Attachment>
          ))}
        </AttachmentGroup>
      ) : onAddFiles ? null : (
        <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border py-8 text-xs text-muted-foreground">
          <ImageIcon size={20} strokeWidth={1.5} className="opacity-40" aria-hidden />
          No screenshots yet
        </div>
      )}

      <Lightbox
        open={lightboxIndex >= 0}
        index={lightboxIndex >= 0 ? lightboxIndex : 0}
        close={() => setLightboxIndex(-1)}
        slides={lightboxSlides}
        plugins={[Zoom, Captions, Counter]}
        zoom={{ scrollToZoom: true }}
        captions={{ descriptionTextAlign: "center" }}
        controller={{ closeOnBackdropClick: true }}
        on={{
          view: ({ index }) => setLightboxIndex(index),
        }}
        // Scrim + chrome live in `.tm-lightbox` (global.css). An inline
        // `container: transparent` here would knock the backdrop out entirely.
        className="tm-lightbox"
      />
    </div>
  );
}
