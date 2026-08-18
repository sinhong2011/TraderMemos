import { getBaseUrl, getToken } from "./client";

export interface SseHandlers {
  /** Called for each event. `data` is the raw payload string. */
  onEvent: (event: string, data: string) => void;
  signal?: AbortSignal;
}

/**
 * POST a request and consume the Server-Sent Event stream it returns.
 *
 * `EventSource` cannot be used here: it is GET-only and cannot set an
 * Authorization header, and this endpoint both mutates and requires auth.
 */
export async function postEventStream(path: string, { onEvent, signal }: SseHandlers) {
  const auth = getToken();
  const res = await fetch(getBaseUrl() + path, {
    method: "POST",
    headers: {
      Accept: "text/event-stream",
      ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
    },
    signal,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      typeof body?.error?.message === "string"
        ? body.error.message
        : `Request failed (${res.status})`,
    );
  }

  // The server answers a disabled coach with plain JSON rather than a stream,
  // so honour the content type instead of assuming every 200 is an event stream.
  if (!res.headers.get("content-type")?.includes("text/event-stream")) {
    const body = await res.text();
    onEvent("done", body);
    return;
  }
  if (!res.body) throw new Error("This browser cannot read streamed responses");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Frames are separated by a blank line; anything after the last one is a
    // partial frame and stays in the buffer until the rest arrives.
    let sep = buffer.indexOf("\n\n");
    while (sep !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const parsed = parseFrame(frame);
      if (parsed) onEvent(parsed.event, parsed.data);
      sep = buffer.indexOf("\n\n");
    }
  }
}

function parseFrame(frame: string): { event: string; data: string } | null {
  let event = "";
  const dataLines: string[] = [];
  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
  }
  if (!event) return null;
  return { event, data: dataLines.join("\n") };
}
