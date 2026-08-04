import {
  CircleAlertIcon,
  CloudUploadIcon,
  FileJson,
  FileText,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import { formatBytes, useFileUpload, type FileWithPreview } from "@/hooks/use-file-upload";
import { Alert, AlertDescription, AlertTitle } from "@/components/reui/alert";
import { Badge } from "@/components/reui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/cn";
import { Button } from "./ui/button";

/** The import API takes one file per run, so the picker stays single-file. */
const ACCEPT = ".csv,text/csv,.json,application/json";
// Must not exceed the API's TM_IMPORT_MAX_BYTES (default 10 MiB) — a larger
// client cap lets uploads through that the server then rejects with a 413.
const MAX_SIZE = 10 * 1024 * 1024;

export interface CsvDropZoneProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
  disabled?: boolean;
  /** Grow the empty drop target to the parent's height instead of hugging its content. */
  fill?: boolean;
  /** Extra classes for the empty drop target (e.g. taller padding). */
  className?: string;
}

function fileKind(file: File): "json" | "csv" | "file" {
  const name = file.name.toLowerCase();
  if (name.endsWith(".json") || file.type === "application/json") return "json";
  if (name.endsWith(".csv") || file.type === "text/csv") return "csv";
  return "file";
}

/** The hook hands back `File | FileMetadata`; only real Files reach the import. */
function toFile(entry: FileWithPreview): File | null {
  return entry.file instanceof File ? entry.file : null;
}

export function CsvDropZone({ file, onFileChange, disabled, fill, className }: CsvDropZoneProps) {
  const [
    { isDragging, errors },
    {
      clearFiles,
      handleDragEnter,
      handleDragLeave,
      handleDragOver,
      handleDrop,
      openFileDialog,
      getInputProps,
    },
  ] = useFileUpload({
    accept: ACCEPT,
    maxSize: MAX_SIZE,
    multiple: false,
    // The parent owns the selection — the hook only validates and reports.
    onFilesChange: (next) => onFileChange(next[0] ? toFile(next[0]) : null),
  });

  // Render from the prop, not the hook's own list: the parent resets it (e.g.
  // "Import another") and its handler is async, so hook state trails it.
  const selected = file;
  const kind = selected ? fileKind(selected) : null;
  const FileIcon = kind === "json" ? FileJson : FileText;

  return (
    // `w-full` — the parent Field is `items-start`, which would otherwise shrink the drop target.
    <div className={cn("flex w-full min-w-0 flex-col gap-3", fill && "min-h-0 flex-1")}>
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={cn(
          "relative flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed",
          "px-4 py-8 text-center transition-colors duration-150",
          fill && !selected && "min-h-56 flex-1",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50",
          disabled && "pointer-events-none opacity-55",
          className,
        )}
      >
        <input
          {...getInputProps({ disabled, "aria-label": "Import file input" })}
          className="sr-only"
        />

        <div
          className={cn(
            "flex size-12 items-center justify-center rounded-full transition-colors duration-150",
            isDragging ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
          )}
          aria-hidden
        >
          <UploadIcon className="size-5" />
        </div>

        <div className="space-y-2">
          <p className="m-0 text-sm font-medium">
            Drop a file here or{" "}
            <button
              type="button"
              onClick={openFileDialog}
              disabled={disabled}
              className="cursor-pointer text-primary underline-offset-4 hover:underline"
            >
              browse files
            </button>
          </p>
          <p className="m-0 text-xs text-muted-foreground">
            CSV or JSON · maximum file size {formatBytes(MAX_SIZE)}
          </p>
        </div>
      </div>

      {selected ? (
        <div className="min-w-0 overflow-hidden rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                {/* `w-full` + `max-w-0` on Name: it absorbs the leftover width and
                    truncates, while the fixed columns size to their content. */}
                <TableHead className="h-9 w-full ps-4">Name</TableHead>
                {/* The extension is already in the name — drop the chip on phones. */}
                <TableHead className="hidden h-9 w-px whitespace-nowrap sm:table-cell">
                  Type
                </TableHead>
                <TableHead className="h-9 w-px whitespace-nowrap">Size</TableHead>
                <TableHead className="h-9 w-px whitespace-nowrap ps-4">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="max-w-0 py-2 ps-4">
                  <div className="flex min-w-0 items-center gap-2">
                    <FileIcon className="size-4 shrink-0 text-muted-foreground/80" aria-hidden />
                    <p className="m-0 truncate text-sm font-medium">{selected.name}</p>
                  </div>
                </TableCell>
                <TableCell className="hidden py-2 sm:table-cell">
                  <Badge variant="secondary" className="text-xs">
                    {kind === "file" ? "File" : kind?.toUpperCase()}
                  </Badge>
                </TableCell>
                <TableCell className="py-2 text-sm whitespace-nowrap tabular-nums text-muted-foreground">
                  {formatBytes(selected.size)}
                </TableCell>
                <TableCell className="py-2">
                  <Button
                    type="button"
                    // Clearing the hook fires onFilesChange, which nulls the prop.
                    onClick={() => {
                      clearFiles();
                      onFileChange(null);
                    }}
                    disabled={disabled}
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Remove file"
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2Icon className="size-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      ) : null}

      {selected ? (
        // The empty state already offers "browse files"; once a file is picked
        // this is the replace affordance the block puts above its table.
        <Button
          type="button"
          onClick={openFileDialog}
          disabled={disabled}
          variant="outline"
          size="sm"
          className="w-full sm:w-fit"
        >
          <CloudUploadIcon className="size-4" />
          Choose a different file
        </Button>
      ) : null}

      {errors.length > 0 ? (
        <Alert variant="destructive">
          <CircleAlertIcon />
          <AlertTitle>File upload error</AlertTitle>
          <AlertDescription>
            {errors.map((error) => (
              <p key={error} className="last:mb-0">
                {error}
              </p>
            ))}
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
