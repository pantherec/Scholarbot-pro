import { describe, it, expect } from "vitest";
import { parseDocs, setDoc, removeDoc, docFileNames } from "../studentDocs.js";
import { LIMITS, canUse, limitResponse } from "../../../api/_shared/usage.js";

describe("resume and brag sheet slots", () => {
  it("keeps a resume and a brag sheet side by side", () => {
    let doc = setDoc("", "resume", "resume.pdf", "Cashier, 2 years");
    doc = setDoc(doc, "brag", "brag.docx", "Captain of the robotics team");
    const d = parseDocs(doc);
    expect(d.resume).toEqual({ name: "resume.pdf", text: "Cashier, 2 years" });
    expect(d.brag).toEqual({ name: "brag.docx", text: "Captain of the robotics team" });
    expect(docFileNames(doc)).toBe("resume.pdf, brag.docx");
  });
  it("replaces only the slot that was uploaded again", () => {
    let doc = setDoc(setDoc("", "resume", "old.pdf", "old resume"), "brag", "brag.txt", "brag text");
    doc = setDoc(doc, "resume", "new.pdf", "new resume");
    const d = parseDocs(doc);
    expect(d.resume.text).toBe("new resume");
    expect(d.brag.text).toBe("brag text");
    expect(doc).not.toContain("old resume");
  });
  it("keeps text the student pasted, and works with one file or none", () => {
    const doc = setDoc("I also tutor my brother.", "brag", "b.txt", "Honor roll");
    expect(parseDocs(doc).pasted).toBe("I also tutor my brother.");
    expect(parseDocs(removeDoc(doc, "brag")).brag).toBe(null);
    expect(removeDoc(doc, "brag")).toBe("I also tutor my brother.");
    expect(parseDocs("").resume).toBe(null);
  });
  it("reads older uploads as brag sheets", () => {
    const d = parseDocs("pasted\n\n--- Uploaded from: sheet.pdf ---\n\nOld text");
    expect(d.brag).toEqual({ name: "sheet.pdf", text: "Old text" });
    expect(d.pasted).toBe("pasted");
  });
});

describe("outline allowance", () => {
  it("gives Free 5 outlines a month and paid plans no monthly cap", () => {
    expect(LIMITS.free.outlinesPerMonth).toBe(5);
    expect(LIMITS.paid.outlinesPerMonth).toBe(Infinity);
  });
  it("refuses the sixth outline on Free and never refuses a paid plan", () => {
    expect(canUse({ outlinesUsed: 4, outlinesLimit: 5 }, "outline")).toBe(true);
    expect(canUse({ outlinesUsed: 5, outlinesLimit: 5 }, "outline")).toBe(false);
    expect(canUse({ outlinesUsed: 400, outlinesLimit: null }, "outline")).toBe(true);
    expect(limitResponse({ outlinesLimit: 5, plan: "free" }, "outline").error).toMatch(/all 5 outlines/);
  });
});
