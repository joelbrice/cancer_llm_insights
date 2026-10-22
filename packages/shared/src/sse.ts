/** Incremental Server-Sent Events parser (works with browser streams, expo/fetch streams, or plain text). */

export interface RawSseEvent {
  event: string;
  data: string;
}

export class SseParser {
  private buffer = "";

  /** Feed a decoded text chunk; returns every complete event it closed. */
  push(chunk: string): RawSseEvent[] {
    this.buffer += chunk.replace(/\r\n?/g, "\n");
    const events: RawSseEvent[] = [];
    let boundary = this.buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const block = this.buffer.slice(0, boundary);
      this.buffer = this.buffer.slice(boundary + 2);
      const parsed = parseBlock(block);
      if (parsed) events.push(parsed);
      boundary = this.buffer.indexOf("\n\n");
    }
    return events;
  }

  /** Flush a trailing event that was not terminated by a blank line. */
  end(): RawSseEvent[] {
    const rest = this.buffer.trim();
    this.buffer = "";
    const parsed = rest ? parseBlock(rest) : null;
    return parsed ? [parsed] : [];
  }
}

function parseBlock(block: string): RawSseEvent | null {
  let event = "message";
  const data: string[] = [];
  for (const line of block.split("\n")) {
    if (!line || line.startsWith(":")) continue; // comment / keep-alive
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "event") event = value;
    else if (field === "data") data.push(value);
  }
  return data.length || event !== "message" ? { event, data: data.join("\n") } : null;
}

/** Iterate SSE events from a fetch Response body (ReadableStream) with a text fallback. */
export async function* readSse(response: Response, signal?: AbortSignal): AsyncGenerator<RawSseEvent> {
  const parser = new SseParser();
  const body = response.body as ReadableStream<Uint8Array> | null;
  if (!body || typeof body.getReader !== "function") {
    // Environments without streaming bodies: degrade to buffered parsing (still correct, just not incremental).
    yield* parser.push(await response.text());
    yield* parser.end();
    return;
  }
  const reader = body.getReader();
  const decoder = new TextDecoder();
  try {
    while (true) {
      if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
      const { value, done } = await reader.read();
      if (done) break;
      for (const event of parser.push(decoder.decode(value, { stream: true }))) yield event;
    }
    for (const event of parser.push(decoder.decode())) yield event;
    yield* parser.end();
  } finally {
    reader.releaseLock?.();
  }
}
