import { useEffect, useRef, useState } from "react";
import { getBaseUrl, getToken } from "@/lib/api/client";

/** Stable blob URLs for authenticated attachment previews (revoked on unmount / id removal). */
export function useAuthedAttachmentUrls(attachmentIds: readonly string[]) {
  const cacheRef = useRef<Map<string, string>>(new Map());
  const [, bump] = useState(0);
  const keys = [...attachmentIds].sort().join("|");

  useEffect(() => {
    // Derive ids from `keys` so the effect depends on a stable serialization,
    // not a new array identity each render.
    const ids = keys.length === 0 ? [] : keys.split("|");
    const active = new Set(ids);
    let cancelled = false;

    for (const id of ids) {
      if (cacheRef.current.has(id)) continue;
      const t = getToken();
      void fetch(`${getBaseUrl()}/attachments/${id}/file`, {
        headers: t ? { Authorization: `Bearer ${t}` } : {},
      })
        .then((r) => {
          if (!r.ok) throw new Error(`${r.status}`);
          return r.blob();
        })
        .then((blob) => {
          if (cancelled) return;
          cacheRef.current.set(id, URL.createObjectURL(blob));
          bump((n) => n + 1);
        })
        .catch(() => {});
    }

    for (const [id, url] of [...cacheRef.current.entries()]) {
      if (!active.has(id)) {
        URL.revokeObjectURL(url);
        cacheRef.current.delete(id);
      }
    }
    bump((n) => n + 1);

    return () => {
      cancelled = true;
    };
  }, [keys]);

  useEffect(
    () => () => {
      for (const url of cacheRef.current.values()) URL.revokeObjectURL(url);
      cacheRef.current.clear();
    },
    [],
  );

  return cacheRef.current;
}
