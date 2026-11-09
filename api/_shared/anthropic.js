// Headers for a Messages API call. A request that opts into server-side
// refusal fallback (`fallbacks: "default"`) needs its beta header; sending
// that header with any other form is a 400, so it is added only when asked.
export const FALLBACK_BETA = "server-side-fallback-2026-07-01";

export function anthropicHeaders(apiKey, request = {}) {
  const headers = { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" };
  if (request.fallbacks === "default") headers["anthropic-beta"] = FALLBACK_BETA;
  return headers;
}

// The text of a non-streaming response. Sonnet 5.5 thinks by default, so the
// first content block can be a `thinking` block with no text; reading
// content[0] alone returns "".
export function responseText(data) {
  return (data?.content || []).filter((b) => b && b.type === "text" && b.text).map((b) => b.text).join("\n").trim();
}
