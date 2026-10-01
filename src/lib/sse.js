// Incremental SSE parser. Network reads can split an event across chunks; the
// unfinished last line is held until the next chunk completes it (dropping it is
// how letters used to lose words mid-stream).
export function createSseParser(onEvent) {
  let pending = "";
  return {
    push(chunk) {
      pending += chunk;
      const lines = pending.split("\n");
      pending = lines.pop();
      for (const line of lines) {
        const trimmed = line.replace(/\r$/, "");
        if (!trimmed.startsWith("data: ")) continue;
        const json = trimmed.slice(6);
        if (json === "[DONE]") continue;
        try { onEvent(JSON.parse(json)); } catch { /* ignore non-JSON lines */ }
      }
    },
    flush() {
      if (pending) { const rest = pending; pending = ""; this.push(rest + "\n"); }
    },
  };
}
