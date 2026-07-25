import { FileJson, FileText, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Button } from "./ui/button";
import { Pill } from "./Pill";

export interface CsvDropZoneProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
  disabled?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileKind(file: File): "json" | "csv" | "file" {
  const name = file.name.toLowerCase();
  if (name.endsWith(".json") || file.type === "application/json") return "json";
  if (name.endsWith(".csv") || file.type === "text/csv") return "csv";
  return "file";
}

export function CsvDropZone({ file, onFileChange, disabled }: CsvDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  function pickFile(next: File | null) {
    if (!next) {
      onFileChange(null);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    if (
      !next.name.toLowerCase().endsWith(".csv") &&
      next.type !== "text/csv" &&
      !next.name.toLowerCase().endsWith(".json") &&
      next.type !== "application/json"
    ) {
      return;
    }
    onFileChange(next);
  }

  function openPicker() {
    if (disabled) return;
    inputRef.current?.click();
  }

  const kind = file ? fileKind(file) : null;
  const FileIcon = kind === "json" ? FileJson : FileText;

  return (
    <div className="flex flex-col gap-2">
      {file ? (
        <div className="flex items-center gap-3 rounded-md bg-muted px-3 py-3">
          <div
            className="flex size-9 shrink-0 items-center justify-center rounded-md bg-card text-muted-foreground"
            aria-hidden
          >
            <FileIcon size={16} strokeWidth={1.75} />
          </div>

          <div className="min-w-0 flex-1">
            <p className="m-0 truncate text-[13px] font-medium tracking-tight text-foreground">
              {file.name}
            </p>
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2">
              {kind === "json" || kind === "csv" ? (
                <Pill tone="accent">{kind.toUpperCase()}</Pill>
              ) : null}
              <p className="m-0 text-[11px] tabular-nums text-muted-foreground">
                {formatFileSize(file.size)} · ready to preview
              </p>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            onClick={() => pickFile(null)}
            aria-label="Remove file"
            className="shrink-0 text-muted-foreground hover:text-destructive"
          >
            <X size={14} strokeWidth={2} />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="ghost"
          disabled={disabled}
          onClick={openPicker}
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (disabled) return;
            pickFile(e.dataTransfer.files?.[0] ?? null);
          }}
          className={cn(
            "h-auto w-full flex-col gap-2 rounded-md border border-dashed px-4 py-8 whitespace-normal",
            "text-[12px] transition-[border-color,background-color] duration-150",
            "disabled:opacity-55",
            dragOver
              ? "border-primary/40 bg-primary/10"
              : "border-border bg-muted hover:border-border hover:bg-accent",
          )}
        >
          <Upload
            size={22}
            strokeWidth={1.5}
            className={dragOver ? "text-primary" : "text-muted-foreground"}
            aria-hidden
          />
          <span className="text-muted-foreground">
            <span className="font-medium text-foreground">Click to upload</span> or drag file here
          </span>
          <span className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
            CSV · JSON
          </span>
        </Button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv,.json,application/json"
        aria-label="Import file input"
        className="sr-only"
        disabled={disabled}
        onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}
