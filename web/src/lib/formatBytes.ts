export function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function imageFileMeta(file: Pick<File, "name" | "type" | "size">): string {
  const ext = file.name.includes(".")
    ? file.name.split(".").pop()?.toUpperCase()
    : file.type.split("/")[1]?.toUpperCase();
  return `${ext ?? "IMG"} · ${fmtBytes(file.size)}`;
}
