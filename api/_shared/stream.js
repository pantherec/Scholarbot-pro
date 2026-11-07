// Watches an Anthropic Messages stream as it is proxied to the browser.
//
// A draft once stopped after one sentence and the student was still charged a
// letter: the proxy forwarded bytes blindly, so a mid-stream `error` event
// (Anthropic sends overloads and other failures INSIDE the stream, after the
// 200), an early `refusal` stop, or an upstream disconnect all looked the same
// as a finished letter. This tracker reads every event so the handler can tell
// the browser what happened and count a letter only when a draft really ended.
export function createStreamTracker() {
  let pending = "";
  const state = {
    gotText: false,        // at least one text token reached the client
    stopReason: null,      // end_turn | max_tokens | refusal | stop_sequence | ...
    stopped: false,        // a message_stop event arrived
    error: null,           // { type, message } from an in-stream error event
    outputTokens: 0,
  };
  const handle = (evt) => {
    if (!evt || typeof evt !== "object") return;
    if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta" && evt.delta.text) state.gotText = true;
    else if (evt.type === "message_delta") {
      if (evt.delta?.stop_reason) state.stopReason = evt.delta.stop_reason;
      if (evt.usage?.output_tokens) state.outputTokens = evt.usage.output_tokens;
    } else if (evt.type === "message_stop") state.stopped = true;
    else if (evt.type === "error") state.error = { type: evt.error?.type || "error", message: evt.error?.message || "" };
  };
  return {
    state,
    push(chunk) {
      pending += chunk;
      const lines = pending.split("\n");
      pending = lines.pop();
      for (const raw of lines) {
        const line = raw.replace(/\r$/, "");
        if (!line.startsWith("data: ")) continue;
        try { handle(JSON.parse(line.slice(6))); } catch { /* not JSON */ }
      }
    },
    flush() { if (pending) { const rest = pending; pending = ""; this.push(rest + "\n"); } },
  };
}

// Why a stream did not deliver a whole draft, in words a student can act on.
// Returns null when the draft finished normally.
export function describeStreamOutcome(state) {
  if (state.error) {
    const t = state.error.type;
    if (t === "overloaded_error") return { reason: "overloaded", message: "The AI service was overloaded and stopped mid-draft. You weren't charged. Try again in a moment." };
    if (t === "rate_limit_error") return { reason: "rate_limit", message: "The AI service is busy right now. You weren't charged. Try again in a minute." };
    return { reason: "error", message: "The AI service hit an error mid-draft. You weren't charged. Try again." };
  }
  if (state.stopReason === "refusal") return { reason: "refusal", message: "The AI declined to finish this draft. You weren't charged. Try again, or change the writing style." };
  if (!state.stopped) return { reason: "cut_off", message: "The connection dropped before the draft finished. You weren't charged. Try again." };
  if (!state.gotText) return { reason: "empty", message: "The AI service returned an empty draft. You weren't charged. Please try again." };
  return null;
}

// A letter is spent only on a draft that really ended.
export function streamCountsAsLetter(state) {
  return state.gotText && !state.error && state.stopped && state.stopReason !== "refusal";
}
