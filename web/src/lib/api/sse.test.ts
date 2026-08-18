import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { postEventStream } from "./sse";

vi.mock("./client", () => ({
  getBaseUrl: () => "http://test.local",
  getToken: () => "test-token",
}));

/** Builds a Response whose body streams `chunks` in order. */
function streamResponse(chunks: string[], contentType = "text/event-stream") {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { "content-type": contentType } });
}

function collect() {
  const seen: [string, string][] = [];
  return { seen, onEvent: (event: string, data: string) => seen.push([event, data]) };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("postEventStream", () => {
  it("parses complete frames", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      streamResponse(['event: note\ndata: {"a":1}\n\n', 'event: done\ndata: {"b":2}\n\n']),
    );
    const { seen, onEvent } = collect();
    await postEventStream("/x", { onEvent });

    expect(seen).toEqual([
      ["note", '{"a":1}'],
      ["done", '{"b":2}'],
    ]);
  });

  // A frame split across reads must not be delivered twice or dropped — this
  // is the failure mode that makes streamed notes duplicate or vanish.
  it("reassembles a frame split across chunks", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      streamResponse([
        "event: note\nda",
        'ta: {"headline":"Split"}',
        "\n\nevent: done\ndata: {}\n\n",
      ]),
    );
    const { seen, onEvent } = collect();
    await postEventStream("/x", { onEvent });

    expect(seen).toEqual([
      ["note", '{"headline":"Split"}'],
      ["done", "{}"],
    ]);
  });

  it("delivers several frames arriving in one chunk", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      streamResponse(["event: note\ndata: 1\n\nevent: note\ndata: 2\n\nevent: done\ndata: 3\n\n"]),
    );
    const { seen, onEvent } = collect();
    await postEventStream("/x", { onEvent });

    expect(seen.map(([, d]) => d)).toEqual(["1", "2", "3"]);
  });

  it("ignores a trailing partial frame", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      streamResponse(["event: note\ndata: 1\n\nevent: note\ndata: incomp"]),
    );
    const { seen, onEvent } = collect();
    await postEventStream("/x", { onEvent });

    expect(seen).toEqual([["note", "1"]]);
  });

  // A disabled coach answers with plain JSON, not a stream.
  it("passes a non-stream response through as done", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response('{"source":"off","notes":[]}', {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const { seen, onEvent } = collect();
    await postEventStream("/x", { onEvent });

    expect(seen).toEqual([["done", '{"source":"off","notes":[]}']]);
  });

  it("throws the server message on a failed request", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response('{"error":{"message":"trade not found"}}', {
        status: 404,
        headers: { "content-type": "application/json" },
      }),
    );
    const { onEvent } = collect();
    await expect(postEventStream("/x", { onEvent })).rejects.toThrow("trade not found");
  });
});
