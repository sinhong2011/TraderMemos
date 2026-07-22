import { FileText, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { cn } from "../lib/cn";
import { Button } from "./ui/button";

export interface CsvDropZoneProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
  disabled?: boolean;
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

  return (
    <div className="flex flex-col gap-2">
      {file ? (
        <div className="flex items-center gap-2 rounded-control border border-accent/25 bg-accent-bg px-3 py-2.5">
          <FileText size={14} strokeWidth={1.75} className="shrink-0 text-accent" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-medium text-text">{file.name}</p>
            <p className="text-[10px] text-text-dim">{(file.size / 1024).toFixed(1)} KB</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={disabled}
            onClick={() => pickFile(null)}
            aria-label="Remove file"
            className="shrink-0 text-text-dim"
          >
            <X size={14} strokeWidth={2} />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="ghost"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
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
            "h-auto w-full flex-col gap-2 rounded-control border border-dashed px-4 py-8 whitespace-normal",
            "text-[12px] transition-[border-color,background-color] duration-150",
            "disabled:opacity-55",
            dragOver
              ? "border-accent bg-accent-bg"
              : "border-border bg-bg-inset hover:border-border-strong hover:bg-bg-hover",
          )}
        >
          <Upload
            size={22}
            strokeWidth={1.5}
            className={dragOver ? "text-accent" : "text-text-dim"}
            aria-hidden
          />
          <span className="text-text-muted">
            <span className="text-accent">Click to upload</span> or drag file here
          </span>
          <span className="text-[10px] text-text-dim">.csv or .json</span>
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
