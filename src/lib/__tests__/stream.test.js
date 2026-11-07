import { describe, it, expect } from "vitest";
import { createStreamTracker, describeStreamOutcome, streamCountsAsLetter } from "../../../api/_shared/stream.js";
import { buildLetterRequest, buildQuestionsRequest, parseQuestions } from "../../../api/_shared/prompts.js";

const ev = (o) => `data: ${JSON.stringify(o)}\n\n`;
const text = (t) => ev({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: t } });
const stop = (reason) => ev({ type: "message_delta", delta: { stop_reason: reason }, usage: { output_tokens: 7 } }) + ev({ type: "message_stop" });

describe("stream watch (one-sentence draft that still cost a letter)", () => {
  it("counts a letter only when the draft really ended", () => {
    const t = createStreamTracker();
    t.push(text("I am soldering ")); t.push(text("a heat sensor.")); t.push(stop("end_turn")); t.flush();
    expect(describeStreamOutcome(t.state)).toBeNull();
    expect(streamCountsAsLetter(t.state)).toBe(true);
  });
  it("reports an in-stream overload instead of passing it off as a finished letter", () => {
    const t = createStreamTracker();
    t.push(text("I am soldering a heat sensor to a circuit board when my mother asks"));
    t.push(ev({ type: "error", error: { type: "overloaded_error", message: "Overloaded" } }));
    t.flush();
    const out = describeStreamOutcome(t.state);
    expect(out.reason).toBe("overloaded");
    expect(out.message).toMatch(/weren't charged/);
    expect(streamCountsAsLetter(t.state)).toBe(false);
  });
  it("treats a refusal stop and a dropped stream as not-a-letter", () => {
    const r = createStreamTracker(); r.push(text("Dear committee,")); r.push(stop("refusal")); r.flush();
    expect(describeStreamOutcome(r.state).reason).toBe("refusal");
    expect(streamCountsAsLetter(r.state)).toBe(false);
    const d = createStreamTracker(); d.push(text("Dear committee,")); d.flush();
    expect(describeStreamOutcome(d.state).reason).toBe("cut_off");
    expect(streamCountsAsLetter(d.state)).toBe(false);
  });
  it("holds a line split across two network reads", () => {
    const t = createStreamTracker();
    const whole = text("hello") + stop("end_turn");
    t.push(whole.slice(0, 20)); t.push(whole.slice(20)); t.flush();
    expect(t.state.gotText).toBe(true);
    expect(t.state.stopped).toBe(true);
  });
});

describe("drafts ask before they invent", () => {
  const profile = { name: "Alexia Savage", intendedMajor: "Aerospace Engineering", ageOk: true };
  const scholarship = { source: "database", name: "Ron Brown Scholar Program", criteria: "African American high school seniors." };
  it("asks for the missing scene on Haiku without spending a letter model", () => {
    const req = buildQuestionsRequest({ profile, scholarship, templateId: "narrative", bragSheet: "Built a fire detection system with a Raspberry Pi." });
    expect(req.model).toBe("claude-haiku-5-5");
    expect(req.system).toMatch(/at most 4 questions/i);
    expect(req.system).toContain("The Storyteller");
    expect(req.messages[0].content).toContain("fire detection system");
  });
  it("parses the question list and caps it at four", () => {
    const five = Array.from({ length: 5 }, (_, i) => ({ id: `q${i}`, question: `Q${i}?`, example: "For example: x" }));
    expect(parseQuestions("Sure:\n" + JSON.stringify(five)).length).toBe(4);
    expect(parseQuestions("no json here")).toEqual([]);
    expect(parseQuestions("[{\"id\":\"a\"}]")).toEqual([]);
  });
  it("feeds answers in as true facts and skipped topics as off-limits", () => {
    const req = buildLetterRequest({
      profile, scholarship, templateId: "narrative",
      details: [{ question: "What happened the first time the detector worked?", answer: "It went off during a candle test in the garage." }],
      declined: ["Did anyone in your family help?"],
    });
    expect(req.system).toContain("NO INVENTED SCENES");
    expect(req.system).toContain("candle test in the garage");
    expect(req.system).toMatch(/CHOSE NOT TO ADD[\s\S]*Did anyone in your family help\?/);
    expect(req.system).toContain("kitchen table while my mother asks");
  });
  it("sends the new 'other details' field to the model", () => {
    const req = buildLetterRequest({ profile: { ...profile, otherDetails: "Lifeguard, summers 2024 and 2025" }, scholarship });
    expect(req.system).toContain("OTHER DETAILS");
    expect(req.system).toContain("Lifeguard, summers 2024 and 2025");
  });
});
